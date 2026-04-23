"use client";

import { create } from "zustand";
import { useMachineStore } from "@/entities/machine/machine-store";
import { cncTutorialSteps } from "@/features/cnc-tutorial/steps";

type StepStatus = "active" | "completing" | "completed";

type TutorialStore = {
  stepIndex: number;
  subStepIndex: number;
  stepStatus: StepStatus;
  isComplete: boolean;
  message: string;
  showCelebration: boolean;
  startedAt: number;

  checkStepCompletion: () => void;
  goToNextStep: () => void;
  reset: () => void;
  dismissCelebration: () => void;
};

export const useTutorialStore = create<TutorialStore>((set, get) => ({
  stepIndex: 0,
  subStepIndex: 0,
  stepStatus: "active",
  isComplete: false,
  message: "Open the rear air valve to begin.",
  showCelebration: false,
  startedAt: Date.now(),

  checkStepCompletion: () => {
    const { stepIndex, subStepIndex, isComplete: alreadyDone } = get();
    if (alreadyDone) return;

    const machine = useMachineStore.getState().machine;
    const step = cncTutorialSteps[stepIndex];
    if (!step) return;

    // Check sub-steps first
    if (step.subSteps && step.subSteps.length > 0) {
      const currentSub = step.subSteps[subStepIndex];
      if (currentSub && currentSub.isComplete(machine)) {
        const nextSubIndex = subStepIndex + 1;
        if (nextSubIndex < step.subSteps.length) {
          set({
            subStepIndex: nextSubIndex,
            message: step.subSteps[nextSubIndex].instruction,
          });
          return;
        }
        // All sub-steps done — fall through to check main step
      }
    }

    if (step.isComplete(machine)) {
      const nextStepIndex = stepIndex + 1;

      if (nextStepIndex >= cncTutorialSteps.length) {
        set({
          stepIndex: nextStepIndex,
          subStepIndex: 0,
          stepStatus: "completed",
          isComplete: true,
          showCelebration: true,
          message: "Machine startup sequence complete!",
        });
        return;
      }

      const nextStep = cncTutorialSteps[nextStepIndex];
      const nextMessage = nextStep.subSteps?.[0]?.instruction ?? nextStep.description;

      set({
        stepIndex: nextStepIndex,
        subStepIndex: 0,
        stepStatus: "active",
        message: nextMessage,
      });
    }
  },

  goToNextStep: () => {
    const { stepIndex, isComplete: done } = get();
    if (done) return;

    const machine = useMachineStore.getState().machine;
    const step = cncTutorialSteps[stepIndex];
    if (!step || !step.isComplete(machine)) {
      set({ message: "Complete the current step first." });
      return;
    }

    const nextStepIndex = stepIndex + 1;
    if (nextStepIndex >= cncTutorialSteps.length) {
      set({
        stepIndex: nextStepIndex,
        subStepIndex: 0,
        stepStatus: "completed",
        isComplete: true,
        showCelebration: true,
        message: "Machine startup sequence complete!",
      });
      return;
    }

    const nextStep = cncTutorialSteps[nextStepIndex];
    set({
      stepIndex: nextStepIndex,
      subStepIndex: 0,
      stepStatus: "active",
      message: nextStep.subSteps?.[0]?.instruction ?? nextStep.description,
    });
  },

  reset: () => {
    useMachineStore.getState().reset();
    set({
      stepIndex: 0,
      subStepIndex: 0,
      stepStatus: "active",
      isComplete: false,
      message: "Open the rear air valve to begin.",
      showCelebration: false,
      startedAt: Date.now(),
    });
  },

  dismissCelebration: () => set({ showCelebration: false }),
}));
