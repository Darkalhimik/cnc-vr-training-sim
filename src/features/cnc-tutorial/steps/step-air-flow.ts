import type { TutorialStep } from "../tutorial-types";

export const stepAirFlow: TutorialStep = {
  id: "step-air-flow",
  title: "Air Supply",
  description: "Locate the rear air valve and rotate it to the OPEN position.",
  highlight: ["air_valve"],
  actionLabel: "Open the air valve",
  isComplete: (state) => state.airValveOpen,
};
