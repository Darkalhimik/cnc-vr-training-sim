import type { TutorialStep } from "../tutorial-types";

export const stepAirFlow: TutorialStep = {
  id: "air-flow",
  title: "Air supply",
  shortLabel: "Air",
  guard: {
    holds: (m) => m.airValveOpen,
    violation: "The air valve was closed and the machine tripped. Start again from the air supply.",
  },
  phases: [
    {
      id: "open-valve",
      instruction: "Locate the rear air valve and rotate it to the OPEN position.",
      highlight: ["air_valve"],
      expects: (e) => e.kind === "valve-opened",
      satisfied: (m) => m.airValveOpen,
    },
  ],
};
