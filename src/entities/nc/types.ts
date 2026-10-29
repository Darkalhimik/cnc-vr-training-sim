/**
 * Types for the Haas NGC mill G-code interpreter: what goes in (the program
 * text and the machine setup), what comes out (the motion list, alarms and the
 * final modal state), and the parsed program in between.
 */
import type { MachinePosition } from "../machine/kinematics";

export type { MachinePosition };

/** One row of the tool/offset table. Lengths in mm, gauge line to tip. */
export type ToolEntry = {
  number: number;
  length: number;
  diameter: number;
  lengthWear?: number;
  diameterWear?: number;
};

export type NcSetup = {
  /** Keys "G54".."G59", "G154P1".."G154P99"; missing axes are 0. G110–G129
   *  are the same registers as G154 P1–P20. */
  workOffsets: Record<string, Partial<MachinePosition>>;
  /** The tool/offset table, by T and H/D number. */
  tools: Record<number, ToolEntry>;
  /** 0 = empty. */
  toolInSpindle: number;
  /** Where the machine is when the program starts. */
  start: MachinePosition;
  /** Other programs in memory, for M98 P/G65 calls: O-number (e.g. "O01000") -> text */
  programs?: Record<string, string>;
  options?: {
    blockDelete?: boolean;
    /** OPTION STOP: M01 then also stops the spindle and coolant, like M00. */
    optionalStop?: boolean;
    /** Setting 9; default true. G20/G21 only check it (alarms 383/384). */
    metricDefault?: boolean;
    /** Setting 162 DEFAULT TO FLOAT; default false: `X10` is 0.010 mm. */
    defaultToFloat?: boolean;
    /** Setting 77 SCALE INTEGER F; default "default": `F100` is 0.1 mm/min. */
    integerFeed?: "default" | "integer";
    /** "classic" (default): only G43/G44 Hn applies a length offset.
     *  "follow-tool": current NGC software — the spindle tool's offset is
     *  always applied and follows T on M06; only G49/H00 cancels it. */
    toolOffsets?: "classic" | "follow-tool";
    /** Chord tolerance for linearised arcs and TCPC moves, mm. Default 0.01. */
    chordTolerance?: number;
    /** Initial macro variables, e.g. retained #500s. */
    variables?: Record<number, number>;
  };
};

type MotionSource = {
  /** Source line, 1-based, in the program named by `program`. */
  line: number;
  /** O-number of the subprogram the line belongs to; absent for the main program. */
  program?: string;
  /** Executed-block counter: unique per block execution, so single block can
   *  stop between two runs of the same line (loops, repeats). */
  block?: number;
};

export type Motion =
  | (MotionSource & {
      kind: "rapid" | "feed";
      from: MachinePosition;
      to: MachinePosition;
      /** mm/min for feed; for rapids the time is computed from per-axis rapid rates */
      feed: number;
      seconds: number;
      /** true when the tool tip is under tool-centre-point control (G234) or a tilted work plane (G254) */
      tcp?: boolean;
    })
  | (MotionSource & { kind: "dwell"; seconds: number })
  | (MotionSource & { kind: "toolChange"; tool: number; seconds: number })
  | (MotionSource & { kind: "spindle"; rpm: number; dir: "cw" | "ccw" | "stop" })
  | (MotionSource & { kind: "coolant"; on: boolean })
  | (MotionSource & { kind: "stop"; optional: boolean })
  /** G10 or a #5201… write: the register's whole value after the write.
   *  Keys as in NcSetup.workOffsets; G52 is a program shift, not reported. */
  | (MotionSource & { kind: "workOffset"; key: string; value: Partial<MachinePosition> })
  /** G10 L1/L10–L13 or a #2001… write: the tool table row after the write. */
  | (MotionSource & { kind: "toolOffset"; entry: ToolEntry })
  /** A write to a retained variable (#500–#999); null = vacant. */
  | (MotionSource & { kind: "variable"; n: number; value: number | null })
  | (MotionSource & { kind: "end" });

export type Diagnostic = {
  line: number;
  severity: "alarm" | "warning";
  code?: string;
  message: string;
  /** O-number of the subprogram, when the line is not in the main program. */
  program?: string;
};

export type CannedCycle =
  | "G80"
  | "G73"
  | "G74"
  | "G76"
  | "G77"
  | "G81"
  | "G82"
  | "G83"
  | "G84"
  | "G85"
  | "G86"
  | "G87"
  | "G88"
  | "G89";

/** The active codes of each modal group, as the CURRENT COMMANDS page lists them. */
export type ModalState = {
  motion: "G00" | "G01" | "G02" | "G03";
  cycle: CannedCycle;
  plane: "G17" | "G18" | "G19";
  distance: "G90" | "G91";
  feedMode: "G93" | "G94" | "G95";
  units: "G20" | "G21";
  cutterComp: "G40" | "G41" | "G42";
  toolLength: "G43" | "G44" | "G49" | "G234";
  returnLevel: "G98" | "G99";
  scaling: "G50" | "G51";
  /** "G54".."G59" or "G154 P1".."G154 P99". */
  workOffset: string;
  pathMode: "G61" | "G64";
  rotation: "G68" | "G69";
  dynamicWorkOffset: "G254" | "G255";
  /** F as programmed, in program units. */
  feed: number;
  spindleSpeed: number;
  spindle: "cw" | "ccw" | "stop";
  coolant: boolean;
  /** Tool in the spindle; 0 = empty. */
  tool: number;
  /** Last T word: the tool the next M06 loads. */
  nextTool: number;
  h: number;
  d: number;
  /** Machine position at the end. */
  machine: MachinePosition;
  /** Work (program) position at the end, in program units. */
  work: MachinePosition;
};

/** The modal codes alone, without the positions. */
export type ActiveCodes = Omit<ModalState, "machine" | "work">;

export type NcResult = {
  /** Flattened, in execution order; arcs, helices and rotary moves under
   *  TCPC/DWO are linearised to a chord tolerance (default 0.01 mm) with every
   *  segment keeping its source line. */
  motions: Motion[];
  /** An alarm stops execution at that line (motions stop there too). */
  diagnostics: Diagnostic[];
  toolsUsed: number[];
  /** At 100% overrides. */
  cycleSeconds: number;
  /** Final modal state. */
  modal: ModalState;
  /** The active codes after each block that changed them, by executed-block
   *  counter (Motion.block), ascending; the first entry (block 0) is the state
   *  before the program. `codesAt` looks a block up. */
  codes: { block: number; codes: ActiveCodes }[];
};

// ---------------------------------------------------------------------------
// Parsed program

/** A macro expression, parsed once so loops do not re-tokenise. */
export type Expr =
  | { k: "num"; v: number }
  | { k: "var"; index: Expr }
  | { k: "neg"; a: Expr }
  | { k: "bin"; op: BinaryOp; a: Expr; b: Expr }
  | { k: "fn"; name: MacroFunction; a: Expr; b?: Expr };

export type BinaryOp =
  | "+"
  | "-"
  | "*"
  | "/"
  | "MOD"
  | "AND"
  | "OR"
  | "XOR"
  | "EQ"
  | "NE"
  | "GT"
  | "GE"
  | "LT"
  | "LE";

export type MacroFunction =
  | "SIN"
  | "COS"
  | "TAN"
  | "ASIN"
  | "ACOS"
  | "ATAN"
  | "SQRT"
  | "ABS"
  | "ROUND"
  | "FIX"
  | "FUP"
  | "LN"
  | "EXP"
  | "BIN"
  | "BCD";

export type Word = {
  letter: string;
  /** A literal, or an expression (`X#1`, `X[#1+2]`). */
  value: number | Expr;
  /** Literal written with a decimal point. Matters for G04 P (seconds vs ms). */
  decimal: boolean;
  /** After a mid-block "/": skipped when BLOCK DELETE is on. */
  optional: boolean;
};

export type Statement =
  | { kind: "assign"; target: Expr; value: Expr }
  | { kind: "if-goto"; cond: Expr; target: Expr }
  | { kind: "if-then"; cond: Expr; then: Statement | { kind: "words"; words: Word[] } }
  | { kind: "goto"; target: Expr }
  | { kind: "while"; cond: Expr; id: number }
  | { kind: "end"; id: number }
  /** DPRNT, POPEN, PCLOS: accepted, no effect here. */
  | { kind: "ignored"; text: string };

export type Block = {
  /** 1-based source line. Blocks split by ";" share a line. */
  line: number;
  text: string;
  /** N sequence number. */
  n?: number;
  /** O program number, when the block starts a program. */
  o?: number;
  words: Word[];
  statement?: Statement;
  comments: string[];
  /** Whole block follows a leading "/": skipped when BLOCK DELETE is on. */
  optional: boolean;
  /** Syntax error; raised as an alarm only if the block is executed. */
  error?: string;
};

export type ParsedProgram = {
  /** O-number of the first program in the text. */
  number?: number;
  /** Comment on the O line, Haas's program name. */
  name?: string;
  blocks: Block[];
  /** Syntax errors with line numbers. */
  errors: Diagnostic[];
  /** Block index of every O line, so a file can carry its own subprograms. */
  programStarts: Record<number, number>;
  /** WHILE block index -> matching END block index, and back. */
  loops: { whileToEnd: Record<number, number>; endToWhile: Record<number, number> };
};
