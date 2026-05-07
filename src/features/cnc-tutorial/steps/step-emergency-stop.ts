import type { TutorialStep } from "../tutorial-types";

export const stepEmergencyStop: TutorialStep = {
  id: "estop",
  title: "E-Stop Release",
  shortLabel: "E-Stop",
  phases: [
    {
      id: "estop-pull",
      instruction: "Pull the E-Stop button outward.",
      highlight: ["emergency_button"],
      expects: (e) => e.kind === "estop-extended",
    },
    {
      id: "estop-rotate",
      instruction: "Rotate the E-Stop clockwise to release it.",
      highlight: ["emergency_button"],
      expects: (e) => e.kind === "estop-released",
    },
  ],
};
