"use client";

import { create } from "zustand";
import type { MachinePartId } from "./machine-parts";
import { initialMachineState, type MachineState } from "./machine-types";
import {
  type MachineAction,
  type Outcome,
  type TimerKind,
  reduce,
  timerDelay,
} from "./machine-logic";

export { initialMachineState };

type MachineStore = {
  machine: MachineState;
  /** The control's message line: the last refusal or notice, for the
   *  pendant screen. Cleared by the next accepted action. */
  message: string | null;
  /** Operate a part. Returns the outcome so the caller can surface it. */
  operate: (part: MachinePartId, sign?: 1 | -1) => Outcome;
  reset: () => void;
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
    const outcome = reduce(get().machine, action);
    const { next, rejected, notice, start, cancel } = outcome;

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

    const message = rejected ?? notice ?? (action.type === "operate" ? null : get().message);
    if (next !== get().machine || message !== get().message) set({ machine: next, message });
    return outcome;
  };

  return {
    machine: initialMachineState,
    message: null,
    operate: (part, sign) => dispatch({ type: "operate", part, sign }),
    reset: () => {
      clearTimers();
      set({ machine: initialMachineState, message: null });
    },
  };
});
