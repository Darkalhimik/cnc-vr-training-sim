"use client";

import { create } from "zustand";
import { useMachineStore } from "@/entities/machine/machine-store";
import { cncTutorialSteps } from "@/features/cnc-tutorial/steps";
import type { InteractionEvent } from "@/entities/machine/interaction-events";
import type { MachinePartId } from "@/entities/machine/machine-parts";

type TutorialStatus = "active" | "complete";

type TutorialStore = {
  stepIndex: number;
  phaseIndex: number;
  status: TutorialStatus;
  celebrationDismissed: boolean;
  startedAt: number;

  consumeEvent: (event: InteractionEvent) => void;
  reset: () => void;
  dismissCelebration: () => void;
};

export const useTutorialStore = create<TutorialStore>((set, get) => ({
  stepIndex: 0,
  phaseIndex: 0,
  status: "active",
  celebrationDismissed: false,
  startedAt: Date.now(),

  consumeEvent: (event) => {
    const { stepIndex, phaseIndex, status } = get();
    if (status === "complete") return;

    const step = cncTutorialSteps[stepIndex];
    const phase = step?.phases[phaseIndex];
    if (!phase || !phase.expects(event)) return;

    const isLastPhase = phaseIndex + 1 >= step.phases.length;
    if (!isLastPhase) {
      set({ phaseIndex: phaseIndex + 1 });
      return;
    }

    const nextStepIndex = stepIndex + 1;
    if (nextStepIndex >= cncTutorialSteps.length) {
      set({ stepIndex: nextStepIndex, phaseIndex: 0, status: "complete" });
      return;
    }

    set({ stepIndex: nextStepIndex, phaseIndex: 0 });
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

export const useTutorialInstruction = (): string =>
  useTutorialStore((s) => {
    if (s.status === "complete") return "Machine startup sequence complete.";
    return cncTutorialSteps[s.stepIndex]?.phases[s.phaseIndex]?.instruction ?? "";
  });
