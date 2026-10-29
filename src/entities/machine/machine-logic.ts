/**
 * The machine and its NGC control, as a pure function of (state, action).
 *
 * No timers and no clock live here. A slow process — the control booting, a
 * zero return — is a run of steps the reducer starts by asking for a timer,
 * which the store feeds back in as an action. A program run is played by the
 * scene (program-run.ts) and reports back through `run*` actions. That
 * keeps every rule in one place and testable without a clock.
 *
 * Control behaviour follows docs/haas-ngc/operation.md and pendant.md.
 */
import type { ActiveCodes, Motion } from "@/entities/nc/types";
import type { MachinePartId } from "./machine-parts";
import {
  ALARM,
  AXES,
  WORK_OFFSET_IDS,
  type Alarm,
  type Axis,
  type AxisValues,
  type ControlMode,
  type DisplayPage,
  type MachineState,
  type StockOnMachine,
  defaultCodes,
  initialMachineState,
  spindleRpm,
} from "./machine-types";
import type { Halt } from "./program-playback";
import { afterSwap } from "./tool-changer";

export type TimerKind = "boot" | "homing";

export type MachineAction =
  | { type: "operate"; part: MachinePartId; /** handwheel direction */ sign?: 1 | -1 }
  | { type: "key"; key: string; shift?: boolean }
  | { type: "timer"; timer: TimerKind }
  /** Clamp a blank in the vise, or take it out (null). */
  | { type: "stock"; stock: StockOnMachine | null }
  /** A program running in the scene: an instant event it crossed. */
  | { type: "runEvent"; event: Motion }
  | { type: "runProgress"; position: AxisValues; line: number; codes?: ActiveCodes }
  | { type: "runHalt"; halt: Halt | "alarm"; position: AxisValues; line: number; alarm?: string; codes?: ActiveCodes }
  /** The tool hit the stock with something that does not cut. */
  | { type: "crash"; text: string };

/** What the program runner reports back. */
export type RunAction = Extract<MachineAction, { type: "runEvent" | "runProgress" | "runHalt" }>;

export type Outcome = {
  next: MachineState;
  /** The action did nothing, and this is why — phrased for the trainee. */
  rejected?: string;
  /** Not a refusal, but worth telling the trainee (an alarm, an interlock). */
  notice?: string;
  /** Timers to (re)start; starting one replaces a pending one of that kind. */
  start?: TimerKind[];
  /** Timers to drop. */
  cancel?: TimerKind[];
  /** What the program runner should do. */
  run?: "start" | "resume" | "stop";
};

export const BOOT_MS = 3500;

/** Zero return order on a Haas: Z clears the work first, then the rest. */
export const HOMING_SEQUENCE: { axes: Axis[]; ms: number }[] = [
  { axes: ["z"], ms: 1600 },
  { axes: ["x", "y"], ms: 1800 },
  { axes: ["b", "c"], ms: 1800 },
];

/** Travel, in machine coordinates. C is a continuous rotary. */
export const TRAVEL: Record<Axis, [number, number] | null> = {
  x: [-610, 0],
  y: [-406, 0],
  z: [-406, 0],
  // Haas UMC-500 tilt, signed as the control signs it (umc500.md).
  b: [-35, 120],
  c: null,
};

/**
 * A click on the handle is a flick of ten detents: one click per detent would
 * make a headset user click a thousand times to cross the table.
 */
export const DETENTS_PER_CLICK = 10;

/** Handle increments, metric: the .0001/.001/.01/.1 keys (pendant.md §3). */
export const INCREMENT_KEYS: Record<string, number> = {
  INC_0001: 0.001,
  INC_001: 0.01,
  INC_01: 0.1,
  INC_1: 1,
};

const AXIS_OF: Partial<Record<MachinePartId, Axis>> = {
  axis_x: "x",
  axis_y: "y",
  axis_z: "z",
  axis_b: "b",
  axis_c: "c",
};

export { spindleRpm };

const ok = (next: MachineState, extra: Omit<Outcome, "next"> = {}): Outcome => ({ next, ...extra });
const no = (state: MachineState, reason: string): Outcome => ({ next: state, rejected: reason });

function withAlarms(state: MachineState, ...alarms: Alarm[]): MachineState {
  const list = [...state.alarms];
  for (const a of alarms) if (!list.some((x) => x.code === a.code)) list.push(a);
  return { ...state, alarms: list };
}

const SPINDLE_STOPPED = { rpm: 0, dir: "stop" } as const;

/** Everything the control holds in memory, as it is after a power loss. */
function controlDown(state: MachineState): MachineState {
  return {
    ...state,
    control: "off",
    alarms: [],
    mode: "memory",
    jogAxis: null,
    input: "",
    homed: false,
    homingStage: null,
    homingAxes: [],
    coolantOn: false,
    spindle: SPINDLE_STOPPED,
    program: "idle",
    runSource: null,
    programLine: 0,
    warmupDone: false,
  };
}

/** Servos dropping out mid-motion: homing is lost, the program stops. */
function stopMotion(state: MachineState): MachineState {
  const homingAborted = state.homingStage !== null;
  return {
    ...state,
    homingStage: null,
    homingAxes: [],
    homed: homingAborted ? false : state.homed,
    coolantOn: false,
    spindle: SPINDLE_STOPPED,
    program: "idle",
    runSource: null,
  };
}

const running = (s: MachineState) => s.program !== "idle";

/** Why the control will not move an axis right now, if it will not. */
function motionBlocker(state: MachineState): string | null {
  if (state.control === "off") return "The control is off. Press POWER ON first.";
  if (state.control === "booting") return "Wait for the control to finish booting.";
  if (state.alarms.length > 0) {
    return `Clear the alarms first with RESET (${state.alarms.map((a) => a.text).join(", ")}).`;
  }
  return null;
}

/** Starts zero-return stage `stage` of a run over the homing axes. */
function homeStage(state: MachineState, stage: number): MachineState {
  const position = { ...state.position };
  for (const axis of HOMING_SEQUENCE[stage].axes) if (state.homingAxes.includes(axis)) position[axis] = 0;
  return { ...state, homingStage: stage, position };
}

/** First homing stage with an axis in `axes`, at or after `from`. */
function nextStage(axes: Axis[], from: number): number | null {
  for (let i = from; i < HOMING_SEQUENCE.length; i++) {
    if (HOMING_SEQUENCE[i].axes.some((a) => axes.includes(a))) return i;
  }
  return null;
}

/** ZERO RETURN ALL / SINGLE / HOME G28 and POWER UP. */
function zeroReturn(state: MachineState, axes: Axis[]): Outcome {
  const blocked = motionBlocker(state);
  if (blocked) return no(state, blocked);
  if (state.doorOpen) return no(state, "Close the door. A zero return will not move the axes with it open.");
  if (running(state)) return no(state, "Stop the program with RESET first.");
  if (state.homingStage !== null) return ok(state);
  const first = nextStage(axes, 0)!;
  const all = axes.length === AXES.length;
  return ok(homeStage({ ...state, homed: all ? false : state.homed, homingAxes: axes, jogAxis: null }, first), {
    start: ["homing"],
  });
}

/** RESET: clears alarms whose cause has gone, stops whatever is moving. */
function resetControl(state: MachineState): Outcome {
  if (state.control === "off") return no(state, "The control is off.");
  if (state.control === "booting") return no(state, "Wait for the control to finish booting.");
  const stillTrue = state.alarms.filter(
    (a) =>
      (a.code === ALARM.emergencyOff.code && state.estopPressed) ||
      (a.code === ALARM.lowAir.code && !state.airValveOpen),
  );
  // 102 clears with the last of the others: the servos come back on.
  const alarms: Alarm[] = stillTrue.length > 0 ? [ALARM.servosOff, ...stillTrue] : [];
  const next = {
    ...stopMotion(state),
    alarms,
    input: "",
    programLine: 0,
    activeCodes: defaultCodes(state.toolInSpindle),
  };
  const outcome: Omit<Outcome, "next"> = { cancel: ["homing"], run: "stop" };
  if (stillTrue.length === 0) return ok(next, outcome);
  const why = stillTrue
    .map((a) => (a.code === ALARM.emergencyOff.code ? "release the E-stop" : "open the air supply"))
    .join(" and ");
  return ok(next, {
    ...outcome,
    notice: `RESET could not clear ${stillTrue.map((a) => a.text).join(", ")} — ${why} first.`,
  });
}

/** Move one axis by `distance`, within its travel. */
function jog(state: MachineState, axis: Axis, distance: number): Outcome {
  if (state.control !== "on") return no(state, "The control is off.");
  if (state.mode !== "jog") return no(state, "Select HANDLE JOG first.");
  const blocked = motionBlocker(state);
  if (blocked) return no(state, blocked);
  if (state.homingStage !== null) return no(state, "Wait for the zero return to finish.");
  if (!state.homed) {
    return no(state, "Zero return first with POWER UP — the control does not know where the axes are.");
  }
  if (running(state)) return no(state, "A program is active.");
  const from = state.position[axis];
  const limits = TRAVEL[axis];
  let to = Math.round((from + distance) * 1000) / 1000;
  if (limits) to = Math.min(limits[1], Math.max(limits[0], to));
  if (to === from) {
    return no(state, `${axis.toUpperCase()} is at its ${distance > 0 ? "plus" : "minus"} travel limit.`);
  }
  return ok({ ...state, jogAxis: axis, position: { ...state.position, [axis]: to } });
}

/** CYCLE START: run or resume the active program, or the MDI program. */
function cycleStart(state: MachineState): Outcome {
  const blocked = motionBlocker(state);
  if (blocked) return no(state, blocked);
  if (state.doorOpen) return no(state, "Close the door to run a program.");
  if (state.program === "running") return ok(state);
  if (state.program === "hold" || state.program === "stopped") {
    return ok({ ...state, program: "running" }, { run: "resume" });
  }
  if (state.mode !== "memory" && state.mode !== "mdi") {
    return no(state, "Select MEMORY (or MDI) to run a program.");
  }
  if (!state.homed) return no(state, "Zero return first with POWER UP.");
  if (state.mode === "mdi" && !state.mdi.trim()) {
    return no(state, "The MDI program is empty. Type blocks and press INSERT.");
  }
  if (state.mode === "memory" && !state.programs[state.activeProgram]) {
    return no(state, "No active program. Select one in LIST PROGRAM.");
  }
  return ok(
    {
      ...state,
      program: "running",
      runSource: state.mode === "mdi" ? "mdi" : "memory",
      programLine: 0,
      lastProgramDone: null,
    },
    { run: "start" },
  );
}

function operate(state: MachineState, part: MachinePartId, sign: 1 | -1 = 1): Outcome {
  switch (part) {
    case "air_valve": {
      if (!state.airValveOpen) return ok({ ...state, airValveOpen: true });
      const closed = { ...state, airValveOpen: false };
      if (state.control !== "on") return ok(closed);
      return ok(withAlarms(stopMotion(closed), ALARM.lowAir, ALARM.servosOff), {
        notice: "Air pressure lost — the control raised LOW AIR PRESSURE and dropped the servos.",
        cancel: ["homing"],
        run: "stop",
      });
    }

    case "main_switch": {
      if (!state.mainSwitchOn) return ok({ ...state, mainSwitchOn: true });
      const off = { ...state, mainSwitchOn: false };
      if (state.control === "off") return ok(off);
      return ok(controlDown(off), {
        notice: "Mains cut with the control running. Shut down with POWER OFF before the main disconnect.",
        cancel: ["boot", "homing"],
        run: "stop",
      });
    }

    case "power_on":
      if (!state.mainSwitchOn) {
        return no(state, "No mains power. Turn the main disconnect on the electrical cabinet to I.");
      }
      if (state.control !== "off") return ok(state);
      return ok({ ...state, control: "booting" }, { start: ["boot"] });

    case "power_off":
      if (state.control === "off") return ok(state);
      return ok(controlDown(state), { cancel: ["boot", "homing"], run: "stop" });

    case "estop": {
      if (state.estopPressed) return ok({ ...state, estopPressed: false });
      const pressed = stopMotion({ ...state, estopPressed: true });
      if (state.control !== "on") return ok(pressed);
      return ok(withAlarms(pressed, ALARM.emergencyOff, ALARM.servosOff), { cancel: ["homing"], run: "stop" });
    }

    case "reset":
      return resetControl(state);

    case "power_up":
      return zeroReturn(state, [...AXES]);

    case "memory":
      return key(state, "MEMORY");

    case "hand_jog":
      return key(state, "HANDLE_JOG");

    case "axis_x":
    case "axis_y":
    case "axis_z":
    case "axis_b":
    case "axis_c":
      if (state.control !== "on") return no(state, "The control is off.");
      if (state.mode !== "jog") return no(state, "Select HANDLE JOG first, then choose the axis.");
      return ok({ ...state, jogAxis: AXIS_OF[part]! });

    case "handwheel": {
      if (state.control !== "on") return no(state, "The control is off.");
      if (state.mode !== "jog") return no(state, "Select HANDLE JOG to use the handwheel.");
      if (!state.jogAxis) return no(state, "Choose an axis to jog: X, Y, Z, B or C.");
      return jog(state, state.jogAxis, sign * state.handleIncrement * DETENTS_PER_CLICK);
    }

    case "coolant":
      return key(state, "COOLANT");

    case "cycle_start":
      return cycleStart(state);

    case "feed_hold":
      if (state.program !== "running") return ok(state);
      return ok({ ...state, program: "hold" });

    case "door": {
      if (state.doorOpen) return ok({ ...state, doorOpen: false });
      const open = { ...state, doorOpen: true, coolantOn: false };
      if (state.homingStage !== null) {
        return ok(stopMotion(open), {
          notice: "Door opened during the zero return — homing aborted. Close it and press POWER UP again.",
          cancel: ["homing"],
        });
      }
      if (state.program === "running") {
        return ok({ ...open, program: "hold" }, {
          notice: "Door opened — the program is in DOOR HOLD. Close it and press CYCLE START.",
        });
      }
      // In run mode the spindle does not turn with the door open.
      return ok({ ...open, spindle: state.program === "idle" ? SPINDLE_STOPPED : state.spindle });
    }

    case "air_gauge":
    case "screen":
    case "pendant":
    case "full_panel":
    case "vise":
    case "enclosure":
    case "spindle":
    case "trunnion":
    case "tool_changer":
      return ok(state);
  }
}

const NOT_SIMULATED = new Set([
  "RECOVER",
  "F2",
  "F3",
  "TOOL_RELEASE",
  "GRAPHICS",
  "HANDLE_SCROLL",
  "JOG_LOCK",
  "CHIP_FWD",
  "CHIP_STOP",
  "CHIP_REV",
  "CLNT_UP",
  "CLNT_DOWN",
  "AUX_CLNT",
  "HANDLE_FEED",
  "HANDLE_SPINDLE",
  "UNDO",
  "ALTER",
  "DELETE",
  "HOME",
  "END",
]);

/** Characters typed by the numeric and punctuation keys, unshifted / shifted. */
const TYPED: Record<string, [string, string?]> = {
  NUM_0: ["0", "="],
  NUM_1: ["1", "*"],
  NUM_2: ["2", "`"],
  NUM_3: ["3", "?"],
  NUM_4: ["4", "%"],
  NUM_5: ["5", "$"],
  NUM_6: ["6", "!"],
  NUM_7: ["7", "&"],
  NUM_8: ["8", "@"],
  NUM_9: ["9", ":"],
  MINUS: ["-", "+"],
  DOT: [".", "#"],
  EOB: [";", "/"],
  PAREN_OPEN: ["(", "["],
  PAREN_CLOSE: [")", "]"],
  SPACE: [" "],
};

const MODE_KEYS: Record<string, ControlMode> = {
  EDIT: "edit",
  MEMORY: "memory",
  MDI: "mdi",
  HANDLE_JOG: "jog",
  ZERO_RETURN: "zero",
  LIST_PROGRAM: "list",
};

const DISPLAY_KEYS: Record<string, DisplayPage> = {
  PROGRAM: "program",
  POSITION: "position",
  OFFSET: "offset",
  CURRENT_COMMANDS: "commands",
  ALARMS: "alarms",
  DIAGNOSTIC: "diagnostic",
  SETTING: "setting",
  HELP: "help",
};

const POSITION_TABS = ["operator", "work", "machine", "togo", "all"] as const;
/** Offset table columns: tool length/wear and diameter/wear; work X..C. */
export const TOOL_COLS = ["length", "lengthWear", "diameter", "diameterWear"] as const;
export const TOOL_ROWS = 20;

export const sortedPrograms = (s: MachineState) => Object.keys(s.programs).sort();

/** The NGC keyboard. Keys that are also machine parts route through here too. */
function key(state: MachineState, id: string, shift = false): Outcome {
  if (state.control !== "on") {
    return no(state, state.control === "booting" ? "Wait for the control to finish booting." : "The control is off.");
  }

  if (id === "RESET") return resetControl(state);
  if (id === "POWER_UP") return zeroReturn(state, [...AXES]);

  const mode = MODE_KEYS[id];
  if (mode) {
    if (running(state) && mode !== "list" && mode !== state.runSource) {
      return no(state, "A program is active. Press RESET before changing mode.");
    }
    return ok({
      ...state,
      mode,
      display: mode === "list" ? "list" : mode === "mdi" || mode === "edit" ? "program" : state.display,
      jogAxis: mode === "jog" ? state.jogAxis : null,
      offsetCursor:
        mode === "list"
          ? { row: Math.max(0, sortedPrograms(state).indexOf(state.activeProgram)), col: 0 }
          : state.offsetCursor,
    });
  }

  const page = DISPLAY_KEYS[id];
  if (page) {
    // Pressing the key of the page already showing moves to its next tab.
    if (page === state.display && page === "position") {
      const i = POSITION_TABS.indexOf(state.positionTab);
      return ok({ ...state, positionTab: POSITION_TABS[(i + 1) % POSITION_TABS.length] });
    }
    if (page === state.display && page === "offset") {
      return ok({ ...state, offsetTab: state.offsetTab === "tool" ? "work" : "tool", offsetCursor: { row: 0, col: 0 } });
    }
    return ok({ ...state, display: page, offsetCursor: page === "offset" ? { row: 0, col: 0 } : state.offsetCursor });
  }

  const increment = INCREMENT_KEYS[id];
  if (increment !== undefined) return ok({ ...state, handleIncrement: increment });

  if (id.startsWith("JOG_")) {
    const m = /^JOG_([+-])(X|Y|Z|AC)$/.exec(id);
    if (!m) return ok(state);
    const axis: Axis = m[2] === "AC" ? (shift ? "b" : "c") : (m[2].toLowerCase() as Axis);
    if (state.mode !== "jog") return no(state, "Select HANDLE JOG to jog.");
    // A jog key selects the handle's axis and moves it like a flick of it.
    return jog({ ...state, jogAxis: axis }, axis, (m[1] === "+" ? 1 : -1) * state.handleIncrement * DETENTS_PER_CLICK);
  }

  if (id.startsWith("ALPHA_") || TYPED[id]) {
    const ch = id.startsWith("ALPHA_") ? id.slice(6) : ((shift ? TYPED[id][1] : undefined) ?? TYPED[id][0]);
    return ok({ ...state, input: (state.input + ch).slice(0, 80) });
  }

  switch (id) {
    case "CANCEL":
      return ok({ ...state, input: state.input.slice(0, -1) });

    case "SINGLE_BLOCK":
      return ok({ ...state, singleBlock: !state.singleBlock });
    case "OPTION_STOP":
      return ok({ ...state, optionStop: !state.optionStop });
    case "BLOCK_DELETE":
      return ok({ ...state, blockDelete: !state.blockDelete });

    case "COOLANT": {
      if (state.coolantOn) return ok({ ...state, coolantOn: false });
      const blocked = motionBlocker(state);
      if (blocked) return no(state, blocked);
      if (state.doorOpen) return no(state, "Close the door before switching the coolant on.");
      return ok({ ...state, coolantOn: true });
    }

    case "FEED_-10":
    case "FEED_+10":
    case "FEED_100": {
      const feed =
        id === "FEED_100" ? 100 : Math.min(200, Math.max(10, state.overrides.feed + (id === "FEED_+10" ? 10 : -10)));
      return ok({ ...state, overrides: { ...state.overrides, feed } });
    }
    case "SPINDLE_-10":
    case "SPINDLE_+10":
    case "SPINDLE_100": {
      const spindle =
        id === "SPINDLE_100"
          ? 100
          : Math.min(150, Math.max(50, state.overrides.spindle + (id === "SPINDLE_+10" ? 10 : -10)));
      return ok({ ...state, overrides: { ...state.overrides, spindle } });
    }
    case "RAPID_5":
    case "RAPID_25":
    case "RAPID_50":
    case "RAPID_100":
      return ok({ ...state, overrides: { ...state.overrides, rapid: Number(id.slice(6)) } });

    case "SPINDLE_FWD":
    case "SPINDLE_REV": {
      if (state.mode !== "jog" && state.mode !== "mdi") return no(state, "Turn the spindle by hand from HANDLE JOG or MDI.");
      const blocked = motionBlocker(state);
      if (blocked) return no(state, blocked);
      if (state.doorOpen) return no(state, "Close the door to run the spindle.");
      if (!state.toolInSpindle) return no(state, "There is no tool in the spindle.");
      const rpm = state.spindle.rpm || 500;
      return ok({ ...state, spindle: { rpm, dir: id === "SPINDLE_FWD" ? "cw" : "ccw" } });
    }
    case "SPINDLE_STOP":
      return ok({ ...state, spindle: { ...state.spindle, dir: "stop" } });

    case "ZR_ALL":
    case "ZR_HOME":
      if (state.mode !== "zero") return no(state, "Select ZERO RETURN first.");
      return zeroReturn(state, [...AXES]);
    case "ZR_ORIGIN":
      if (state.mode !== "zero") return no(state, "Select ZERO RETURN first.");
      return ok({ ...state, operatorOrigin: { ...state.position } }, { notice: "OPERATOR position zeroed." });
    case "ZR_SINGLE": {
      if (state.mode !== "zero") return no(state, "Select ZERO RETURN first.");
      const letter = state.input.trim().toLowerCase();
      if (!(AXES as readonly string[]).includes(letter)) {
        return no(state, "Type the axis letter (X, Y, Z, B or C), then press SINGLE.");
      }
      return zeroReturn({ ...state, input: "" }, [letter as Axis]);
    }

    case "NEXT_TOOL": {
      if (state.mode !== "jog") return no(state, "NEXT TOOL works in HANDLE JOG.");
      const next = toolAfter(state, 1);
      // During touch-off the offset cursor follows the tool (pendant.md).
      const follow = state.display === "offset" && state.offsetTab === "tool";
      const at = follow ? { ...state, offsetCursor: { row: next - 1, col: state.offsetCursor.col } } : state;
      return keypadToolChange(at, next);
    }
    case "ATC_FWD":
    case "ATC_REV": {
      if (state.mode !== "mdi") return no(state, `${id.replace("_", " ")} works in MDI.`);
      // "T5" on the input line fetches that tool; otherwise the next one round.
      const typed = /^T(\d+)$/i.exec(state.input.trim());
      return keypadToolChange(state, typed ? Number(typed[1]) : toolAfter(state, id === "ATC_FWD" ? 1 : -1));
    }

    case "TOOL_OFFSET_MEASURE": {
      if (state.mode !== "jog") return no(state, "Jog the tool to the surface in HANDLE JOG, then press TOOL OFFSET MEASURE.");
      const t = state.toolInSpindle;
      if (!t) return no(state, "There is no tool in the spindle.");
      // Setting 64 OFF: the length offset is the machine Z where the tip
      // touches the surface used as part zero (operation.md §7).
      const z = Math.round(state.position.z * 1000) / 1000;
      return ok(
        {
          ...state,
          tools: { ...state.tools, [t]: { ...state.tools[t], length: z, lengthWear: 0 } },
          display: "offset",
          offsetTab: "tool",
          offsetCursor: { row: t - 1, col: 0 },
        },
        { notice: `T${t} length offset H${String(t).padStart(2, "0")} = ${z.toFixed(3)}` },
      );
    }

    case "PART_ZERO_SET": {
      if (state.mode !== "jog") return no(state, "Jog to the part zero in HANDLE JOG, then press PART ZERO SET.");
      if (state.display !== "offset" || state.offsetTab !== "work") {
        return no(state, "Open OFFSET → WORK and highlight the offset and axis to set.");
      }
      const offsetId = WORK_OFFSET_IDS[state.offsetCursor.row];
      const axis = AXES[state.offsetCursor.col];
      const value = Math.round(state.position[axis] * 1000) / 1000;
      return ok(
        {
          ...state,
          workOffsets: { ...state.workOffsets, [offsetId]: { ...state.workOffsets[offsetId], [axis]: value } },
          offsetCursor: { ...state.offsetCursor, col: Math.min(AXES.length - 1, state.offsetCursor.col + 1) },
        },
        { notice: `${offsetId} ${axis.toUpperCase()} = ${value.toFixed(3)}` },
      );
    }

    case "F1":
    case "ENTER":
      return enter(state, id === "F1");

    case "INSERT":
      if (state.mode === "mdi") return mdiInsert(state);
      return no(state, "Edit programs in the Part development workspace; the pendant editor is not simulated yet.");

    case "ERASE_PROGRAM":
      if (state.mode !== "mdi") return no(state, "ERASE PROGRAM clears the MDI program here; delete files in the workspace.");
      return ok({ ...state, mdi: "" });

    case "F4":
      if (state.display === "offset") {
        return ok({ ...state, offsetTab: state.offsetTab === "tool" ? "work" : "tool", offsetCursor: { row: 0, col: 0 } });
      }
      return ok(state);

    case "UP":
    case "DOWN":
    case "LEFT":
    case "RIGHT":
    case "PAGE_UP":
    case "PAGE_DOWN":
      return cursor(state, id);

    case "SELECT_PROGRAM":
    case "FORWARD": {
      if (state.mode !== "list") return no(state, "Select LIST PROGRAM first.");
      const name = sortedPrograms(state)[state.offsetCursor.row];
      if (!name) return ok(state);
      if (running(state)) return no(state, "A program is active. Press RESET first.");
      return ok({ ...state, activeProgram: name, mode: "memory", display: "program" }, { notice: `${name} is the active program.` });
    }
    case "BACK":
      return ok({ ...state, display: "position" });
  }

  if (NOT_SIMULATED.has(id)) return no(state, `${id.replace(/_/g, " ")}: not simulated yet.`);
  return ok(state);
}

/** The loaded tool `step` places round from the spindle's, in T order. */
function toolAfter(state: MachineState, step: 1 | -1): number {
  const loaded = [...new Set([...state.pockets, state.toolInSpindle])].filter(Boolean).sort((a, b) => a - b);
  const at = loaded.indexOf(state.toolInSpindle);
  return loaded[(at + step + loaded.length) % loaded.length] ?? 0;
}

/** A tool change from the keypad is the M06 a program would run — the head
 *  goes to the change position and the changer swaps — so it plays through
 *  the program runner as an "atc" run. */
function keypadToolChange(state: MachineState, tool: number): Outcome {
  if (state.doorOpen) return no(state, "Close the door for a tool change.");
  const blocked = motionBlocker(state);
  if (blocked) return no(state, blocked);
  if (!state.homed) return no(state, "Zero return first with POWER UP.");
  if (running(state)) return no(state, "A program is active. Press RESET first.");
  if (tool === state.toolInSpindle) return no(state, `T${tool} is already in the spindle.`);
  if (!state.tools[tool] || !state.pockets.includes(tool)) return no(state, `T${tool} is not in the carousel.`);
  return ok(
    { ...state, program: "running", runSource: "atc", atcTool: tool, programLine: 0, input: "" },
    { run: "start", notice: `Tool change: T${state.toolInSpindle} out, T${tool} in.` },
  );
}

/** ENTER adds the typed value to the highlighted offset; F1 replaces it. */
function enter(state: MachineState, replace: boolean): Outcome {
  if (state.mode === "mdi" && !replace) return mdiInsert(state);
  if (state.display !== "offset") return ok(state);
  const value = parseFloat(state.input);
  if (!Number.isFinite(value)) return no(state, "Type a number first.");
  const { row, col } = state.offsetCursor;
  if (state.offsetTab === "tool") {
    const t = row + 1;
    const field = TOOL_COLS[col];
    const current = state.tools[t] ?? { length: 0, lengthWear: 0, diameter: 0, diameterWear: 0 };
    const next = replace ? value : current[field] + value;
    return ok({ ...state, input: "", tools: { ...state.tools, [t]: { ...current, [field]: next } } });
  }
  const id = WORK_OFFSET_IDS[row];
  const axis = AXES[col];
  const current = state.workOffsets[id][axis];
  return ok({
    ...state,
    input: "",
    workOffsets: { ...state.workOffsets, [id]: { ...state.workOffsets[id], [axis]: replace ? value : current + value } },
  });
}

function mdiInsert(state: MachineState): Outcome {
  const line = state.input.trim().replace(/;$/, "");
  if (!line) return ok(state);
  return ok({ ...state, mdi: state.mdi ? `${state.mdi}\n${line}` : line, input: "" });
}

function cursor(state: MachineState, id: string): Outcome {
  const { row, col } = state.offsetCursor;
  const step = id === "PAGE_UP" ? -10 : id === "PAGE_DOWN" ? 10 : id === "UP" ? -1 : id === "DOWN" ? 1 : 0;
  const dCol = id === "LEFT" ? -1 : id === "RIGHT" ? 1 : 0;
  if (state.display === "list") {
    const n = sortedPrograms(state).length;
    return ok({ ...state, offsetCursor: { row: Math.min(n - 1, Math.max(0, row + step)), col: 0 } });
  }
  if (state.display !== "offset") return ok(state);
  const rows = state.offsetTab === "tool" ? TOOL_ROWS : WORK_OFFSET_IDS.length;
  const cols = state.offsetTab === "tool" ? TOOL_COLS.length : AXES.length;
  return ok({
    ...state,
    offsetCursor: {
      row: Math.min(rows - 1, Math.max(0, row + step)),
      col: Math.min(cols - 1, Math.max(0, col + dCol)),
    },
  });
}

function timer(state: MachineState, kind: TimerKind): Outcome {
  switch (kind) {
    case "boot": {
      if (state.control !== "booting") return ok(state);
      const alarms: Alarm[] = [ALARM.servosOff];
      if (state.estopPressed) alarms.push(ALARM.emergencyOff);
      if (!state.airValveOpen) alarms.push(ALARM.lowAir);
      return ok({ ...state, control: "on", alarms, mode: "memory" });
    }

    case "homing": {
      if (state.homingStage === null) return ok(state);
      const stage = nextStage(state.homingAxes, state.homingStage + 1);
      if (stage !== null) return ok(homeStage(state, stage), { start: ["homing"] });
      const all = state.homingAxes.length === AXES.length;
      return ok({ ...state, homingStage: null, homingAxes: [], homed: all ? true : state.homed });
    }
  }
}

/** Instant events from a running program: spindle, coolant, tool change,
 *  and the offset and retained-variable writes the control keeps. */
function runEvent(state: MachineState, event: Motion): Outcome {
  switch (event.kind) {
    case "workOffset": {
      const before = state.workOffsets[event.key] ?? { x: 0, y: 0, z: 0, b: 0, c: 0 };
      return ok({ ...state, workOffsets: { ...state.workOffsets, [event.key]: { ...before, ...event.value } } });
    }
    case "toolOffset": {
      const { number, length, lengthWear = 0, diameter, diameterWear = 0 } = event.entry;
      return ok({ ...state, tools: { ...state.tools, [number]: { length, lengthWear, diameter, diameterWear } } });
    }
    case "variable": {
      const macroVariables = { ...state.macroVariables };
      if (event.value === null) delete macroVariables[event.n];
      else macroVariables[event.n] = event.value;
      return ok({ ...state, macroVariables });
    }
    case "spindle":
      return ok({ ...state, spindle: { rpm: event.rpm || state.spindle.rpm, dir: event.dir } });
    case "coolant":
      return ok({ ...state, coolantOn: event.on && !state.doorOpen });
    case "toolChange":
      // The arm leaves the outgoing tool in the pocket the new one came from.
      return ok({
        ...state,
        toolInSpindle: event.tool,
        pockets: afterSwap(state.pockets, event.pocket, state.toolInSpindle),
        carouselPocket: event.pocket,
        spindle: SPINDLE_STOPPED,
      });
    default:
      return ok(state);
  }
}

/** Where a running program is: position, line, and the codes it has in force. */
function runAt(state: MachineState, action: Extract<MachineAction, { type: "runProgress" | "runHalt" }>): MachineState {
  const at = { ...state, position: action.position, programLine: action.line };
  if (!action.codes) return at;
  // "G154 P7" on the screen is the "G154P7" register.
  return { ...at, activeCodes: action.codes, activeWorkOffset: action.codes.workOffset.replace(/\s+/g, "") };
}

function runHalt(state: MachineState, action: Extract<MachineAction, { type: "runHalt" }>): Outcome {
  if (state.program === "idle") return ok(state);
  const at = runAt(state, action);
  switch (action.halt) {
    case "end": {
      // M30: spindle and coolant off, program rewound.
      const warmup = state.runSource === "memory" && state.activeProgram === "O09999";
      return ok(
        {
          ...at,
          program: "idle",
          runSource: null,
          spindle: SPINDLE_STOPPED,
          coolantOn: false,
          warmupDone: state.warmupDone || warmup,
          // A keypad tool change is not a program the operator ran.
          lastProgramDone:
            state.runSource === "atc"
              ? state.lastProgramDone
              : state.runSource === "mdi"
                ? "MDI"
                : state.activeProgram,
          atcTool: 0,
        },
        { run: "stop" },
      );
    }
    case "alarm":
      return ok(
        withAlarms({ ...at, program: "idle", runSource: null, spindle: SPINDLE_STOPPED, coolantOn: false }, {
          code: "program",
          text: action.alarm ?? "PROGRAM ERROR",
        }),
        { notice: `Program stopped at line ${action.line}: ${action.alarm ?? "error"}`, run: "stop" },
      );
    default:
      return ok({ ...at, program: "stopped" });
  }
}

/** Loading or unloading the vise: hands inside the machine. */
function stock(state: MachineState, next: StockOnMachine | null): Outcome {
  if (!state.doorOpen) return no(state, "Open the door to reach the vise.");
  if (running(state)) return no(state, "Stop the program before reaching into the machine.");
  if (spindleRpm(state) > 0) return no(state, "Wait for the spindle to stop.");
  return ok({ ...state, stock: next });
}

export function reduce(state: MachineState, action: MachineAction): Outcome {
  switch (action.type) {
    case "operate":
      return operate(state, action.part, action.sign);
    case "key":
      return key(state, action.key, action.shift);
    case "timer":
      return timer(state, action.timer);
    case "stock":
      return stock(state, action.stock);
    case "runEvent":
      return runEvent(state, action.event);
    case "runProgress":
      return state.program === "idle" ? ok(state) : ok(runAt(state, action));
    case "runHalt":
      return runHalt(state, action);
    case "crash":
      return ok(withAlarms(stopMotion(state), { code: "crash", text: action.text }), {
        notice: `${action.text} — the machine stopped. RESET to clear.`,
        run: "stop",
        cancel: ["homing"],
      });
  }
}

/** How long the timer the reducer just started should run. */
export function timerDelay(state: MachineState, kind: TimerKind): number {
  switch (kind) {
    case "boot":
      return BOOT_MS;
    case "homing":
      return HOMING_SEQUENCE[state.homingStage ?? 0].ms;
  }
}

export { initialMachineState };
