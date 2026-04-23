import type { TutorialStep } from "../tutorial-types";

export const stepEmergencyStop: TutorialStep = {
  id: "step-emergency-stop",
  title: "E-Stop Release",
  description: "Pull the emergency stop button outward, then rotate it clockwise to release.",
  highlight: ["emergency_button"],
  actionLabel: "Release the E-Stop",
  isComplete: (state) => state.emergencyReleased,
  subSteps: [
    {
      id: "estop-pull",
      instruction: "Pull the E-Stop button outward.",
      highlight: ["emergency_button"],
      isComplete: (state) => state.emergencyExtended,
    },
    {
      id: "estop-rotate",
      instruction: "Rotate the E-Stop clockwise to release it.",
      highlight: ["emergency_button"],
      isComplete: (state) => state.emergencyReleased,
    },
  ],
};
