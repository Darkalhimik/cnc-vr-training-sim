import type { TutorialStep } from "../tutorial-types";

export const stepWarmup: TutorialStep = {
  id: "warmup",
  title: "Spindle warm-up",
  shortLabel: "Warm",
  guard: {
    holds: (m) => m.warmupDone,
    violation: "The warm-up was undone. Run it again from MEMORY mode.",
  },
  phases: [
    {
      id: "memory-mode",
      instruction: "Press MEMORY to leave jog mode.",
      highlight: ["memory"],
      done: (m) => m.mode === "memory",
    },
    {
      id: "cycle-start",
      instruction: "Press CYCLE START to run the spindle warm-up program.",
      highlight: ["cycle_start"],
      done: (m) => m.program !== "idle" || m.warmupDone,
    },
    {
      id: "watch-warmup",
      instruction: "Let it run: the spindle steps up to 8100 rpm. FEED HOLD pauses it, CYCLE START resumes.",
      highlight: ["screen"],
      done: (m) => m.warmupDone,
    },
  ],
};
