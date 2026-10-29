import type { TutorialStep } from "../tutorial-types";

export const stepAirSupply: TutorialStep = {
  id: "air-supply",
  title: "Air supply",
  shortLabel: "Air",
  guard: {
    holds: (m) => m.airValveOpen,
    violation: "The air supply was shut off. Reopen the valve on the rear panel.",
  },
  phases: [
    {
      id: "open-valve",
      instruction:
        "Go round to the rear panel and open the air shut-off valve: turn the red lever in line with the pipe. The gauge should rise to about 6 bar.",
      highlight: ["air_valve", "air_gauge"],
      done: (m) => m.airValveOpen,
    },
  ],
};
