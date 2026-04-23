import { create } from "zustand";
import type { MachinePartId } from "@/entities/machine/machine-parts";
import { initialMachineState } from "@/entities/machine/haas-umc500";
import { applyPartInteraction, getStepByIndex, isTutorialComplete } from "./tutorial-engine";
import { cncTutorialSteps } from "./steps";
import type { MachineState } from "./tutorial-types";

type TutorialStore = {
  stepIndex: number;
  machine: MachineState;
  message: string;
  interactWithPart: (partId: MachinePartId) => void;
  goToNextStep: () => void;
  reset: () => void;
};

export const useTutorialState = create<TutorialStore>((set, get) => ({
  stepIndex: 0,
  machine: initialMachineState,
  message: "Start by opening the air supply.",

  interactWithPart: (partId) => {
    const { stepIndex, machine } = get();
    if (isTutorialComplete(stepIndex)) {
      set({ message: "Tutorial already finished. Press Reset to start over." });
      return;
    }

    const step = getStepByIndex(stepIndex);
    const { nextState, eventMessage } = applyPartInteraction(partId, machine);
    const stepCompleted = step.isComplete(nextState);

    if (stepCompleted) {
      const nextStepIndex = stepIndex + 1;
      if (nextStepIndex >= cncTutorialSteps.length) {
        set({
          machine: nextState,
          stepIndex: nextStepIndex,
          message: "Machine preparation completed successfully.",
        });
        return;
      }

      set({
        machine: nextState,
        stepIndex: nextStepIndex,
        message: `${eventMessage} Next: ${cncTutorialSteps[nextStepIndex].title}`,
      });
      return;
    }

    set({
      machine: nextState,
      message: eventMessage,
    });
  },

  goToNextStep: () => {
    const { stepIndex, machine } = get();
    if (isTutorialComplete(stepIndex)) {
      return;
    }

    const currentStep = getStepByIndex(stepIndex);
    if (!currentStep.isComplete(machine)) {
      set({ message: "Current step is not yet completed." });
      return;
    }

    const nextStepIndex = stepIndex + 1;
    if (nextStepIndex >= cncTutorialSteps.length) {
      set({
        stepIndex: nextStepIndex,
        message: "Machine preparation completed successfully.",
      });
      return;
    }

    set({
      stepIndex: nextStepIndex,
      message: `Moving to: ${cncTutorialSteps[nextStepIndex].title}`,
    });
  },

  reset: () => {
    set({
      stepIndex: 0,
      machine: initialMachineState,
      message: "Start by opening the air supply.",
    });
  },
}));
