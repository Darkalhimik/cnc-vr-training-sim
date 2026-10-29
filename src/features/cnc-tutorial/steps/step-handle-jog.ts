import type { TutorialStep } from "../tutorial-types";

/** How far X has to travel before the jog counts. */
const JOG_DISTANCE_MM = 50;

export const stepHandleJog: TutorialStep = {
  id: "handle-jog",
  title: "Handle jog",
  shortLabel: "Jog",
  guard: {
    holds: (m) => m.homed,
    violation: "The machine lost its zero return. Home it with POWER UP before jogging.",
  },
  phases: [
    {
      id: "jog-mode",
      instruction: "Press HANDLE JOG on the keypad.",
      highlight: ["hand_jog"],
      done: (m) => m.mode === "jog",
    },
    {
      id: "jog-axis",
      instruction: "Select the X axis.",
      highlight: ["axis_x"],
      done: (m) => m.mode === "jog" && m.jogAxis === "x",
    },
    {
      id: "jog-move",
      instruction: `X is home at its plus end, so jog it minus: click the left half of the handwheel until X reads −${JOG_DISTANCE_MM} mm or less.`,
      highlight: ["handwheel"],
      done: (m) => m.position.x <= -JOG_DISTANCE_MM,
    },
  ],
};
