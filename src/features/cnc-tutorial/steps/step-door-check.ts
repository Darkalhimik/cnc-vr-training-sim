import type { TutorialStep } from "../tutorial-types";

export const stepDoorCheck: TutorialStep = {
  id: "door-check",
  title: "Door safety check",
  shortLabel: "Door",
  phases: [
    {
      id: "door-open",
      instruction: "Open the safety door.",
      highlight: ["door"],
      expects: (e) => e.kind === "door-opened",
    },
    {
      id: "door-close",
      instruction: "Close the door to verify the safety interlock.",
      highlight: ["door"],
      expects: (e) => e.kind === "door-closed",
    },
  ],
};
