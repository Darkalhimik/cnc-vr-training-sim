/**
 * The machine's behaviour, as a pure function of (state, action).
 *
 * No timers live here. A slow process — the control booting, a zero return,
 * the warm-up program — is a run of steps: the reducer starts it by asking for
 * a timer, and the store feeds the timer back in as an action when it fires.
 * That keeps every rule in one place and testable without a clock.
 */
import type { MachinePartId } from "./machine-parts";
import {
  ALARM_TEXT,
  type AlarmCode,
  type Axis,
  type MachineState,
  initialMachineState,
} from "./machine-types";

export type TimerKind = "boot" | "homing" | "program";

export type MachineAction =
  | { type: "operate"; part: MachinePartId; /** handwheel direction */ sign?: 1 | -1 }
  | { type: "timer"; timer: TimerKind };

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
};

export const BOOT_MS = 3500;

/** Zero return order on a Haas: Z clears the work first, then the rest. */
export const HOMING_SEQUENCE: { axes: Axis[]; ms: number }[] = [
  { axes: ["z"], ms: 1600 },
  { axes: ["x", "y"], ms: 1800 },
  { axes: ["b", "c"], ms: 1800 },
];

/** Spindle warm-up: a stepped speed ramp, shortened from the real 20 minutes. */
export const WARMUP_PROGRAM: { rpm: number; ms: number }[] = [
  { rpm: 1000, ms: 2500 },
  { rpm: 4000, ms: 2500 },
  { rpm: 8100, ms: 3000 },
];

/** Travel, in machine coordinates. C is a continuous rotary. */
export const TRAVEL: Record<Axis, [number, number] | null> = {
  x: [-610, 0],
  y: [-406, 0],
  z: [-406, 0],
  b: [-110, 35],
  c: null,
};

/** Handwheel increment per detent: coarse, so a few turns show movement. */
export const JOG_STEP: Record<Axis, number> = { x: 10, y: 10, z: 10, b: 5, c: 15 };

const AXIS_OF: Partial<Record<MachinePartId, Axis>> = {
  axis_x: "x",
  axis_y: "y",
  axis_z: "z",
  axis_b: "b",
  axis_c: "c",
};

export const spindleRpm = (m: MachineState) =>
  m.program === "idle" ? 0 : (WARMUP_PROGRAM[m.programBlock]?.rpm ?? 0);

const ok = (next: MachineState, extra: Omit<Outcome, "next"> = {}): Outcome => ({ next, ...extra });
const no = (state: MachineState, reason: string): Outcome => ({ next: state, rejected: reason });

function withAlarms(state: MachineState, ...codes: AlarmCode[]): MachineState {
  const alarms = [...state.alarms];
  for (const code of codes) if (!alarms.includes(code)) alarms.push(code);
  return { ...state, alarms };
}

/** Everything the control holds in memory, as it is after a power loss. */
function controlDown(state: MachineState): MachineState {
  return {
    ...state,
    control: "off",
    alarms: [],
    mode: "memory",
    jogAxis: null,
    homed: false,
    homingStage: null,
    coolantOn: false,
    program: "idle",
    programBlock: 0,
    warmupDone: false,
  };
}

/** Servos dropping out mid-motion: homing is lost, the program stops. */
function stopMotion(state: MachineState): MachineState {
  const homingAborted = state.homingStage !== null;
  return {
    ...state,
    homingStage: null,
    homed: homingAborted ? false : state.homed,
    coolantOn: false,
    program: "idle",
    programBlock: 0,
  };
}

/** Why the control will not move an axis right now, if it will not. */
function motionBlocker(state: MachineState): string | null {
  if (state.control === "off") return "The control is off. Press POWER ON first.";
  if (state.control === "booting") return "Wait for the control to finish booting.";
  if (state.alarms.length > 0) {
    return `Clear the alarms first with RESET (${state.alarms.map((a) => ALARM_TEXT[a]).join(", ")}).`;
  }
  return null;
}

function operate(state: MachineState, part: MachinePartId, sign: 1 | -1 = 1): Outcome {
  switch (part) {
    case "air_valve": {
      if (!state.airValveOpen) return ok({ ...state, airValveOpen: true });
      const closed = { ...state, airValveOpen: false };
      if (state.control !== "on") return ok(closed);
      return ok(withAlarms(stopMotion(closed), "low-air", "102"), {
        notice: "Air pressure lost — the control raised LOW AIR PRESSURE and dropped the servos.",
        cancel: ["homing", "program"],
      });
    }

    case "main_switch": {
      if (!state.mainSwitchOn) return ok({ ...state, mainSwitchOn: true });
      const off = { ...state, mainSwitchOn: false };
      if (state.control === "off") return ok(off);
      return ok(controlDown(off), {
        notice: "Mains cut with the control running. Shut down with POWER OFF before the main disconnect.",
        cancel: ["boot", "homing", "program"],
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
      return ok(controlDown(state), { cancel: ["boot", "homing", "program"] });

    case "estop": {
      if (state.estopPressed) return ok({ ...state, estopPressed: false });
      const pressed = stopMotion({ ...state, estopPressed: true });
      if (state.control !== "on") return ok(pressed);
      return ok(withAlarms(pressed, "107", "102"), { cancel: ["homing", "program"] });
    }

    case "reset": {
      if (state.control === "off") return no(state, "The control is off.");
      if (state.control === "booting") return no(state, "Wait for the control to finish booting.");
      const stillTrue = state.alarms.filter(
        (a) =>
          (a === "107" && state.estopPressed) ||
          (a === "low-air" && !state.airValveOpen),
      );
      // 102 clears with the last of the others: the servos come back on.
      const alarms: AlarmCode[] = stillTrue.length > 0 ? ["102", ...stillTrue] : [];
      // RESET also stops whatever is moving — a zero return cut short has to
      // be started again.
      const next = { ...stopMotion(state), alarms };
      const cancel: TimerKind[] = ["homing", "program"];
      if (stillTrue.length === 0) return ok(next, { cancel });
      const why = stillTrue
        .map((a) => (a === "107" ? "release the E-stop" : "open the air supply"))
        .join(" and ");
      return ok(next, {
        notice: `RESET could not clear ${stillTrue.map((a) => ALARM_TEXT[a]).join(", ")} — ${why} first.`,
        cancel,
      });
    }

    case "power_up": {
      const blocked = motionBlocker(state);
      if (blocked) return no(state, blocked);
      if (state.doorOpen) return no(state, "Close the door. POWER UP will not move the axes with it open.");
      if (state.program !== "idle") return no(state, "Stop the program with RESET first.");
      if (state.homingStage !== null) return ok(state);
      return ok(homeStage({ ...state, homed: false, jogAxis: null }, 0), { start: ["homing"] });
    }

    case "memory":
      if (state.control !== "on") return no(state, "The control is off.");
      return ok({ ...state, mode: "memory", jogAxis: null });

    case "hand_jog":
      if (state.control !== "on") return no(state, "The control is off.");
      if (state.program !== "idle") return no(state, "A program is active. Press RESET before switching to jog.");
      return ok({ ...state, mode: "jog" });

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
      const blocked = motionBlocker(state);
      if (blocked) return no(state, blocked);
      if (state.homingStage !== null) return no(state, "Wait for the zero return to finish.");
      if (!state.homed) {
        return no(state, "Zero return first with POWER UP — the control does not know where the axes are.");
      }
      const axis = state.jogAxis;
      const from = state.position[axis];
      const limits = TRAVEL[axis];
      let to = from + sign * JOG_STEP[axis];
      if (limits) to = Math.min(limits[1], Math.max(limits[0], to));
      if (to === from) {
        return no(state, `${axis.toUpperCase()} is at its ${sign > 0 ? "plus" : "minus"} travel limit.`);
      }
      return ok({ ...state, position: { ...state.position, [axis]: to } });
    }

    case "coolant": {
      if (state.coolantOn) return ok({ ...state, coolantOn: false });
      const blocked = motionBlocker(state);
      if (blocked) return no(state, blocked);
      if (state.doorOpen) return no(state, "Close the door before switching the coolant on.");
      return ok({ ...state, coolantOn: true });
    }

    case "cycle_start": {
      const blocked = motionBlocker(state);
      if (blocked) return no(state, blocked);
      if (!state.homed) return no(state, "Zero return first with POWER UP.");
      if (state.mode !== "memory") return no(state, "Select MEMORY mode to run the warm-up program.");
      if (state.doorOpen) return no(state, "Close the door to run a program.");
      if (state.program === "running") return ok(state);
      return ok({ ...state, program: "running" }, { start: ["program"] });
    }

    case "feed_hold":
      if (state.program !== "running") return ok(state);
      return ok({ ...state, program: "hold" }, { cancel: ["program"] });

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
          cancel: ["program"],
        });
      }
      return ok(open);
    }

    case "air_gauge":
    case "screen":
    case "pendant":
    case "enclosure":
    case "spindle":
    case "trunnion":
    case "tool_changer":
      return ok(state);
  }
}

/** Starts zero-return stage `stage`: its axes are commanded to 0. */
function homeStage(state: MachineState, stage: number): MachineState {
  const position = { ...state.position };
  for (const axis of HOMING_SEQUENCE[stage].axes) position[axis] = 0;
  return { ...state, homingStage: stage, position };
}

function timer(state: MachineState, kind: TimerKind): Outcome {
  switch (kind) {
    case "boot": {
      if (state.control !== "booting") return ok(state);
      const alarms: AlarmCode[] = ["102"];
      if (state.estopPressed) alarms.push("107");
      if (!state.airValveOpen) alarms.push("low-air");
      return ok({ ...state, control: "on", alarms, mode: "memory" });
    }

    case "homing": {
      if (state.homingStage === null) return ok(state);
      const nextStage = state.homingStage + 1;
      if (nextStage < HOMING_SEQUENCE.length) {
        return ok(homeStage(state, nextStage), { start: ["homing"] });
      }
      return ok({ ...state, homingStage: null, homed: true });
    }

    case "program": {
      if (state.program !== "running") return ok(state);
      const nextBlock = state.programBlock + 1;
      if (nextBlock < WARMUP_PROGRAM.length) {
        return ok({ ...state, programBlock: nextBlock }, { start: ["program"] });
      }
      return ok({ ...state, program: "idle", programBlock: 0, warmupDone: true });
    }
  }
}

export function reduce(state: MachineState, action: MachineAction): Outcome {
  return action.type === "operate"
    ? operate(state, action.part, action.sign)
    : timer(state, action.timer);
}

/** How long the timer the reducer just started should run. */
export function timerDelay(state: MachineState, kind: TimerKind): number {
  switch (kind) {
    case "boot":
      return BOOT_MS;
    case "homing":
      return HOMING_SEQUENCE[state.homingStage ?? 0].ms;
    case "program":
      return WARMUP_PROGRAM[state.programBlock].ms;
  }
}

export { initialMachineState };
