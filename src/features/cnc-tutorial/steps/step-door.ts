import type { TutorialStep } from "../tutorial-types";

export const stepDoor: TutorialStep = {
  id: "door",
  title: "Close the door",
  shortLabel: "Door",
  guard: {
    holds: (m) => !m.doorOpen,
    violation: "The door was opened. Close it — the zero return and programs need it shut.",
  },
  phases: [
    {
      id: "door-close",
      instruction: "Slide the front door shut. The axes will not move with it open.",
      highlight: ["door"],
      done: (m) => !m.doorOpen,
    },
  ],
};
