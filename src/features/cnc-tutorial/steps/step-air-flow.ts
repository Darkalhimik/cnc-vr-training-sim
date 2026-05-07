import type { TutorialStep } from "../tutorial-types";

export const stepAirFlow: TutorialStep = {
  id: "air-flow",
  title: "Air Supply",
  shortLabel: "Air",
  phases: [
    {
      id: "open-valve",
      instruction: "Locate the rear air valve and rotate it to the OPEN position.",
      highlight: ["air_valve"],
      expects: (e) => e.kind === "valve-opened",
    },
  ],
};
