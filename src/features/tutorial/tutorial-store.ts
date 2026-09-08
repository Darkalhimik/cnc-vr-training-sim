"use client";

import { create } from "zustand";
import { useMachineStore } from "@/entities/machine/machine-store";
import { cncTutorialSteps } from "@/features/cnc-tutorial/steps";
import type { InteractionEvent } from "@/entities/machine/interaction-events";
import type { MachinePartId } from "@/entities/machine/machine-parts";
import type { MachineState } from "@/entities/machine/machine-types";
import type { TutorialStep } from "@/features/cnc-tutorial/tutorial-types";

type TutorialStatus = "active" | "complete";

type TutorialStore = {
  stepIndex: number;
  phaseIndex: number;
  status: TutorialStatus;
  celebrationDismissed: boolean;
  startedAt: number;

  /** Returns the violation message when a completed step was undone. */
  consumeEvent: (event: InteractionEvent) => string | null;
  reset: () => void;
  dismissCelebration: () => void;
};

/**
 * The first phase whose outcome the machine does not already show. Sending the
 * user back to a step should not ask for something that is already true — with
 * the door left open, the door step resumes at "close the door".
 */
function entryPhaseIndex(step: TutorialStep, machine: MachineState) {
  const index = step.phases.findIndex((phase) => !phase.satisfied?.(machine));
  return index === -1 ? step.phases.length - 1 : index;
}

export const useTutorialStore = create<TutorialStore>((set, get) => ({
  stepIndex: 0,
  phaseIndex: 0,
  status: "active",
  celebrationDismissed: false,
  startedAt: Date.now(),

  consumeEvent: (event) => {
    const { stepIndex, phaseIndex, status } = get();

    // 1. Advance, if this is what the current phase was waiting for. Once
    //    complete there is nothing left to advance, but the safety re-check
    //    below still runs — that gap is what let a finished sequence be taken
    //    apart with no consequence.
    if (status === "active") {
      const step = cncTutorialSteps[stepIndex];
      const phase = step?.phases[phaseIndex];

      if (phase?.expects(event)) {
        const isLastPhase = phaseIndex + 1 >= step.phases.length;
        if (!isLastPhase) {
          set({ phaseIndex: phaseIndex + 1 });
        } else {
          const nextStepIndex = stepIndex + 1;
          set({
            stepIndex: nextStepIndex,
            phaseIndex: 0,
            status:
              nextStepIndex >= cncTutorialSteps.length ? "complete" : "active",
          });
        }
      }
    }

    // 2. Re-check every step already completed. Undoing one sends the user
    //    back to it, earliest first, because a later step's prerequisites are
    //    the earlier ones.
    const machine = useMachineStore.getState().machine;
    const completed = Math.min(get().stepIndex, cncTutorialSteps.length);

    for (let i = 0; i < completed; i++) {
      const step = cncTutorialSteps[i];
      if (step.guard.holds(machine)) continue;

      set({
        stepIndex: i,
        phaseIndex: entryPhaseIndex(step, machine),
        status: "active",
        celebrationDismissed: false,
      });
      return step.guard.violation;
    }

    return null;
  },

  reset: () => {
    useMachineStore.getState().reset();
    set({
      stepIndex: 0,
      phaseIndex: 0,
      status: "active",
      celebrationDismissed: false,
      startedAt: Date.now(),
    });
  },

  dismissCelebration: () => set({ celebrationDismissed: true }),
}));

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

