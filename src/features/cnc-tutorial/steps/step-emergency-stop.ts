import type { TutorialStep } from "../tutorial-types";

export const stepEmergencyStop: TutorialStep = {
  id: "estop",
  title: "E-stop release",
  shortLabel: "E-Stop",
  guard: {
    holds: (m) => !m.estopPressed,
    violation: "The E-stop was pressed. Twist it to release it, then RESET.",
  },
  phases: [
    {
      id: "estop-release",
      instruction: "Twist the red EMERGENCY STOP clockwise until it pops out.",
      highlight: ["estop"],
      done: (m) => !m.estopPressed,
    },
  ],
};
