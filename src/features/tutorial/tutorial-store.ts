"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { useMachineStore } from "@/entities/machine/machine-store";
import { cncTutorialSteps } from "@/features/cnc-tutorial/steps";
import type { MachinePartId } from "@/entities/machine/machine-parts";
import type { MachineState } from "@/entities/machine/machine-types";
import { advanceTutorial, type TutorialCursor } from "@/features/cnc-tutorial/tutorial-engine";
import { showToast } from "@/shared/lib/notifications";

type TutorialStore = {
  stepIndex: number;
  phaseIndex: number;
  status: TutorialCursor["status"];
  reached: number;
  celebrationDismissed: boolean;
  startedAt: number;

  /**
   * Bring the tutorial in line with the machine. Returns the violation message
   * when a completed step was undone.
   */
  sync: (machine: MachineState) => string | null;
  reset: () => void;
  dismissCelebration: () => void;
};

export const useTutorialStore = create<TutorialStore>((set, get) => ({
  stepIndex: 0,
  phaseIndex: 0,
  status: "active",
  reached: 0,
  celebrationDismissed: false,
  startedAt: Date.now(),

  sync: (machine) => {
    const { stepIndex, phaseIndex, status, reached } = get();
    const { cursor, violation } = advanceTutorial(
      cncTutorialSteps,
      { stepIndex, phaseIndex, status, reached },
      machine,
    );
    if (
      cursor.stepIndex !== stepIndex ||
      cursor.phaseIndex !== phaseIndex ||
      cursor.status !== status ||
      cursor.reached !== reached
    ) {
      set({ ...cursor, ...(violation ? { celebrationDismissed: false } : {}) });
    }
    return violation;
  },

  reset: () => {
    // Tutorial first: resetting the machine triggers a sync, and run against
    // the old step it would report every completed step as undone.
    set({
      stepIndex: 0,
      phaseIndex: 0,
      status: "active",
      reached: 0,
      celebrationDismissed: false,
      startedAt: Date.now(),
    });
    useMachineStore.getState().reset();
  },

  dismissCelebration: () => set({ celebrationDismissed: true }),
}));

/**
 * Keeps the tutorial following the machine while mounted. The tutorial reads
 * machine state, not clicks, so it has to hear timer-driven changes — the boot
 * finishing, the zero return arriving — as well as the trainee's own actions.
 */
export function useTutorialSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const sync = (machine: MachineState) => {
      const violation = useTutorialStore.getState().sync(machine);
      if (violation) showToast(violation, "warning");
    };
    sync(useMachineStore.getState().machine);
    return useMachineStore.subscribe((state, prev) => {
      if (state.machine !== prev.machine) sync(state.machine);
    });
  }, [enabled]);
}

// Derived selectors — keep consumers from reaching into cncTutorialSteps directly.
// Each selector must return a referentially stable value when the store hasn't
// changed, or React's useSyncExternalStore will loop. The step-module arrays
// are stable singletons; we just route through a frozen EMPTY for misses.

const EMPTY_HIGHLIGHTS: MachinePartId[] = [];

export const useCurrentStep = () =>
  useTutorialStore((s) => cncTutorialSteps[s.stepIndex] ?? null);

export const useCurrentPhase = () =>
  useTutorialStore((s) => cncTutorialSteps[s.stepIndex]?.phases[s.phaseIndex] ?? null);

export const useTutorialHighlights = (): MachinePartId[] =>
  useTutorialStore((s) => {
    if (s.status === "complete") return EMPTY_HIGHLIGHTS;
    return cncTutorialSteps[s.stepIndex]?.phases[s.phaseIndex]?.highlight ?? EMPTY_HIGHLIGHTS;
  });
