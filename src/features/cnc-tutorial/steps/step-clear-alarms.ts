import type { TutorialStep } from "../tutorial-types";

export const stepClearAlarms: TutorialStep = {
  id: "clear-alarms",
  title: "Clear alarms",
  shortLabel: "Reset",
  guard: {
    holds: (m) => m.alarms.length === 0,
    violation: "An alarm is active again. Fix its cause and clear it with RESET.",
  },
  phases: [
    {
      id: "press-reset",
      instruction:
        "Press RESET to clear 107 EMERGENCY OFF and 102 SERVOS OFF. The alarm list on the screen should empty.",
      highlight: ["reset"],
      done: (m) => m.control === "on" && m.alarms.length === 0,
    },
  ],
};
