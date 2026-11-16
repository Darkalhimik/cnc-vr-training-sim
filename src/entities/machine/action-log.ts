/**
 * The action log of an attempt: everything that changed the machine, in
 * order, so the attempt can be played again exactly.
 *
 * The machine is a pure function of (state, action) — machine-logic.ts —
 * so an attempt is its starting state plus the actions the reducer was
 * given, each with its time from the start of the attempt. That includes
 * the timer events (the control finishing its boot, each stage of a zero
 * return) and a running program's reports (`run*`): they are inputs to the
 * reducer like a key press. A few changes do not go through the reducer —
 * a level handing over a machine, the setup shortcuts writing offsets, the
 * office PC writing the USB stick — and are logged as the fields they set.
 *
 * The reducer also reads the tools in the machine (the WIPS tool setter
 * measures the real one), so the log carries the loaded set too.
 *
 * Pure apart from the module's own recorder; Node runs it (logic-check).
 */
import { loadoutTools, activeTools, setActiveTools } from "@/entities/part/tool-library";
import type { MachineAction } from "./machine-logic";
import { reduce } from "./machine-logic";
import type { MachineState } from "./machine-types";

export const ACTION_LOG_VERSION = 1;

/** One change: an action given to the reducer, or fields set around it. */
export type LogEntry =
  | { /** ms from the start of the attempt */ t: number; a: MachineAction }
  | { t: number; set: Partial<MachineState> };

export type ActionLog = {
  version: typeof ACTION_LOG_VERSION;
  /** When the attempt started, ISO 8601. */
  startedAt: string;
  /** The tools loaded in the machine: tool number → crib tool. */
  tools: { number: number; assembly: string }[];
  /** The machine when the attempt started. */
  initial: MachineState;
  entries: LogEntry[];
};

let recording: { start: number; log: ActionLog } | null = null;

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Start logging an attempt that begins with the machine in `state`. */
export function beginActionLog(state: MachineState) {
  recording = {
    start: now(),
    log: {
      version: ACTION_LOG_VERSION,
      startedAt: new Date().toISOString(),
      tools: activeTools().map((t) => ({ number: t.number, assembly: t.assembly })),
      initial: state,
      entries: [],
    },
  };
}

/** Stop logging and hand over what was logged, or null if nothing was. */
export function endActionLog(): ActionLog | null {
  const log = recording?.log ?? null;
  recording = null;
  return log;
}

/** The log so far, without stopping it. */
export const currentActionLog = (): ActionLog | null => recording?.log ?? null;

const elapsed = () => (recording ? Math.round(now() - recording.start) : 0);

/** An action the reducer was given (machine-store's dispatch). */
export function logAction(action: MachineAction) {
  recording?.log.entries.push({ t: elapsed(), a: action });
}

/** A change made outside the reducer: the fields of `next` that differ from `before`. */
export function logSet(before: MachineState, next: MachineState) {
  if (!recording || before === next) return;
  const set: Partial<MachineState> = {};
  let changed = false;
  for (const key of Object.keys(next) as (keyof MachineState)[]) {
    if (next[key] !== before[key]) {
      (set as Record<string, unknown>)[key] = next[key];
      changed = true;
    }
  }
  if (changed) recording.log.entries.push({ t: elapsed(), set });
}

/**
 * The machine at the end of the logged attempt: the starting state with every
 * action given to the reducer again and every set applied, with the logged
 * tools loaded meanwhile.
 */
export function replayActionLog(log: ActionLog): MachineState {
  const loaded = activeTools();
  setActiveTools(loadoutTools(log.tools));
  try {
    let state = log.initial;
    for (const entry of log.entries) {
      state = "a" in entry ? reduce(state, entry.a).next : { ...state, ...entry.set };
    }
    return state;
  } finally {
    setActiveTools(loaded);
  }
}
