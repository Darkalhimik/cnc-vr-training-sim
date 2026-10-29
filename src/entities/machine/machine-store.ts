"use client";

import { create } from "zustand";
import type { MachinePartId } from "./machine-parts";
import { initialMachineState, readyMachineState, type MachineState, type StockOnMachine } from "./machine-types";
import { type MachineAction, type Outcome, type RunAction, type TimerKind, reduce, timerDelay } from "./machine-logic";
import { type ActiveRun, runWarning, startRun } from "./program-run";

export { initialMachineState };
export type { ActiveRun };

/**
 * The program the machine is executing, played by the scene each frame. Kept
 * out of React state: it changes every frame, and only the scene and the
 * machine store read it.
 */
let activeRun: ActiveRun | null = null;
export const getActiveRun = () => activeRun;

type MachineStore = {
  machine: MachineState;
  /** The control's message line: the last refusal or notice, for the
   *  pendant screen. Cleared by the next accepted action. */
  message: string | null;
  /** Operate a part. Returns the outcome so the caller can surface it. */
  operate: (part: MachinePartId, sign?: 1 | -1) => Outcome;
  /** A key on the full NGC keyboard. */
  pressKey: (key: string, shift?: boolean) => Outcome;
  setStock: (stock: StockOnMachine | null) => Outcome;
  /** For the scene's program runner: the `run*` actions of program-run.ts. */
  runAction: (action: RunAction) => void;
  crash: (text: string) => Outcome;
  /** Put a program in control memory (from the workspace); `select` makes it
   *  the active program. */
  loadProgram: (name: string, text: string, select?: boolean) => Outcome;
  /** Write offsets directly — the "probe it for me" shortcuts of setup. */
  setOffsets: (patch: Pick<Partial<MachineState>, "workOffsets" | "tools">) => void;
  reset: () => void;
  /** Skip the startup: the machine as the tutorial leaves it. */
  makeReady: () => void;
};

const timers = new Map<TimerKind, ReturnType<typeof setTimeout>>();

function clearTimers(kinds?: TimerKind[]) {
  for (const kind of kinds ?? [...timers.keys()]) {
    clearTimeout(timers.get(kind));
    timers.delete(kind);
  }
}

export const useMachineStore = create<MachineStore>((set, get) => {
  const dispatch = (action: MachineAction): Outcome => {
    const before = get().machine;
    const outcome = reduce(before, action);
    const { next, rejected, notice, start, cancel, run } = outcome;

    if (cancel) clearTimers(cancel);
    for (const kind of start ?? []) {
      clearTimers([kind]);
      timers.set(
        kind,
        setTimeout(() => {
          timers.delete(kind);
          dispatch({ type: "timer", timer: kind });
        }, timerDelay(next, kind)),
      );
    }

    let warning: string | null = null;
    if (run === "stop") activeRun = null;
    if (run === "start") {
      activeRun = startRun(before, next);
      warning = runWarning(activeRun.result);
    }

    const keepMessage = action.type === "timer" || action.type.startsWith("run");
    const message = rejected ?? notice ?? warning ?? (keepMessage ? get().message : null);
    if (next !== get().machine || message !== get().message) set({ machine: next, message });
    return outcome;
  };

  return {
    machine: initialMachineState,
    message: null,
    operate: (part, sign) => dispatch({ type: "operate", part, sign }),
    pressKey: (key, shift) => dispatch({ type: "key", key, shift }),
    setStock: (stock) => dispatch({ type: "stock", stock }),
    runAction: (action) => void dispatch(action),
    crash: (text) => dispatch({ type: "crash", text }),
    loadProgram: (name, text, select = true) => {
      const { machine } = get();
      if (select && machine.program !== "idle") {
        return { next: machine, rejected: "A program is running. Press RESET before loading another." };
      }
      const next = {
        ...machine,
        programs: { ...machine.programs, [name]: text },
        activeProgram: select ? name : machine.activeProgram,
      };
      set({ machine: next, message: `${name} loaded${select ? " and selected" : ""}.` });
      return { next };
    },
    setOffsets: (patch) => set({ machine: { ...get().machine, ...patch } }),
    reset: () => {
      clearTimers();
      activeRun = null;
      set({ machine: initialMachineState, message: null });
    },
    makeReady: () => {
      clearTimers();
      activeRun = null;
      set({ machine: { ...readyMachineState, stock: get().machine.stock }, message: null });
    },
  };
});
