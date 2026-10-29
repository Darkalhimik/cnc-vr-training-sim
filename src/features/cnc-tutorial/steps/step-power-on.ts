import type { TutorialStep } from "../tutorial-types";

export const stepPowerOn: TutorialStep = {
  id: "power-on",
  title: "Control power",
  shortLabel: "Power",
  guard: {
    holds: (m) => m.control !== "off",
    violation: "The control was switched off. Power it on again.",
  },
  phases: [
    {
      id: "press-power",
      instruction: "Press the green POWER ON button at the top left of the pendant.",
      highlight: ["power_on"],
      done: (m) => m.control !== "off",
    },
    {
      id: "wait-boot",
      instruction: "Wait while the control boots. It comes up with alarms — that is expected.",
      highlight: ["screen"],
      done: (m) => m.control === "on",
    },
  ],
};
