import type { TutorialStep } from "../tutorial-types";

export const stepHandleJog: TutorialStep = {
  id: "jog-diagnostics",
  title: "Jog and diagnostics",
  shortLabel: "Jog",
  guard: {
    holds: (m) => m.handleJogActive && m.diagnosticsOpen,
    violation: "Handle Jog or Diagnostics was switched off. Set both again to finish.",
  },
  phases: [
    {
      id: "activate-jog",
      instruction: "Activate the Handle Jog lever.",
      highlight: ["handle_jog"],
      expects: (e) => e.kind === "jog-on",
      satisfied: (m) => m.handleJogActive,
    },
    {
      id: "open-diagnostics",
      instruction: "Open the Diagnostics panel to verify all systems.",
      highlight: ["diagnostics_panel"],
      expects: (e) => e.kind === "diagnostics-opened",
      satisfied: (m) => m.diagnosticsOpen,
    },
  ],
};
