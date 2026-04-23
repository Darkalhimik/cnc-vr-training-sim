import type { TutorialStep } from "../tutorial-types";

export const stepHandleJog: TutorialStep = {
  id: "step-handle-jog",
  title: "Jog & Diagnostics",
  description: "Activate the Handle Jog, then open the Diagnostics panel.",
  highlight: ["handle_jog", "diagnostics_panel"],
  actionLabel: "Jog → Diagnostics",
  isComplete: (state) => state.handleJogPressed && state.diagnosticsOpen,
  subSteps: [
    {
      id: "activate-jog",
      instruction: "Activate the Handle Jog lever.",
      highlight: ["handle_jog"],
      isComplete: (state) => state.handleJogPressed,
    },
    {
      id: "open-diagnostics",
      instruction: "Open the Diagnostics panel to verify all systems.",
      highlight: ["diagnostics_panel"],
      isComplete: (state) => state.diagnosticsOpen,
    },
  ],
};
