import type { TutorialStep } from "../tutorial-types";

export const stepHandleJog: TutorialStep = {
  id: "jog-diagnostics",
  title: "Jog & Diagnostics",
  shortLabel: "Jog",
  phases: [
    {
      id: "activate-jog",
      instruction: "Activate the Handle Jog lever.",
      highlight: ["handle_jog"],
      expects: (e) => e.kind === "jog-on",
    },
    {
      id: "open-diagnostics",
      instruction: "Open the Diagnostics panel to verify all systems.",
      highlight: ["diagnostics_panel"],
      expects: (e) => e.kind === "diagnostics-opened",
    },
  ],
};
