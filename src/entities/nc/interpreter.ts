/**
 * Runs a Haas NGC mill program against a machine setup and returns every
 * motion it produces, in machine coordinates, with the alarms the control
 * would raise and where.
 *
 * The whole program is executed up front (macro loops, subprograms and all),
 * because the app needs the complete motion list before CYCLE START: the
 * runner plays it in time and the removal engine sweeps it. Each motion keeps
 * its source line and executed-block number so the runner can stop between
 * blocks (single block, feed hold, M00/M01).
 *
 * Pipeline: words -> modal state -> program-coordinate moves -> part frame
 * (G51/G68) -> cutter compensation lookahead -> machine frame (work offset,
 * tool length, or DWO/TCPC through kinematics.ts) -> linearised, travel-checked
 * motions with times.
 *
 * Behaviour follows docs/haas-ngc/gcode.md, mcode.md and settings-alarms.md;
 * where those leave a point open, the Fanuc-compatible reading is used and
 * noted where it is applied.
 */
import { TRAVEL } from "../machine/machine-logic";
import type { Axis } from "../machine/machine-types";
import { ALARMS, WARNINGS, type AlarmKey } from "./alarms";
import { CutterComp, type PathSeg } from "./cutter-comp";
import { boltHoles, holeSteps, pocketSteps, type CycleParams, type Step } from "./cycles";
import {
  type Frame,
  type Transform,
  IDENTITY,
  directionToPart,
  frameToMachine,
  fromPart,
  machineToFrame,
  toPart,
} from "./frames";
import { type Plane, type Vec3, PLANE_AXES, arcChords, arcFromCenter, arcPoint, distance, lerp, planeNormal, scale } from "./geometry";
import { MacroError, evaluate, truthy, variableIndex, type Value } from "./macro";
import {
  ARC_TOLERANCE,
  CAN_CYCLE_DELTA_Z,
  CHORD_TOLERANCE,
  MAX_BLOCKS,
  MAX_CALL_DEPTH,
  MAX_FEED,
  MAX_INVERSE_TIME_F,
  MAX_MOTIONS,
  MAX_SPINDLE_RPM,
  MAX_TOOL_NUMBER,
  MM_PER_INCH,
  RAPID_RATE,
  TOOL_CHANGE_SECONDS,
} from "./machine-data";
import { parseProgram } from "./parser";
import type {
  ActiveCodes,
  Block,
  CannedCycle,
  Diagnostic,
  MachinePosition,
  ModalState,
  Motion,
  NcResult,
  NcSetup,
  ParsedProgram,
  Statement,
  Word,
} from "./types";

/** An evaluated word: `v` is the real value (decimal rules applied), `raw`
 *  the number as written. */
type W = { letter: string; v: number; raw: number; decimal: boolean };
type Words = Partial<Record<string, W>>;

type SegData = {
  rapid: boolean;
  /** mm/min along the path (degrees count as mm when rotary moves with linear). */
  feed: number;
  /** deg/min, for rotary-only feed moves. */
  rotaryFeed: number;
  /** G93: minutes for the whole programmed move. */
  inverseMinutes?: number;
  b0: number;
  c0: number;
  b1: number;
  c1: number;
  frame: Frame;
  block: number;
  program?: string;
};
type Seg = PathSeg<SegData>;
type NcEvent = Exclude<Motion, { kind: "rapid" | "feed" }>;
/** An event as the interpreter raises it; the source fields are added on the way out. */
type EventBody = NcEvent extends infer E ? (E extends unknown ? Omit<E, "line" | "program" | "block"> : never) : never;

type CallFrame = {
  program: ParsedProgram;
  /** "O01000" for a subprogram; undefined for the main program. */
  name?: string;
  /** Block the call entered at (the O line, or the N line for M97). */
  start: number;
  pc: number;
  locals: Map<number, Value>;
  /** Runs left after this one (L). */
  repeats: number;
  kind: "main" | "sub" | "local" | "macro";
};

class NcAlarm extends Error {
  constructor(readonly diagnostic: Diagnostic) {
    super(diagnostic.message);
  }
}

type Group =
  | "motion"
  | "cycle"
  | "plane"
  | "units"
  | "comp"
  | "length"
  | "scale"
  | "wcs"
  | "path"
  | "rotate"
  | "distance"
  | "feedMode"
  | "return"
  | "dwo"
  | "once";

const G_GROUP: Record<number, Group> = {};
const groupOf = (group: Group, codes: number[]) => codes.forEach((c) => (G_GROUP[c] = group));
groupOf("motion", [0, 1, 2, 3]);
// G87/G88 are classic-control cycles (not in the NGC list); kept for old programs.
groupOf("cycle", [73, 74, 76, 77, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89]);
groupOf("plane", [17, 18, 19]);
groupOf("units", [20, 21]);
groupOf("comp", [40, 41, 42]);
// G234 (TCPC) is group 08 with the length offsets: it replaces G43.
groupOf("length", [43, 44, 49, 234]);
groupOf("scale", [50, 51]);
groupOf("wcs", [54, 55, 56, 57, 58, 59, 154, ...Array.from({ length: 20 }, (_, i) => 110 + i)]);
groupOf("path", [61, 64]);
groupOf("rotate", [68, 69]);
groupOf("distance", [90, 91]);
groupOf("feedMode", [93, 94, 95]);
groupOf("return", [98, 99]);
groupOf("dwo", [254, 255]);
// Group 00. G09 and G187 are accepted and have no effect on the path.
groupOf("once", [4, 9, 10, 12, 13, 28, 29, 52, 53, 65, 70, 71, 72, 92, 187]);

/** M-codes with an effect, plus housekeeping accepted without one: M10–M13
 *  rotary brakes, M31/M33 conveyor, M34/M35 coolant spigot, M41/M42 gear
 *  (no gearbox), M51–M55/M61–M65 relays, M73/M74 air blast, M83/M84 air gun. */
const M_CODES = new Set([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 19, 30, 31, 33, 34, 35, 41, 42, 51, 52, 53, 54, 55, 61, 62, 63,
  64, 65, 73, 74, 83, 84, 88, 89, 97, 98, 99,
]);

/** Letters a mill block may carry besides G, M, N. No A, U, V, W on a UMC-500. */
const LETTERS = new Set("BCDEFHIJKLPQRSTXYZ");

/** Read in least increments when written without a decimal point (Setting
 *  162 OFF); R and Q are treated like X (gcode.md §4.4). */
const INCREMENT_LETTERS = new Set("XYZABCEIJKRQ");
/** G65 arguments scaled the same way (gcode.md §3.22); D E F H L M S T are as written. */
const G65_INCREMENT_LETTERS = new Set("ABCIJKQRUVWXYZ");

/** G65 argument letters -> local variables (argument specification I). */
const G65_ARGS: Record<string, number> = {
  A: 1, B: 2, C: 3, I: 4, J: 5, K: 6, D: 7, E: 8, F: 9, H: 11, M: 13, Q: 17, R: 18, S: 19, T: 20,
  U: 21, V: 22, W: 23, X: 24, Y: 25, Z: 26,
};

const ALL_AXES: readonly Axis[] = ["x", "y", "z", "b", "c"];
const MACHINE_FRAME: Frame = { mode: "plain", base: [0, 0, 0], shift: [0, 0, 0], rotary: { b: 0, c: 0 }, length: 0 };
const ZERO5: MachinePosition = { x: 0, y: 0, z: 0, b: 0, c: 0 };

const xyz = (p: MachinePosition): Vec3 => [p.x, p.y, p.z];
const isRotary = (axis: Axis) => axis === "b" || axis === "c";
const pad = (n: number, width: number) => String(n).padStart(width, "0");
const codeText = (g: number) => (Number.isInteger(g) ? pad(g, 2) : String(g));

function cloneSetup(setup: NcSetup): NcSetup {
  const workOffsets: NcSetup["workOffsets"] = {};
  for (const [k, v] of Object.entries(setup.workOffsets)) workOffsets[k] = { ...v };
  const tools: NcSetup["tools"] = {};
  for (const [k, v] of Object.entries(setup.tools)) tools[Number(k)] = { ...v };
  return { ...setup, workOffsets, tools, start: { ...setup.start } };
}

class Run {
  private setup: NcSetup;
  private readonly tolerance: number;
  private readonly blockDelete: boolean;
  private readonly optionalStop: boolean;
  private readonly defaultToFloat: boolean;
  private readonly integerFeed: "default" | "integer";
  private readonly followTool: boolean;

  // Output.
  private motions: Motion[] = [];
  private diagnostics: Diagnostic[] = [];
  private toolsUsed: number[] = [];
  private seconds = 0;
  private ended = false;
  private warned = new Set<string>();
  private codes: NcResult["codes"] = [];

  // Execution.
  private frames: CallFrame[];
  private globals = new Map<number, Value>();
  private parsed = new Map<string, ParsedProgram>();
  private line = 0;
  private blockNo = 0;
  private executed = 0;
  private lastWord: Record<string, number> = {};

  // Position. `pos` is the last emitted machine position (it trails `prog`
  // while cutter compensation holds a move); `prog` is the programmed
  // position in mm/deg, before scaling and rotation.
  private pos: MachinePosition;
  private prog: MachinePosition;
  private g29Point: MachinePosition | null = null;

  // Modal state.
  private motion: ModalState["motion"] = "G00";
  private cycle: CannedCycle = "G80";
  private cycleInitial = 0;
  private cycleWords: { z?: number; r?: number; q?: number; i?: number; j?: number; k?: number; p?: number } = {};
  private plane: Plane = "G17";
  private distanceMode: ModalState["distance"] = "G90";
  private feedMode: ModalState["feedMode"] = "G94";
  private readonly units: ModalState["units"];
  private compMode: ModalState["cutterComp"] = "G40";
  private lengthComp: ModalState["toolLength"] = "G49";
  private returnLevel: ModalState["returnLevel"] = "G98";
  private wcsKey = "G54";
  private wcsLabel = "G54";
  private pathMode: ModalState["pathMode"] = "G64";
  private transform: Transform = IDENTITY;
  private dwo = false;
  private shift52: MachinePosition = { ...ZERO5 };
  private shift92: MachinePosition = { ...ZERO5 };
  private F = 0;
  private fInBlock = false;
  private rpm = 0;
  private spindle: ModalState["spindle"] = "stop";
  /** Last M03/M04/M05: canned cycles run the spindle that way (gcode.md §3.25). */
  private spindleCommand: ModalState["spindle"] | null = null;
  private flood = false;
  private tsc = false;
  private tool: number;
  private nextTool: number | undefined;
  private h = 0;
  private d = 0;
  private tapDir: "cw" | "ccw" = "cw";
  private tapReversed = false;

  private comp: CutterComp<SegData, NcEvent>;

  constructor(main: ParsedProgram, setup: NcSetup) {
    this.setup = cloneSetup(setup);
    const options = setup.options ?? {};
    this.tolerance = options.chordTolerance ?? CHORD_TOLERANCE;
    this.blockDelete = options.blockDelete ?? false;
    this.optionalStop = options.optionalStop ?? false;
    this.defaultToFloat = options.defaultToFloat ?? false;
    this.integerFeed = options.integerFeed ?? "default";
    this.followTool = options.toolOffsets === "follow-tool";
    this.units = options.metricDefault === false ? "G20" : "G21";
    for (const [n, v] of Object.entries(options.variables ?? {})) this.globals.set(Number(n), v);
    this.tool = setup.toolInSpindle;
    if (this.followTool && this.setup.tools[this.tool]) {
      this.lengthComp = "G43";
      this.h = this.tool;
    }
    this.frames = [{ program: main, start: 0, pc: 0, locals: new Map(), repeats: 0, kind: "main" }];
    this.pos = { ...setup.start };
    this.prog = this.inverse(this.pos);
    this.comp = new CutterComp<SegData, NcEvent>({
      seg: (s) => this.emitSeg(s),
      event: (e) => this.push(e),
      alarm: (key, line, detail) => this.fail(key, detail, line),
    });
  }

  run(): NcResult {
    this.logCodes();
    try {
      while (!this.ended) {
        this.step();
        this.logCodes();
      }
    } catch (e) {
      if (e instanceof NcAlarm) this.diagnostics.push(e.diagnostic);
      else if (e instanceof MacroError) this.diagnostics.push(this.alarmDiagnostic("macro", e.message, this.line));
      else this.diagnostics.push(this.alarmDiagnostic("internal", String(e), this.line));
      // Moves read before the alarm still ran; release the one comp was holding.
      try {
        this.comp.flush();
      } catch {
        // The first alarm is the one that stopped the program.
      }
    }
    return this.result();
  }

  // --- execution loop --------------------------------------------------------

  private get top(): CallFrame {
    return this.frames[this.frames.length - 1];
  }

  private step() {
    const f = this.top;
    if (++this.executed > MAX_BLOCKS) {
      this.fail("runaway", `more than ${MAX_BLOCKS} blocks executed — an endless loop?`);
    }
    const index = f.pc;
    const block = f.program.blocks[index];
    if (!block || (block.o !== undefined && index !== f.start)) return this.endOfText(f);
    f.pc++;
    this.line = block.line;
    this.blockNo++;
    if (block.o !== undefined) return;
    if (block.optional && this.blockDelete) return;
    if (block.error) this.fail("addressFormat", block.error);
    try {
      if (block.statement) this.statement(f, index, block.statement, block);
      else this.words(this.evaluateWords(block.words), block);
    } catch (e) {
      if (e instanceof MacroError) this.fail("macro", e.message);
      throw e;
    }
  }

  /** Running off the end of a program (or into the next O line). */
  private endOfText(f: CallFrame) {
    if (f.kind === "main") {
      this.warn(WARNINGS.noM30);
      return this.finish(false);
    }
    this.line = f.program.blocks[Math.min(f.pc, f.program.blocks.length) - 1]?.line ?? this.line;
    this.fail("programEnd", `${f.name ?? "the subprogram"} ended without M99`);
  }

  private evaluateWords(words: Word[]): W[] {
    const out: W[] = [];
    for (const w of words) {
      if (w.optional && this.blockDelete) continue;
      const v = typeof w.value === "number" ? w.value : evaluate(w.value, (n) => this.readVar(n));
      // A word whose variable is vacant is left out, as on Fanuc.
      if (v === null) continue;
      out.push({ letter: w.letter, v, raw: v, decimal: w.decimal });
    }
    return out;
  }

  /** Least input increment for a word written without a decimal point. */
  private increment(letter: string) {
    if (letter === "A" || letter === "B" || letter === "C") return 0.001;
    return this.units === "G20" ? 0.0001 : 0.001;
  }

  /** Applies Settings 162 and 77 to integer literals (G65 arguments follow
   *  their own table, and their F is taken as written). */
  private realValue(w: W, g65: boolean): W {
    if (w.decimal || w.v === 0) return w;
    if ((g65 ? G65_INCREMENT_LETTERS : INCREMENT_LETTERS).has(w.letter) && !this.defaultToFloat) {
      const v = w.v * this.increment(w.letter);
      this.warnOnce("int-word", `${w.letter}${w.v} ${WARNINGS.integerWord}: ${w.letter}${+v.toFixed(4)}`);
      return { ...w, v };
    }
    if (w.letter === "F" && !g65 && this.integerFeed === "default") {
      const v = w.v * (this.units === "G20" ? 0.0001 : 0.001);
      this.warnOnce("int-feed", `F${w.v} ${WARNINGS.integerFeed}: F${+v.toFixed(4)}`);
      return { ...w, v };
    }
    return w;
  }

  private statement(f: CallFrame, index: number, s: Statement, block: Block): void {
    const read = (n: number) => this.readVar(n);
    switch (s.kind) {
      case "assign":
        return this.writeVar(variableIndex(evaluate(s.target, read)), evaluate(s.value, read), block);
      case "if-goto":
        if (truthy(evaluate(s.cond, read))) this.goto(f, evaluate(s.target, read) ?? 0);
        return;
      case "if-then":
        if (!truthy(evaluate(s.cond, read))) return;
        if (s.then.kind === "words") return this.words(this.evaluateWords(s.then.words), block);
        return this.statement(f, index, s.then, block);
      case "goto":
        return this.goto(f, evaluate(s.target, read) ?? 0);
      case "while":
        if (!truthy(evaluate(s.cond, read))) f.pc = f.program.loops.whileToEnd[index] + 1;
        return;
      case "end":
        f.pc = f.program.loops.endToWhile[index];
        return;
      case "ignored":
        return;
    }
  }

  /** The O-program region around block `index`: GOTO and M97 stay inside it. */
  private region(program: ParsedProgram, index: number): [number, number] {
    let start = 0;
    let end = program.blocks.length;
    program.blocks.forEach((b, i) => {
      if (b.o === undefined) return;
      if (i <= index) start = i;
      else if (i < end) end = i;
    });
    return [start, end];
  }

  /** Block N`n`, searched forward from `from` and then from the top. */
  private findN(program: ParsedProgram, n: number, from: number): number {
    const [start, end] = this.region(program, from);
    for (let i = from; i < end; i++) if (program.blocks[i].n === n) return i;
    for (let i = start; i < from; i++) if (program.blocks[i].n === n) return i;
    return -1;
  }

  private goto(f: CallFrame, n: number) {
    const i = this.findN(f.program, Math.round(n), Math.min(f.pc, f.program.blocks.length - 1));
    if (i < 0) this.fail("lineNotFound", `N${Math.round(n)} not found`);
    f.pc = i;
  }

  // --- a block of words --------------------------------------------------------

  private words(raw: W[], block: Block) {
    const g = new Map<Group, number>();
    const once: number[] = [];
    let m: number | undefined;
    const a: Words = {};
    const isG65 = raw.some((w) => w.letter === "G" && Math.round(w.v) === 65);
    for (const word of raw) {
      if (word.letter === "G") {
        const code = Math.round(word.v * 10) / 10;
        const group = G_GROUP[code];
        if (group === undefined) this.fail("invalidG", `G${codeText(code)} is not supported`);
        if (group === "once") once.push(code);
        else if (g.has(group) && g.get(group) !== code) {
          this.fail("multipleCodes", `G${codeText(g.get(group)!)} and G${codeText(code)} are in the same group`);
        } else g.set(group, code);
      } else if (word.letter === "M") {
        // One M-code per block (mcode.md §1).
        if (m !== undefined) this.fail("multipleCodes", "only one M-code is allowed per block");
        m = Math.round(word.v);
        if (!isG65 && !M_CODES.has(m)) this.fail("undefinedM", `M${pad(m, 2)} is not supported`);
      } else if (word.letter !== "N") {
        if (a[word.letter]) this.fail("multipleCodes", `${word.letter} appears twice in the block`);
        const w = this.realValue(word, isG65);
        a[w.letter] = w;
        this.lastWord[w.letter] = w.v;
      }
    }
    // "G00 G80" is a normal safe-start pair; a drilling cycle with G00–G03 is not.
    if (g.has("motion") && g.has("cycle") && g.get("cycle") !== 80) {
      this.fail("multipleCodes", `G${codeText(g.get("motion")!)} and G${g.get("cycle")} in one block`);
    }
    if (isG65) return this.macroCall(a, m);
    for (const letter of Object.keys(a)) {
      if (!LETTERS.has(letter)) {
        this.fail("unknownCode", letter === "A" ? "A: the UMC-500 has no A axis" : `${letter} is not a mill address`);
      }
    }

    // Values first (gcode.md §4.3 order), then the mode codes, group 00,
    // motion, and the M-code last, after the motion.
    if (g.has("units")) this.checkUnits(g.get("units")!);
    if (g.has("feedMode")) this.feedMode = `G${g.get("feedMode")}` as ModalState["feedMode"];
    if (a.F) {
      if (a.F.v < 0) this.fail("addressFormat", "F cannot be negative");
      this.F = a.F.v;
    }
    this.fInBlock = !!a.F;
    if (a.S) this.setSpeed(a.S.v);
    if (a.T) {
      if (!Number.isInteger(a.T.v) || a.T.v < 1 || a.T.v > MAX_TOOL_NUMBER) {
        this.fail("invalidTool", `T${a.T.v} is outside 1 to ${MAX_TOOL_NUMBER}`);
      }
      this.nextTool = a.T.v;
    }

    if (g.has("plane")) this.setPlane(`G${g.get("plane")}` as Plane);
    if (g.has("distance")) this.distanceMode = g.get("distance") === 90 ? "G90" : "G91";
    if (g.has("return")) this.returnLevel = g.get("return") === 98 ? "G98" : "G99";
    if (g.has("wcs")) this.selectWorkOffset(g.get("wcs")!, a.P);
    if (g.has("path")) this.pathMode = g.get("path") === 61 ? "G61" : "G64";
    if (g.has("scale") && g.get("scale") === 50) this.reframe(() => (this.transform = { ...this.transform, scaling: null }));
    if (g.has("rotate") && g.get("rotate") === 69) this.setRotation(false, a);
    if (g.has("dwo")) this.setDwo(g.get("dwo") === 254);
    if (g.has("length") || a.H) this.setLength(g.get("length"), a.H);
    if (g.has("comp") || a.D) this.setComp(g.get("comp"), a.D);

    // Group 00, and G51/G68, take the block's axis words: no move with them.
    let consumed = false;
    if (g.get("scale") === 51) consumed = this.setScaling(a);
    if (g.get("rotate") === 68) consumed = this.setRotation(true, a);
    for (const code of once) {
      if (code === 9 || code === 187) continue;
      consumed = true;
      if (code === 4) this.dwell(a.P);
      else if (code === 10) this.g10(a);
      else if (code === 12 || code === 13) this.pocket(code === 13, a);
      else if (code === 28) this.g28(a);
      else if (code === 29) this.g29(a);
      else if (code === 52) this.g52(a);
      else if (code === 53) this.g53(a, g.get("motion"));
      else if (code === 70 || code === 71 || code === 72) this.boltPattern(code, a);
      else if (code === 92) this.g92(a);
    }

    if (g.has("cycle")) {
      const code = g.get("cycle")!;
      if (code === 80) this.cancelCycle();
      else {
        // The initial point is where Z was when the cycle mode began.
        if (this.cycle === "G80") {
          this.cycleInitial = this.prog.z;
          this.cycleWords = {};
        }
        this.cycle = `G${code}` as CannedCycle;
        if (code === 87 || code === 88) this.warnOnce("g87", WARNINGS.classicCycle);
      }
    }
    if (g.has("motion")) {
      this.motion = `G${pad(g.get("motion")!, 2)}` as ModalState["motion"];
      // G00–G03 cancel a canned cycle (G02/G03: Fanuc convention).
      this.cancelCycle();
    }

    if (!consumed) {
      const axes = !!(a.X || a.Y || a.Z || a.B || a.C);
      if (this.cycle !== "G80") {
        this.cycleBlock(a, g.has("cycle"));
      } else if ((this.motion === "G00" || this.motion === "G01") && axes) {
        this.linearMove(this.target(a), this.motion === "G00");
      } else if ((this.motion === "G02" || this.motion === "G03") && (axes || a.I || a.J || a.K)) {
        this.arcWords(a, this.motion === "G03");
      }
    }

    if (m !== undefined) this.mCode(m, a, block);
  }

  // --- modal settings ----------------------------------------------------------

  private get unit() {
    return this.units === "G20" ? MM_PER_INCH : 1;
  }

  private mm(v: number) {
    return v * this.unit;
  }

  /** G20/G21 only check Setting 9; they do not switch units (gcode.md §3.9). */
  private checkUnits(code: number) {
    if (code === 20 && this.units !== "G20") this.fail("inchNotSelected", "G20 with Setting 9 = MM");
    if (code === 21 && this.units !== "G21") this.fail("metricNotSelected", "G21 with Setting 9 = INCH");
  }

  /** P as a time: with a decimal point it is seconds, without it
   *  milliseconds (G04 P1.5 = P1500). Values from variables have a point. */
  private pSeconds(w: W) {
    return w.decimal ? w.v : w.v / 1000;
  }

  /** Moves the programmed position so the machine does not move while the
   *  mapping between them changes (offsets, length comp, rotation, …). */
  private reframe(change: () => void) {
    const m = this.forward(this.prog);
    change();
    this.prog = this.inverse(m);
  }

  private workOffset(): MachinePosition {
    return { ...ZERO5, ...this.setup.workOffsets[this.wcsKey] };
  }

  private toolLengthOf(h: number) {
    const t = h === 0 ? undefined : this.setup.tools[h];
    return t ? t.length + (t.lengthWear ?? 0) : 0;
  }

  private frame(): Frame {
    const off = this.workOffset();
    const L = this.toolLengthOf(this.h);
    const length = this.lengthComp === "G44" ? -L : this.lengthComp === "G49" ? 0 : L;
    const mode = this.lengthComp === "G234" ? "tcp" : this.dwo ? "dwo" : "plain";
    const rotary = { b: off.b + this.shift52.b + this.shift92.b, c: off.c + this.shift52.c + this.shift92.c };
    if (mode !== "plain" && Math.abs(rotary.b) > 1e-9) {
      this.fail("dwoBOffset", `${this.wcsLabel} B is ${rotary.b}; G254/G234 need a B work offset of 0`);
    }
    return {
      mode,
      base: [off.x, off.y, off.z],
      shift: [this.shift52.x + this.shift92.x, this.shift52.y + this.shift92.y, this.shift52.z + this.shift92.z],
      rotary,
      length,
    };
  }

  private forward(p: MachinePosition): MachinePosition {
    return frameToMachine(this.frame(), toPart(this.transform, xyz(p)), p.b, p.c);
  }

  private inverse(m: MachinePosition): MachinePosition {
    const { part, b, c } = machineToFrame(this.frame(), m);
    const [x, y, z] = fromPart(this.transform, part);
    return { x, y, z, b, c };
  }

  private setPlane(plane: Plane) {
    if (this.transform.rotation && plane !== this.plane) {
      this.fail("planeInG68", "cancel rotation (G69) before changing the plane");
    }
    if (this.compMode !== "G40" && plane !== "G17") this.fail("compPlane", "cutter compensation is active");
    this.plane = plane;
  }

  private selectWorkOffset(code: number, p?: W) {
    let key: string;
    let label: string;
    if (code >= 54 && code <= 59) key = label = `G${code}`;
    else {
      // G110–G129 are G154 P1–P20 under another name.
      const n = code === 154 ? p?.v : code - 109;
      if (n === undefined || !Number.isInteger(n) || n < 1 || n > 99) this.fail("invalidG", "G154 needs P1 to P99");
      key = `G154P${n}`;
      label = `G154 P${n}`;
    }
    this.reframe(() => {
      this.wcsKey = key;
      this.wcsLabel = label;
    });
  }

  /** G43/G44 Hn, G49, G234 Hn. H00 cancels like G49. Classic NGC: the offset
   *  applies from the next Z move (the position display changes at once). */
  private setLength(code: number | undefined, hWord?: W) {
    if (hWord && (!Number.isInteger(hWord.v) || hWord.v < 0 || hWord.v > MAX_TOOL_NUMBER)) {
      this.fail("addressFormat", `H${hWord.v} is not an offset number`);
    }
    let next: ModalState["toolLength"] =
      code === undefined ? this.lengthComp : code === 43 ? "G43" : code === 44 ? "G44" : code === 49 ? "G49" : "G234";
    const h = hWord ? hWord.v : this.h;
    if (next === "G234") {
      if (!hWord || h === 0) this.fail("offsetEmpty", "G234 needs its H in the same block");
      if (this.dwo) this.fail("tcpcDwo", "G234 cannot be active with G254 — G255 first");
      if (this.compMode !== "G40") this.fail("notSupported", "G234 with G41/G42 (3D cutter comp is not simulated)");
    }
    if ((next === "G43" || next === "G44") && h === 0) next = "G49";
    if (next !== "G49") {
      if (!this.setup.tools[h]) this.fail("offsetEmpty", `H${pad(h, 2)} has no tool length in the offset table`);
      if (code !== undefined || hWord) {
        if (this.toolLengthOf(h) === 0) this.warn(`H${pad(h, 2)}: ${WARNINGS.zeroOffset}`);
        if (h !== this.tool) this.warnOnce(`h${h}t${this.tool}`, `H${pad(h, 2)} with T${this.tool} in the spindle: ${WARNINGS.hMismatch}`);
      }
    }
    this.reframe(() => {
      this.lengthComp = next;
      this.h = h;
    });
  }

  private setDwo(on: boolean) {
    if (on && this.lengthComp === "G234") this.fail("tcpcDwo", "G254 cannot be active with G234");
    this.reframe(() => (this.dwo = on));
  }

  /** Cutter radius of offset row `d`: geometry + wear, halved (Setting 40 =
   *  DIAMETER, the Haas default). */
  private compRadius(d: number) {
    if (d === 0) return 0;
    const t = this.setup.tools[d];
    if (!t) this.fail("offsetEmpty", `D${pad(d, 2)} has no tool diameter in the offset table`);
    return (t.diameter + (t.diameterWear ?? 0)) / 2;
  }

  private setComp(code: number | undefined, dWord?: W) {
    if (dWord) {
      if (!Number.isInteger(dWord.v) || dWord.v < 0 || dWord.v > MAX_TOOL_NUMBER) {
        this.fail("addressFormat", `D${dWord.v} is not an offset number`);
      }
      this.d = dWord.v;
    }
    const next: ModalState["cutterComp"] = code === undefined ? this.compMode : code === 40 ? "G40" : code === 41 ? "G41" : "G42";
    if (next === "G40") {
      if (code === 40) this.comp.cancel();
    } else {
      if (this.plane !== "G17") this.fail("compPlane", "G41/G42 work in the XY plane (G17) only");
      if (this.lengthComp === "G234") this.fail("notSupported", "G41/G42 with G234 TCPC (3D cutter comp is not simulated)");
      const r = this.compRadius(this.d);
      if (r === 0) this.warnOnce(`d0-${this.d}`, `D${pad(this.d, 2)}: ${WARNINGS.zeroOffset}`);
      this.comp.start(next === "G41" ? r : -r);
    }
    this.compMode = next;
  }

  /** G51 X Y Z (centre, default the current position) P (one factor for all
   *  axes; default Setting 71 = 1). Offsets and peck depths are not scaled. */
  private setScaling(a: Words): boolean {
    const center = this.target(a, "XYZ");
    const factor = a.P ? a.P.v : 1;
    if (!(factor >= 0.001 && factor <= 999.999)) this.fail("addressFormat", "G51 P must be 0.001 to 999.999");
    this.reframe(() => (this.transform = { ...this.transform, scaling: { center: xyz(center), factor } }));
    return true;
  }

  /** G68: rotation in the active plane about the programmed centre (default
   *  the current position) by R degrees, CCW positive (Setting 72 = 0 when R
   *  is missing). Comp must go on after it and off before G69. */
  private setRotation(on: boolean, a: Words): boolean {
    if (this.compMode !== "G40") this.fail("notSupported", "G68/G69 with cutter compensation active");
    if (!on) {
      this.reframe(() => (this.transform = { ...this.transform, rotation: null }));
      return false;
    }
    const letters = PLANE_AXES[this.plane].slice(0, 2).map((i) => "XYZ"[i]).join("");
    const center = this.target(a, letters);
    const radians = ((a.R?.v ?? 0) * Math.PI) / 180;
    this.reframe(() => {
      this.transform = { ...this.transform, rotation: { center: xyz(center), axis: planeNormal(this.plane), radians } };
    });
    return true;
  }

  // --- spindle, coolant, tools -------------------------------------------------

  private setSpeed(s: number) {
    if (s < 0) this.fail("addressFormat", "S cannot be negative");
    if (s > MAX_SPINDLE_RPM) {
      this.warn(WARNINGS.rpmClamped);
      s = MAX_SPINDLE_RPM;
    }
    const changed = s !== this.rpm;
    this.rpm = s;
    if (changed && this.spindle !== "stop") this.event({ kind: "spindle", rpm: s, dir: this.spindle });
  }

  /** Runs or stops the spindle. `command` marks a programmed M03/M04/M05. */
  private runSpindle(dir: ModalState["spindle"], command = false) {
    if (command) this.spindleCommand = dir;
    if (dir !== "stop" && this.rpm <= 0) this.warn(WARNINGS.spindleNoS);
    if (dir === this.spindle) return;
    this.spindle = dir;
    this.event({ kind: "spindle", rpm: dir === "stop" ? 0 : this.rpm, dir });
  }

  private setCoolant(flood: boolean, tsc: boolean) {
    const was = this.flood || this.tsc;
    this.flood = flood;
    this.tsc = tsc;
    if (was !== (flood || tsc)) this.event({ kind: "coolant", on: flood || tsc });
  }

  /**
   * M06 (mcode.md §5.3): stop spindle and coolant, Z to machine zero (X and Y
   * stay; Setting 247 OFF), orient, swap. The spindle and coolant are not
   * restarted — the program commands S/M03 and M08 again. Requesting the tool
   * already in the spindle does nothing. M06 ignores G234/G254.
   */
  private toolChange(tWord?: W) {
    if (this.cycle !== "G80") this.fail("toolChangeInCycle", "cancel the canned cycle (G80) before M06");
    const t = tWord ? tWord.v : this.nextTool;
    if (t === undefined) this.fail("noToolOnM06", "program the tool with M06 (T1 M06)");
    if (!this.setup.tools[t]) this.fail("toolNotInTable", `T${t} is not in the tool table`);
    this.comp.flush();
    if (t === this.tool) return;
    this.runSpindle("stop");
    this.setCoolant(false, false);
    if (Math.abs(this.pos.z) > 1e-9) this.machineMove({ ...this.pos, z: 0 }, true);
    this.event({ kind: "toolChange", tool: t, seconds: TOOL_CHANGE_SECONDS });
    this.tool = t;
    if (!this.toolsUsed.includes(t)) this.toolsUsed.push(t);
    if (this.followTool && this.lengthComp !== "G234") {
      this.lengthComp = "G43";
      this.h = t;
    }
    this.prog = this.inverse(this.pos);
  }

  /** The block's M-code, after its motion (mcode.md §1–2). */
  private mCode(m: number, a: Words, block: Block) {
    switch (m) {
      case 0:
      case 1:
        if (this.compMode !== "G40") this.fail("compAtStop", "cancel G41/G42 with G40 before M00/M01");
        // M00, and M01 with OPTION STOP on, stop the spindle and all coolant.
        if (m === 0 || this.optionalStop) {
          this.runSpindle("stop");
          this.setCoolant(false, false);
        }
        return this.event({ kind: "stop", optional: m === 1 });
      case 2:
      case 30:
        return this.finish(true);
      case 3:
        return this.runSpindle("cw", true);
      case 4:
        return this.runSpindle("ccw", true);
      case 5:
        return this.runSpindle("stop", true);
      case 6:
      case 16:
        return this.toolChange(a.T);
      case 7:
      case 8:
        return this.setCoolant(true, this.tsc);
      case 9:
        return this.setCoolant(false, this.tsc);
      case 19:
        return this.runSpindle("stop");
      case 88:
      case 89: {
        // The control stops the spindle to switch through-spindle coolant and
        // restarts it only after M88.
        const was = this.spindle;
        this.runSpindle("stop");
        this.setCoolant(this.flood, m === 88);
        if (m === 88 && was !== "stop") this.runSpindle(was);
        return;
      }
      case 97:
        return this.call("local", a.P, a.L);
      case 98:
        return this.call("sub", a.P, a.L);
      case 99:
        return this.m99(a.P, block);
    }
  }

  private dwell(p?: W) {
    if (!p) this.fail("dwellNoP", "G04 needs P (P1.5 = 1.5 s, P1500 = 1500 ms)");
    const s = this.pSeconds(p);
    if (s < 0 || s >= 1000) this.fail("dwellRange", `${s} s is outside 0 to 1000 s`);
    // P is one register shared with the canned cycles' dwell.
    if (this.cycle !== "G80") this.cycleWords.p = s;
    this.event({ kind: "dwell", seconds: s });
  }

  // --- moves -----------------------------------------------------------------

  /** The point the axis words in `letters` program, in mm/deg. */
  private target(a: Words, letters = "XYZBC"): MachinePosition {
    const t = { ...this.prog };
    const inc = this.distanceMode === "G91";
    for (const axis of ALL_AXES) {
      const w = a[axis.toUpperCase()];
      if (!w || !letters.includes(axis.toUpperCase())) continue;
      t[axis] = (inc ? this.prog[axis] : 0) + (isRotary(axis) ? w.v : this.mm(w.v));
    }
    return t;
  }

  private feedData(rapid: boolean, scaleFeed = 1): Pick<SegData, "rapid" | "feed" | "rotaryFeed" | "inverseMinutes"> {
    if (rapid) return { rapid, feed: 0, rotaryFeed: 0 };
    if (this.rpm <= 0) this.fail("noSpindleSpeed", "program S before a feed move");
    if (this.spindle === "stop") this.fail("spindleStopped", "start the spindle (M03/M04) before a feed move");
    if (this.lengthComp === "G49") this.warnOnce(`g49-${this.tool}`, `T${this.tool}: ${WARNINGS.noLengthComp}`);
    if (this.tool > 0 && !this.toolsUsed.includes(this.tool)) this.toolsUsed.push(this.tool);
    if (this.feedMode === "G93") {
      if (!this.fInBlock || !(this.F > 0)) this.fail("noFeed", "G93 inverse time needs F in every feed block");
      if (this.F > MAX_INVERSE_TIME_F) this.fail("maxFeed", `G93 F${this.F} is above F${MAX_INVERSE_TIME_F}`);
      return { rapid, feed: 0, rotaryFeed: 0, inverseMinutes: 1 / (this.F * scaleFeed) };
    }
    if (!(this.F > 0)) this.fail("noFeed", "program F before G01/G02/G03");
    const perMinute = this.feedMode === "G95" ? this.rpm : 1;
    const feed = this.F * this.unit * perMinute * scaleFeed;
    if (feed > MAX_FEED + 1e-6) {
      this.fail("maxFeed", `${feed.toFixed(0)} mm/min is above the ${MAX_FEED} mm/min maximum cutting feed`);
    }
    return { rapid, feed, rotaryFeed: this.F * perMinute * scaleFeed };
  }

  private segData(rapid: boolean, from: MachinePosition, to: MachinePosition, scaleFeed = 1): SegData {
    const known = this.setup.workOffsets[this.wcsKey];
    if (!known) this.warnOnce(`wcs-${this.wcsKey}`, `${this.wcsLabel}: ${WARNINGS.workOffsetMissing}`);
    else if (!known.x && !known.y && !known.z) this.warnOnce(`wcs-${this.wcsKey}`, `${this.wcsLabel}: ${WARNINGS.workOffsetZero}`);
    return {
      ...this.feedData(rapid, scaleFeed),
      b0: from.b,
      c0: from.c,
      b1: to.b,
      c1: to.c,
      frame: this.frame(),
      block: this.blockNo,
      program: this.top.name,
    };
  }

  private linearMove(to: MachinePosition, rapid: boolean, scaleFeed = 1) {
    const from = this.prog;
    if (ALL_AXES.every((ax) => Math.abs(to[ax] - from[ax]) < 1e-9)) return;
    if (this.comp.active && (to.b !== from.b || to.c !== from.c)) {
      this.fail("notSupported", "B/C moves with cutter compensation active");
    }
    const data = this.segData(rapid, from, to, scaleFeed);
    this.prog = to;
    this.comp.move({ from: toPart(this.transform, xyz(from)), to: toPart(this.transform, xyz(to)), line: this.line, data });
  }

  private get arcTolerance() {
    return this.units === "G20" ? ARC_TOLERANCE.inch : ARC_TOLERANCE.metric;
  }

  private arcMove(to: MachinePosition, center: Vec3, ccw: boolean, plane: Plane) {
    const from = this.prog;
    if (to.b !== from.b || to.c !== from.c) this.fail("arcXYZ", "B and C cannot move in G02/G03");
    const n = scale(planeNormal(plane), ccw ? 1 : -1);
    const programmed = arcFromCenter(xyz(from), xyz(to), center, n);
    if (programmed.r0 < 1e-6) this.fail("arcIJK", "the arc centre is on the start point");
    if (Math.abs(programmed.r0 - programmed.r1) > this.arcTolerance) {
      this.fail(
        "arcIJK",
        `start radius ${programmed.r0.toFixed(4)} and end radius ${programmed.r1.toFixed(4)} mm differ by more than ${this.arcTolerance} mm`,
      );
    }
    const data = this.segData(false, from, to);
    const t = this.transform;
    const pFrom = toPart(t, xyz(from));
    const pTo = toPart(t, xyz(to));
    const arc = arcFromCenter(pFrom, pTo, toPart(t, programmed.center), directionToPart(t, n));
    // Scaling and rotation keep the sweep; recomputing it could turn a full
    // circle into a zero-length one by rounding.
    arc.sweep = programmed.sweep;
    this.prog = to;
    this.comp.move({ from: pFrom, to: pTo, arc, line: this.line, data });
  }

  /** G02/G03 from words: I/J/K are incremental from the start point in any
   *  distance mode; R > 0 is the short way round, R < 0 the long way. With
   *  G91, L repeats the block (thread milling). */
  private arcWords(a: Words, ccw: boolean) {
    const repeats = a.L && this.distanceMode === "G91" ? a.L.v : 1;
    if (!Number.isInteger(repeats) || repeats < 0) this.fail("addressFormat", `L${repeats} must be a whole number`);
    for (let n = 0; n < repeats; n++) {
      const to = this.target(a);
      const from = xyz(this.prog);
      const [u, v] = PLANE_AXES[this.plane];
      const center: Vec3 = [...from];
      if (a.R) {
        const r = this.mm(a.R.v);
        const end = xyz(to);
        const du = end[u] - from[u];
        const dv = end[v] - from[v];
        const chord = Math.hypot(du, dv);
        if (chord < 1e-6) this.fail("arcR", "R cannot program a full circle — use I/J/K");
        const half = chord / 2;
        if (Math.abs(r) < half - this.arcTolerance) {
          this.fail("arcR", `R${Math.abs(r).toFixed(3)} is smaller than half the distance to the end point (${half.toFixed(3)})`);
        }
        const h = Math.sqrt(Math.max(0, r * r - half * half));
        // Centre left of the chord for a short CCW arc, right for a short CW one.
        const side = (ccw ? 1 : -1) * (r > 0 ? 1 : -1);
        center[u] = from[u] + du / 2 - (side * h * dv) / chord;
        center[v] = from[v] + dv / 2 + (side * h * du) / chord;
      } else if (a.I || a.J || a.K) {
        const offsets: Vec3 = [this.mm(a.I?.v ?? 0), this.mm(a.J?.v ?? 0), this.mm(a.K?.v ?? 0)];
        center[u] += offsets[u];
        center[v] += offsets[v];
      } else {
        this.fail("arcIJK", "G02/G03 needs I/J/K or R");
      }
      this.arcMove(to, center, ccw, this.plane);
    }
  }

  /** A move in machine coordinates (G53, G28, the tool change retract):
   *  work and tool offsets, G234 and G254 are ignored. */
  private machineMove(to: MachinePosition, rapid: boolean) {
    this.comp.flush();
    this.comp.move({
      from: xyz(this.pos),
      to: xyz(to),
      line: this.line,
      data: {
        ...this.feedData(rapid),
        b0: this.pos.b,
        c0: this.pos.c,
        b1: to.b,
        c1: to.c,
        frame: MACHINE_FRAME,
        block: this.blockNo,
        program: this.top.name,
      },
    });
  }

  // --- group 00 ---------------------------------------------------------------

  private requireNoComp(what: string) {
    if (this.comp.active) this.fail("notSupported", `${what} with cutter compensation active — program G40 first`);
  }

  /** G28: through the intermediate point (current coordinates, G90/G91) to
   *  machine zero on the named axes, or all axes together when none are
   *  named; rapid. The intermediate point is kept for G29. The classic
   *  control also cancelled the tool length offset; that is kept in
   *  "classic" mode (unconfirmed on NGC). */
  private g28(a: Words) {
    this.requireNoComp("G28");
    const named = ALL_AXES.filter((ax) => a[ax.toUpperCase()]);
    if (named.length > 0) this.linearMove(this.target(a), true);
    this.g29Point = { ...this.pos };
    const home = { ...this.pos };
    for (const ax of named.length > 0 ? named : ALL_AXES) home[ax] = 0;
    this.machineMove(home, true);
    if (!this.followTool && this.lengthComp !== "G234") this.lengthComp = "G49";
    this.prog = this.inverse(this.pos);
  }

  /** G29: to the G28 intermediate point on the named axes, then to the programmed point. */
  private g29(a: Words) {
    this.requireNoComp("G29");
    if (!this.g29Point) this.fail("notSupported", "G29 without an earlier G28");
    const mid = { ...this.pos };
    for (const ax of ALL_AXES) if (a[ax.toUpperCase()]) mid[ax] = this.g29Point[ax];
    this.machineMove(mid, true);
    this.prog = this.inverse(this.pos);
    this.linearMove(this.target(a), true);
  }

  /** G53: absolute machine coordinates for this block (G91 ignored), with
   *  the motion type of group 01: feed under G01, rapid otherwise. */
  private g53(a: Words, motionInBlock?: number) {
    this.requireNoComp("G53");
    const to = { ...this.pos };
    for (const ax of ALL_AXES) {
      const w = a[ax.toUpperCase()];
      if (w) to[ax] = isRotary(ax) ? w.v : this.mm(w.v);
    }
    const feed = motionInBlock === undefined ? this.motion === "G01" && this.cycle === "G80" : motionInBlock === 1;
    this.machineMove(to, !feed);
    this.prog = this.inverse(this.pos);
  }

  /** G52: shift added to every work offset; always absolute; G52 X0 Y0 Z0 clears it. */
  private g52(a: Words) {
    this.reframe(() => {
      for (const ax of ALL_AXES) {
        const w = a[ax.toUpperCase()];
        if (w) this.shift52[ax] = isRotary(ax) ? w.v : this.mm(w.v);
      }
    });
  }

  /** G92: shifts every work system so the current position reads the
   *  programmed value; it clears G52 on the axes it names. */
  private g92(a: Words) {
    if (this.transform.scaling || this.transform.rotation) this.fail("notSupported", "G92 with G51/G68 active");
    this.reframe(() => {
      for (const ax of ALL_AXES) {
        const w = a[ax.toUpperCase()];
        if (!w) continue;
        const value = isRotary(ax) ? w.v : this.mm(w.v);
        this.shift92[ax] += this.prog[ax] + this.shift52[ax] - value;
        this.shift52[ax] = 0;
      }
    });
  }

  /** G10: L2 P0 G52 / P1–P6 G54–G59, L20 P1–P99 G154, L10 length, L1/L11
   *  length wear, L12 diameter, L13 diameter wear. G91 adds to the value. */
  private g10(a: Words) {
    const L = a.L?.v;
    const P = a.P?.v;
    if (L === undefined || P === undefined || !Number.isInteger(P)) this.fail("g10", "G10 needs L and P");
    const add = this.distanceMode === "G91";
    this.reframe(() => {
      if (L === 2 || L === 20) {
        if (L === 2 && (P < 0 || P > 6)) this.fail("g10", `G10 L2 P${P}: P must be 0 to 6 (G52, G54–G59)`);
        if (L === 20 && (P < 1 || P > 99)) this.fail("g10", `G10 L20 P${P}: P must be 1 to 99`);
        const key = L === 20 ? `G154P${P}` : P === 0 ? "G52" : `G${53 + P}`;
        const offset: Partial<MachinePosition> = key === "G52" ? { ...this.shift52 } : { ...this.setup.workOffsets[key] };
        for (const ax of ALL_AXES) {
          const w = a[ax.toUpperCase()];
          if (!w) continue;
          offset[ax] = (add ? (offset[ax] ?? 0) : 0) + (isRotary(ax) ? w.v : this.mm(w.v));
        }
        if (key === "G52") this.shift52 = { ...ZERO5, ...offset };
        else {
          this.setup.workOffsets[key] = offset;
          this.event({ kind: "workOffset", key, value: { ...offset } });
        }
      } else if (L === 1 || (L >= 10 && L <= 13)) {
        if (!a.R) this.fail("g10", `G10 L${L} needs R (the value)`);
        if (P < 1 || P > MAX_TOOL_NUMBER) this.fail("g10", `G10 L${L} P${P}: P must be 1 to ${MAX_TOOL_NUMBER}`);
        const field = L === 1 ? "lengthWear" : (["length", "lengthWear", "diameter", "diameterWear"] as const)[L - 10];
        const entry = { ...(this.setup.tools[P] ?? { number: P, length: 0, diameter: 0 }) };
        entry[field] = (add ? (entry[field] ?? 0) : 0) + this.mm(a.R.v);
        this.setup.tools[P] = entry;
        this.event({ kind: "toolOffset", entry: { ...entry } });
      } else this.fail("g10", `G10 L${L} is not supported`);
    });
  }

  // --- canned cycles, pockets, bolt patterns ------------------------------------

  private cancelCycle() {
    this.cycle = "G80";
    this.cycleWords = {};
  }

  /**
   * A block while a cycle is active (gcode.md §3.25): new Z/R/Q/… replace the
   * stored ones; the definition block (Setting 28 ON) and every block with X
   * or Y drill, L times (in G91 stepping by X/Y each time); L0 only stores.
   * A rotary-only block positions B/C without drilling.
   */
  private cycleBlock(a: Words, defining: boolean) {
    const c = this.cycleWords;
    if (a.Z) c.z = this.mm(a.Z.v);
    if (a.R) c.r = this.mm(a.R.v);
    if (a.Q) c.q = Math.abs(this.mm(a.Q.v));
    if (a.I) c.i = this.mm(a.I.v);
    // Tap J is a retract multiple (J2 = twice the in-feed), not a length.
    if (a.J) c.j = this.cycle === "G74" || this.cycle === "G84" ? a.J.raw : this.mm(a.J.v);
    if (a.K) c.k = this.mm(a.K.v);
    if (a.P) c.p = this.pSeconds(a.P);
    const L = a.L ? a.L.v : 1;
    if (!Number.isInteger(L) || L < 0) this.fail("addressFormat", `L${L} must be a whole number`);
    if (!defining && !a.X && !a.Y) {
      if (a.B || a.C) this.linearMove(this.target(a, "BC"), true);
      return;
    }
    if (L === 0) return;
    this.requireNoComp("A canned cycle");
    if (this.plane !== "G17") this.fail("cycle", "canned cycles run in G17 only");
    if (this.feedMode === "G93") this.fail("notInG93", `${this.cycle} in G93 inverse-time mode`);
    for (let n = 0; n < L; n++) {
      const at = this.target(a, "XYBC");
      this.drill(at.x, at.y, at.b, at.c);
    }
  }

  /** One hole of the active cycle. In G91, R is from the initial point (R0
   *  when missing) and Z from R. */
  private drill(x: number, y: number, b: number, c: number) {
    const w = this.cycleWords;
    if (w.z === undefined) this.fail("cycle", `${this.cycle} needs Z (the hole depth)`);
    const inc = this.distanceMode === "G91";
    if (w.r === undefined && !inc) this.fail("cycle", `${this.cycle} needs R (the R plane)`);
    const initial = this.cycleInitial;
    const r = inc ? initial + (w.r ?? 0) : w.r!;
    const bottom = inc ? r + w.z : w.z;
    const retract = this.returnLevel === "G98" ? initial : r;
    if (b !== this.prog.b || c !== this.prog.c) this.linearMove({ ...this.prog, b, c }, true);
    const tapping = this.cycle === "G74" || this.cycle === "G84";
    const bore = this.cycle === "G76" || this.cycle === "G77";
    if (!tapping) this.cycleSpindle();
    this.tapDir = this.cycle === "G74" ? "ccw" : "cw";
    const params: CycleParams = {
      q: bore ? undefined : w.q,
      i: bore ? undefined : w.i,
      j: bore || tapping ? undefined : w.j,
      k: w.k,
      p: w.p,
      // G76/G77: Q in the Setting 27 direction (X+ assumed), else I/J.
      shift: bore ? (w.q !== undefined ? [w.q, 0] : [w.i ?? 0, w.j ?? 0]) : [0, 0],
      retract: tapping ? w.j : undefined,
    };
    const cycle = this.cycle as Exclude<CannedCycle, "G80">;
    this.runSteps(holeSteps(cycle, x, y, { initial, r, bottom, retract }, params, CAN_CYCLE_DELTA_Z, this.failer()));
  }

  /** Cycles run the last spindle command; with none yet, M03 is assumed. After
   *  an explicit M05 Haas would run "no-spin" — the simulator alarms on the
   *  first feed instead. */
  private cycleSpindle() {
    if (this.spindle !== "stop" || this.spindleCommand === "stop") return;
    if (this.rpm <= 0) this.fail("noSpindleSpeed", "program S before the canned cycle");
    this.runSpindle(this.spindleCommand ?? "cw");
  }

  private pocket(ccw: boolean, a: Words) {
    this.requireNoComp(ccw ? "G13" : "G12");
    if (this.plane !== "G17") this.fail("pocketIJK", "G12/G13 run in G17 only");
    if (this.feedMode === "G93") this.fail("notInG93", `${ccw ? "G13" : "G12"} in G93 inverse-time mode`);
    if (!a.I) this.fail("pocketIJK", "I (radius) is required");
    // With no D, the last D commanded is used, even one cancelled by G40.
    const d = a.D ? a.D.v : this.d;
    if (a.D) this.d = d;
    const loops = a.L ? a.L.v : 1;
    if (!Number.isInteger(loops) || loops < 1) this.fail("pocketIJK", `L${loops} must be a whole number from 1`);
    const steps = pocketSteps(
      [this.prog.x, this.prog.y],
      this.prog.z,
      {
        i: this.mm(a.I.v),
        k: a.K ? this.mm(a.K.v) : undefined,
        q: a.Q ? this.mm(a.Q.v) : undefined,
        z: a.Z ? this.mm(a.Z.v) : undefined,
        loops,
        incremental: this.distanceMode === "G91",
        toolRadius: this.compRadius(d),
        ccw,
      },
      this.failer(),
    );
    this.runSteps(steps);
  }

  private boltPattern(code: 70 | 71 | 72, a: Words) {
    if (this.cycle === "G80") this.fail("cycle", `G${code} needs an active canned cycle (G81, G83, …)`);
    if (this.feedMode === "G93") this.fail("notInG93", `G${code} in G93 inverse-time mode`);
    if (!a.I || !a.L) this.fail("cycle", `G${code} needs I and L`);
    if (code === 71 && !a.K) this.fail("cycle", "G71 needs K (angle between holes)");
    this.requireNoComp(`G${code}`);
    const holes = boltHoles(code, [this.prog.x, this.prog.y], {
      i: this.mm(a.I.v),
      j: a.J?.v ?? 0,
      k: a.K?.v ?? 0,
      l: Math.round(a.L.v),
    });
    for (const [x, y] of holes) this.drill(x, y, this.prog.b, this.prog.c);
  }

  private runSteps(steps: Step[]) {
    for (const s of steps) {
      switch (s.kind) {
        case "rapid":
        case "feed": {
          const to = { ...this.prog, x: s.x ?? this.prog.x, y: s.y ?? this.prog.y, z: s.z ?? this.prog.z };
          this.linearMove(to, s.kind === "rapid", s.scale);
          break;
        }
        case "arc":
          this.arcMove({ ...this.prog, x: s.x, y: s.y }, [s.cx, s.cy, this.prog.z], s.ccw, "G17");
          break;
        case "dwell":
          this.event({ kind: "dwell", seconds: s.seconds });
          break;
        case "stop":
          this.event({ kind: "stop", optional: false });
          break;
        case "spindle":
          this.spindleStep(s.action);
          break;
      }
    }
  }

  /** Spindle actions inside cycles. G74/G84 run the spindle themselves (no
   *  M03/M04 needed) but need an S speed. */
  private spindleStep(action: "orient" | "restore" | "tap" | "reverse") {
    // `spindle` is the commanded state; reverse and orient change only the
    // physical one, and the next tap/restore step puts it back.
    if (action === "tap") {
      if (this.rpm <= 0) this.fail("noSpindleSpeed", "tapping needs a spindle speed (S)");
      if (this.tapReversed) this.event({ kind: "spindle", rpm: this.rpm, dir: this.tapDir });
      else this.runSpindle(this.tapDir);
      this.tapReversed = false;
    } else if (action === "reverse") {
      this.event({ kind: "spindle", rpm: this.rpm, dir: this.tapDir === "cw" ? "ccw" : "cw" });
      this.tapReversed = true;
    } else if (action === "orient") {
      this.event({ kind: "spindle", rpm: 0, dir: "stop" });
    } else if (this.spindle !== "stop") {
      this.event({ kind: "spindle", rpm: this.rpm, dir: this.spindle });
    }
  }

  // --- subprograms and macros ----------------------------------------------------

  /** Program O`n`: from the programs in memory, else written into the main
   *  program's own file after its M30. */
  private findProgram(n: number): { program: ParsedProgram; start: number } | null {
    for (const [key, text] of Object.entries(this.setup.programs ?? {})) {
      if (Number(key.replace(/^O/i, "").replace(/\.nc$/i, "")) !== n) continue;
      let program = this.parsed.get(key);
      if (!program) {
        program = parseProgram(text);
        this.parsed.set(key, program);
      }
      return { program, start: program.programStarts[n] ?? 0 };
    }
    for (const f of [this.frames[0], this.top]) {
      const start = f.program.programStarts[n];
      if (start !== undefined && start > 0) return { program: f.program, start };
    }
    return null;
  }

  private call(kind: "sub" | "local" | "macro", p?: W, l?: W, locals?: Map<number, Value>) {
    const what = kind === "local" ? "M97" : kind === "sub" ? "M98" : "G65";
    if (!p) this.fail("noP", `${what} needs P`);
    if (!Number.isInteger(p.v) || p.v < 0) this.fail("invalidP", `${what} P${p.v}`);
    const times = l ? l.v : 1;
    if (!Number.isInteger(times) || times < 0) this.fail("invalidP", `L${times} must be a whole number`);
    if (times === 0) return;
    if (this.frames.length > MAX_CALL_DEPTH) this.fail("nesting", `more than ${MAX_CALL_DEPTH} levels of calls`);
    const n = p.v;
    const caller = this.top;
    let target: { program: ParsedProgram; start: number; name?: string };
    if (kind === "local") {
      const start = this.findN(caller.program, n, caller.pc - 1);
      if (start < 0) this.fail("lineNotFound", `M97 P${n}: N${n} not found in this program`);
      target = { program: caller.program, start, name: caller.name };
    } else {
      const found = this.findProgram(n);
      if (!found) this.fail("subNotFound", `O${pad(n, 5)} is not in memory`);
      target = { ...found, name: `O${pad(n, 5)}` };
    }
    this.frames.push({
      ...target,
      pc: target.start,
      // G65 opens a fresh set of #1–#33; M97/M98 share the caller's.
      locals: kind === "macro" ? (locals ?? new Map()) : caller.locals,
      repeats: times - 1,
      kind,
    });
  }

  private macroCall(a: Words, m: number | undefined) {
    const locals = new Map<number, Value>();
    for (const [letter, index] of Object.entries(G65_ARGS)) {
      const w = a[letter];
      if (w) locals.set(index, w.v);
    }
    if (m !== undefined) locals.set(13, m);
    this.call("macro", a.P, a.L, locals);
  }

  /** M99 (mcode.md §5.7): returns from a call, repeating it first while L
   *  runs remain. M99 P jumps to N<P> in the current program without
   *  returning. In the main program a plain M99 would restart the program,
   *  so as its last block the run ends there; anywhere else it is a
   *  subprogram body reached without a call. */
  private m99(p: W | undefined, block: Block) {
    const f = this.top;
    if (p) return this.goto(f, p.v);
    if (f.kind === "main") {
      const [, end] = this.region(f.program, f.pc - 1);
      const more = f.program.blocks.slice(f.pc, end).some((b) => b.words.length > 0 || b.statement);
      if (more) this.fail("m99NoCaller", "M99 in the main program with blocks after it — a subprogram body ran without a call");
      this.warn(WARNINGS.m99Main, block.line);
      return this.finish(false);
    }
    if (f.repeats > 0) {
      f.repeats--;
      f.pc = f.start;
      return;
    }
    this.frames.pop();
  }

  /** M02/M30 and the end of the text. M02/M30 also stop the spindle and coolant. */
  private finish(reset: boolean) {
    if (this.compMode !== "G40") this.fail("compAtStop", "program G40 (and a move) before the end");
    this.comp.flush();
    if (reset) {
      this.runSpindle("stop");
      this.setCoolant(false, false);
    }
    this.event({ kind: "end" });
    this.ended = true;
  }

  // --- variables ----------------------------------------------------------------

  /** Offset register of a #5201–#5326 / #7001–#7386 / #14001–#15966 variable. */
  private offsetVariable(n: number): { key: string; axis: number } | null {
    const inBlock = (base: number, count: number, key: (i: number) => string) => {
      const rel = n - base;
      if (rel < 0 || rel >= count * 20 || rel % 20 >= 6) return null;
      return { key: key(Math.floor(rel / 20)), axis: rel % 20 };
    };
    if (n >= 5201 && n <= 5206) return { key: "G52", axis: n - 5201 };
    return (
      inBlock(5221, 6, (i) => `G${54 + i}`) ??
      inBlock(7001, 20, (i) => `G154P${i + 1}`) ??
      inBlock(14001, 99, (i) => `G154P${i + 1}`)
    );
  }

  /** #4001–#4021: the active code of groups 1–21. */
  private modalValue(group: number): number | null {
    const num = (code: string) => Number(code.replace(/^G/, "").split(" ")[0]);
    switch (group) {
      case 1:
        return num(this.cycle !== "G80" ? this.cycle : this.motion);
      case 2:
        return num(this.plane);
      case 3:
        return num(this.distanceMode);
      case 5:
        return num(this.feedMode);
      case 6:
        return num(this.units);
      case 7:
        return num(this.compMode);
      case 8:
        return num(this.lengthComp);
      case 9:
        return num(this.cycle);
      case 10:
        return num(this.returnLevel);
      case 11:
        return this.transform.scaling ? 51 : 50;
      case 12:
        return num(this.wcsLabel);
      case 15:
        return num(this.pathMode);
      case 16:
        return this.transform.rotation ? 68 : 69;
      default:
        return null;
    }
  }

  private readVar(n: number): Value {
    if (n === 0) return null;
    if (n >= 1 && n <= 33) return this.top.locals.get(n) ?? null;
    if ((n >= 100 && n <= 199) || (n >= 500 && n <= 999)) return this.globals.get(n) ?? null;
    const u = this.unit;
    if (n >= 2001 && n <= 2800) {
      const t = this.setup.tools[((n - 2001) % 200) + 1];
      if (!t) return 0;
      return [t.length, t.lengthWear ?? 0, t.diameter, t.diameterWear ?? 0][Math.floor((n - 2001) / 200)] / u;
    }
    if (n === 3001) return this.seconds * 1000;
    if (n === 3002) return this.seconds / 3600;
    if (n >= 4001 && n <= 4021) return this.modalValue(n - 4000);
    if (n >= 4101 && n <= 4126) return this.lastWord[String.fromCharCode(64 + n - 4100)] ?? null;
    const axisValue = (p: MachinePosition, i: number) => [p.x / u, p.y / u, p.z / u, 0, p.b, p.c][i];
    if (n >= 5001 && n <= 5006) return axisValue(this.prog, n - 5001);
    if (n >= 5021 && n <= 5026) return axisValue(this.pos, n - 5021);
    if (n >= 5041 && n <= 5046) return axisValue(this.prog, n - 5041);
    const off = this.offsetVariable(n);
    if (off) {
      const o = off.key === "G52" ? this.shift52 : { ...ZERO5, ...this.setup.workOffsets[off.key] };
      return axisValue(o, off.axis);
    }
    throw new MacroError(`#${n} is not a variable this control has`);
  }

  private writeVar(n: number, v: Value, block: Block) {
    if (n >= 1 && n <= 33) {
      this.top.locals.set(n, v);
      return;
    }
    if ((n >= 100 && n <= 199) || (n >= 500 && n <= 999)) {
      this.globals.set(n, v);
      // #500–#999 survive power-off: the machine keeps them.
      if (n >= 500) this.event({ kind: "variable", n, value: v });
      return;
    }
    const value = v ?? 0;
    const u = this.unit;
    const comment = block.comments.join(" ").trim();
    if (n === 3000) {
      // #3000 = n raises alarm 1000+n with the comment as its text.
      const num = Math.round(value);
      throw new NcAlarm({
        line: this.line,
        severity: "alarm",
        code: String(1000 + num),
        message: comment || `USER ALARM ${num}`,
        ...(this.top.name ? { program: this.top.name } : {}),
      });
    }
    if (n === 3006) {
      this.warn(`${WARNINGS.stopMessage}: ${comment || value}`);
      return this.event({ kind: "stop", optional: false });
    }
    if (n >= 2001 && n <= 2800) {
      const reg = ((n - 2001) % 200) + 1;
      const field = (["length", "lengthWear", "diameter", "diameterWear"] as const)[Math.floor((n - 2001) / 200)];
      return this.reframe(() => {
        const entry = { ...(this.setup.tools[reg] ?? { number: reg, length: 0, diameter: 0 }), [field]: value * u };
        this.setup.tools[reg] = entry;
        this.event({ kind: "toolOffset", entry: { ...entry } });
      });
    }
    const off = this.offsetVariable(n);
    if (off) {
      // Axis 3 is A, which the UMC-500 does not have.
      if (off.axis === 3) return;
      const axis = (["x", "y", "z", "a", "b", "c"] as const)[off.axis] as Axis;
      const scaled = isRotary(axis) ? value : value * u;
      return this.reframe(() => {
        if (off.key === "G52") this.shift52[axis] = scaled;
        else {
          const value = { ...this.setup.workOffsets[off.key], [axis]: scaled };
          this.setup.workOffsets[off.key] = value;
          this.event({ kind: "workOffset", key: off.key, value: { ...value } });
        }
      });
    }
    throw new MacroError(`#${n} cannot be written`);
  }

  // --- output -------------------------------------------------------------------

  private event(e: EventBody) {
    const source = { line: this.line, block: this.blockNo, ...(this.top.name ? { program: this.top.name } : {}) };
    this.comp.event({ ...e, ...source } as NcEvent);
  }

  private push(m: Motion) {
    this.motions.push(m);
    if ("seconds" in m) this.seconds += m.seconds;
    if (this.motions.length > MAX_MOTIONS) this.fail("runaway", `more than ${MAX_MOTIONS} motions`);
  }

  private checkTravel(p: MachinePosition, line: number, program?: string) {
    const keys = { x: "overtravelX", y: "overtravelY", z: "overtravelZ", b: "overtravelB" } as const;
    for (const axis of ["x", "y", "z", "b"] as const) {
      const limits = TRAVEL[axis];
      if (!limits) continue;
      const v = p[axis];
      if (v < limits[0] - 1e-6 || v > limits[1] + 1e-6) {
        const unit = axis === "b" ? "°" : " mm";
        this.fail(
          keys[axis],
          `machine ${axis.toUpperCase()} ${v.toFixed(3)}${unit} is outside ${limits[0]} to ${limits[1]}${unit}`,
          line,
          program,
        );
      }
    }
  }

  /** Splits a TCPC rotary move until the machine-frame chords stay within tolerance. */
  private tcpPieces(seg: Seg): number {
    const d = seg.data;
    const at = (t: number) =>
      frameToMachine(d.frame, lerp(seg.from, seg.to, t), d.b0 + (d.b1 - d.b0) * t, d.c0 + (d.c1 - d.c0) * t);
    let n = Math.max(1, Math.ceil(Math.max(Math.abs(d.b1 - d.b0), Math.abs(d.c1 - d.c0)) / 10));
    for (;;) {
      let worst = 0;
      for (let i = 0; i < n; i++) {
        const mid = at((i + 0.5) / n);
        worst = Math.max(worst, distance(lerp(xyz(at(i / n)), xyz(at((i + 1) / n)), 0.5), xyz(mid)));
      }
      if (worst <= this.tolerance || n >= 4096) return n;
      n = Math.min(4096, Math.ceil(n * Math.sqrt(worst / this.tolerance) * 1.1));
    }
  }

  /** Turns a move into machine motions: chords for arcs and TCPC rotary moves,
   *  travel-checked as a whole block, timed at 100% overrides. */
  private emitSeg(seg: Seg) {
    const d = seg.data;
    const tcp = d.frame.mode !== "plain";
    const samples: { part: Vec3; b: number; c: number }[] = [];
    if (seg.arc) {
      const n = arcChords(seg.arc, this.tolerance);
      for (let i = 1; i <= n; i++) samples.push({ part: i === n ? seg.arc.to : arcPoint(seg.arc, i / n), b: d.b1, c: d.c1 });
    } else {
      const rotary = d.b0 !== d.b1 || d.c0 !== d.c1;
      const n = d.frame.mode === "tcp" && rotary ? this.tcpPieces(seg) : 1;
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        samples.push({ part: lerp(seg.from, seg.to, t), b: d.b0 + (d.b1 - d.b0) * t, c: d.c0 + (d.c1 - d.c0) * t });
      }
    }
    const targets = samples.map((s) => frameToMachine(d.frame, s.part, s.b, s.c));
    // The control checks a move against the limits before making it: an
    // over-travel stops the program at this line with none of the move run.
    for (const t of targets) this.checkTravel(t, seg.line, d.program);

    let prev = { part: seg.from, b: d.b0, c: d.c0 };
    const lengths = samples.map((s) => {
      const lin = distance(prev.part, s.part);
      const rot = Math.hypot(s.b - prev.b, s.c - prev.c);
      prev = s;
      // Feed along the tool path; under TCPC that is the tip in the part frame.
      return { lin, rot, path: lin > 1e-9 ? (tcp ? lin : Math.hypot(lin, rot)) : rot };
    });
    const total = lengths.reduce((sum, l) => sum + l.path, 0);

    let from = this.pos;
    targets.forEach((to, i) => {
      const { lin, rot, path } = lengths[i];
      let seconds: number;
      let feed: number;
      if (d.rapid) {
        // Every axis at its own rapid rate; the move takes as long as the slowest.
        seconds = Math.max(...ALL_AXES.map((ax) => Math.abs(to[ax] - from[ax]) / RAPID_RATE[ax])) * 60;
        feed = seconds > 0 ? (distance(xyz(from), xyz(to)) / seconds) * 60 : 0;
      } else if (d.inverseMinutes !== undefined) {
        seconds = d.inverseMinutes * 60 * (total > 0 ? path / total : 1 / targets.length);
        feed = seconds > 0 ? (lin / seconds) * 60 : 0;
      } else if (lin > 1e-9) {
        seconds = (path / d.feed) * 60;
        feed = d.feed;
      } else {
        seconds = (rot / d.rotaryFeed) * 60;
        feed = d.feed;
      }
      this.push({
        kind: d.rapid ? "rapid" : "feed",
        line: seg.line,
        ...(d.program ? { program: d.program } : {}),
        block: d.block,
        from,
        to,
        feed,
        seconds,
        ...(tcp ? { tcp: true } : {}),
      });
      from = to;
    });
    this.pos = from;
  }

  // --- diagnostics ---------------------------------------------------------------

  private alarmDiagnostic(key: AlarmKey, detail: string, line: number, program = this.top?.name): Diagnostic {
    const alarm = ALARMS[key];
    return {
      line,
      severity: "alarm",
      ...("code" in alarm ? { code: alarm.code } : {}),
      message: detail ? `${alarm.text}: ${detail}` : alarm.text,
      ...(program ? { program } : {}),
    };
  }

  private fail(key: AlarmKey, detail = "", line = this.line, program = this.top?.name): never {
    throw new NcAlarm(this.alarmDiagnostic(key, detail, line, program));
  }

  private failer() {
    return (key: AlarmKey, detail: string): never => this.fail(key, detail);
  }

  private warn(message: string, line = this.line) {
    const program = this.top.name;
    this.diagnostics.push({ line, severity: "warning", message, ...(program ? { program } : {}) });
  }

  private warnOnce(key: string, message: string) {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    this.warn(message);
  }

  private activeCodes(): ActiveCodes {
    return {
      motion: this.motion,
      cycle: this.cycle,
      plane: this.plane,
      distance: this.distanceMode,
      feedMode: this.feedMode,
      units: this.units,
      cutterComp: this.compMode,
      toolLength: this.lengthComp,
      returnLevel: this.returnLevel,
      scaling: this.transform.scaling ? "G51" : "G50",
      workOffset: this.wcsLabel,
      pathMode: this.pathMode,
      rotation: this.transform.rotation ? "G68" : "G69",
      dynamicWorkOffset: this.dwo ? "G254" : "G255",
      feed: this.F,
      spindleSpeed: this.rpm,
      spindle: this.spindle,
      coolant: this.flood || this.tsc,
      tool: this.tool,
      nextTool: this.nextTool ?? this.tool,
      h: this.h,
      d: this.d,
    };
  }

  /** Records the active codes after a block, when the block changed them. */
  private logCodes() {
    const codes = this.activeCodes();
    const last = this.codes[this.codes.length - 1]?.codes;
    if (last && (Object.keys(codes) as (keyof ActiveCodes)[]).every((k) => codes[k] === last[k])) return;
    this.codes.push({ block: this.blockNo, codes });
  }

  private result(): NcResult {
    const u = this.unit;
    return {
      motions: this.motions,
      diagnostics: this.diagnostics,
      toolsUsed: this.toolsUsed,
      cycleSeconds: this.seconds,
      modal: {
        ...this.activeCodes(),
        machine: { ...this.pos },
        work: { x: this.prog.x / u, y: this.prog.y / u, z: this.prog.z / u, b: this.prog.b, c: this.prog.c },
      },
      codes: this.codes,
    };
  }
}

/** Parses and runs `text` against `setup` (which is not modified: G10 and
 *  macro offset writes go to a copy). */
export function interpret(text: string, setup: NcSetup): NcResult {
  return new Run(parseProgram(text), setup).run();
}

/** The active codes while block `block` (Motion.block) executes. */
export function codesAt(result: NcResult, block: number): ActiveCodes {
  const log = result.codes;
  let lo = 0;
  let hi = log.length - 1;
  // Last entry at or before `block`; the log starts at block 0.
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (log[mid].block <= block) lo = mid;
    else hi = mid - 1;
  }
  return log[lo].codes;
}
