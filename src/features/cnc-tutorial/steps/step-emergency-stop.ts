import type { TutorialStep } from "../tutorial-types";

export const stepEmergencyStop: TutorialStep = {
  id: "estop",
  title: "E-stop release",
  shortLabel: "E-Stop",
  guard: {
    holds: (m) => m.estop === "released",
    violation: "The E-Stop was engaged again. Release it before going on.",
  },
  phases: [
    {
      id: "estop-pull",
      instruction: "Pull the E-Stop button outward.",
      highlight: ["emergency_button"],
      expects: (e) => e.kind === "estop-extended",
      satisfied: (m) => m.estop !== "engaged",
    },
    {
      id: "estop-rotate",
      instruction: "Rotate the E-Stop clockwise to release it.",
      highlight: ["emergency_button"],
      expects: (e) => e.kind === "estop-released",
      satisfied: (m) => m.estop === "released",
    },
  ],
};
