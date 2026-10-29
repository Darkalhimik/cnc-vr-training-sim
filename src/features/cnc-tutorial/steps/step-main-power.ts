import type { TutorialStep } from "../tutorial-types";

export const stepMainPower: TutorialStep = {
  id: "main-power",
  title: "Main disconnect",
  shortLabel: "Mains",
  guard: {
    holds: (m) => m.mainSwitchOn,
    violation: "The main disconnect was turned off. Switch it back to I.",
  },
  phases: [
    {
      id: "switch-on",
      instruction: "Turn the main disconnect on the side of the electrical cabinet to I (ON).",
      highlight: ["main_switch"],
      done: (m) => m.mainSwitchOn,
    },
  ],
};
