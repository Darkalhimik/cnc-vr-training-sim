import type { TutorialStep } from "../tutorial-types";

export const stepZeroReturn: TutorialStep = {
  id: "zero-return",
  title: "Zero return",
  shortLabel: "Home",
  guard: {
    holds: (m) => m.homed,
    violation: "The zero return was lost. Press POWER UP to home the machine again.",
  },
  phases: [
    {
      id: "press-power-up",
      instruction: "Press POWER UP to send every axis home.",
      highlight: ["power_up"],
      done: (m) => m.homingStage !== null || m.homed,
    },
    {
      id: "wait-home",
      instruction: "Watch through the door: Z goes up first, then X and Y, then the trunnion levels and the platter turns to zero.",
      highlight: ["screen"],
      done: (m) => m.homed,
    },
  ],
};
