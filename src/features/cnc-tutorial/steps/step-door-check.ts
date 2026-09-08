import type { TutorialStep } from "../tutorial-types";

export const stepDoorCheck: TutorialStep = {
  id: "door-check",
  title: "Door safety check",
  shortLabel: "Door",
  guard: {
    holds: (m) => !m.doorOpen,
    violation: "The safety door was opened. Close it to restore the interlock.",
  },
  phases: [
    {
      id: "door-open",
      instruction: "Open the safety door.",
      highlight: ["door"],
      expects: (e) => e.kind === "door-opened",
      satisfied: (m) => m.doorOpen,
    },
    {
      id: "door-close",
      instruction: "Close the door to verify the safety interlock.",
      highlight: ["door"],
      expects: (e) => e.kind === "door-closed",
      satisfied: (m) => !m.doorOpen,
    },
  ],
};
