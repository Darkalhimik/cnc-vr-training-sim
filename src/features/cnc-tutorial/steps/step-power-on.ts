import type { TutorialStep } from "../tutorial-types";

export const stepPowerOn: TutorialStep = {
  id: "power-on",
  title: "Power On",
  shortLabel: "Power",
  phases: [
    {
      id: "press-power",
      instruction: "Press the green POWER ON button on the control panel.",
      highlight: ["power_button"],
      expects: (e) => e.kind === "power-on",
    },
  ],
};
