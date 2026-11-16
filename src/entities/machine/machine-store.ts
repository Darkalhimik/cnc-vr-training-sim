"use client";

import { create } from "zustand";
import type { MachinePartId } from "./machine-parts";
import { initialMachineState, readyMachineState, type MachineState, type StockOnMachine } from "./machine-types";
import { type MachineAction, type Outcome, type RunAction, type TimerKind, reduce, timerDelay } from "./machine-logic";
import { type ActiveRun, runWarning, startRun } from "./program-run";
import { logAction, logSet } from "./action-log";

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
  /** Put a program straight into control memory; `select` makes it the
   *  active program. For setting up a level's start and for checks: a
   *  trainee's program reaches the control on the USB stick (writeUsb) and is
   *  loaded from LIST PROGRAM. */
  loadProgram: (name: string, text: string, select?: boolean) => Outcome;
  /** The office PC writes a program to the USB stick in the pendant's port. */
  writeUsb: (name: string, text: string) => void;
  /** Write offsets directly. For level starts and checks only. */
  setOffsets: (patch: Pick<Partial<MachineState>, "workOffsets" | "tools">) => void;
  /** Another set of tools in the changer: tool table, pocket table, the
   *  spindle's tool and the pocket at the arm (features/tooling). */
  setMagazine: (patch: Pick<MachineState, "tools" | "pockets" | "toolInSpindle" | "carouselPocket">) => void;
  reset: () => void;
  /** Put the machine in a given state: where a level starts. */
  load: (state: MachineState) => void;
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
  /** A change made outside the reducer: logged as the fields it sets, so an
   *  attempt's action log replays it too (action-log.ts). */
  const setMachine = (machine: MachineState, message: string | null) => {
    logSet(get().machine, machine);
    set({ machine, message });
  };

  const dispatch = (action: MachineAction): Outcome => {
    // Every input to the reducer — keys, parts, timers, a program's reports.
    logAction(action);
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
      setMachine(next, `${name} loaded${select ? " and selected" : ""}.`);
      return { next };
    },
    writeUsb: (name, text) => {
      const { machine } = get();
      if (!machine.usb || machine.usb[name] === text) return;
      setMachine({ ...machine, usb: { ...machine.usb, [name]: text } }, get().message);
    },
    setOffsets: (patch) => setMachine({ ...get().machine, ...patch }, get().message),
    setMagazine: (patch) => setMachine({ ...get().machine, ...patch }, "Tools loaded. Measure the new ones before cutting."),
    reset: () => {
      clearTimers();
      activeRun = null;
      setMachine(initialMachineState, null);
    },
    load: (state) => {
      clearTimers();
      activeRun = null;
      setMachine(state, null);
    },
    makeReady: () => {
      clearTimers();
      activeRun = null;
      setMachine({ ...readyMachineState, stock: get().machine.stock }, null);
    },
  };
});
