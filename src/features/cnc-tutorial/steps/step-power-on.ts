import type { TutorialStep } from "../tutorial-types";

export const stepPowerOn: TutorialStep = {
  id: "step-power-on",
  title: "Power On",
  description: "Press the green POWER ON button on the control panel.",
  highlight: ["power_button"],
  actionLabel: "Press the power button",
  isComplete: (state) => state.powerOn,
};
