import type { TutorialStep } from "../tutorial-types";

export const stepPowerOn: TutorialStep = {
  id: "power-on",
  title: "Power on",
  shortLabel: "Power",
  guard: {
    holds: (m) => m.powerOn,
    violation: "Power was switched off. Start again from the power-on step.",
  },
  phases: [
    {
      id: "press-power",
      instruction: "Press the green POWER ON button on the control panel.",
      highlight: ["power_button"],
      expects: (e) => e.kind === "power-on",
      satisfied: (m) => m.powerOn,
    },
  ],
};
