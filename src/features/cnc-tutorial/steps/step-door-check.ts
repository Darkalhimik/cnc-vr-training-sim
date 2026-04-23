import type { TutorialStep } from "../tutorial-types";

export const stepDoorCheck: TutorialStep = {
  id: "step-door-check",
  title: "Door Safety Check",
  description: "Open the safety door, then close it to verify the interlock system.",
  highlight: ["door"],
  actionLabel: "Cycle the door",
  isComplete: (state) => state.doorCycleComplete,
  subSteps: [
    {
      id: "door-open",
      instruction: "Open the safety door.",
      highlight: ["door"],
      isComplete: (state) => state.doorOpenedOnce,
    },
    {
      id: "door-close",
      instruction: "Close the door to verify the safety interlock.",
      highlight: ["door"],
      isComplete: (state) => state.doorCycleComplete,
    },
  ],
};
