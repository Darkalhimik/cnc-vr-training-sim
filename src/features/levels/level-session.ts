"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { levelById, type LevelInfo } from "@/entities/catalog/levels";
import { MACHINES } from "@/entities/catalog/machines";
import { useMachineStore } from "@/entities/machine/machine-store";
import type { GameMode } from "@/entities/machine/machine-types";
import type { PartDesign } from "@/entities/part/part-design";
import { SAMPLE_DESIGN } from "@/entities/part/part-design";
import { TOOL_LIBRARY, setActiveTools } from "@/entities/part/tool-library";
import { useJobStore } from "@/features/part-development/job-store";
import { useStockRegistry } from "@/features/part-development/stock-registry";
import { freePlayTools } from "@/features/tooling/tooling-store";
import { useTutorialStore } from "@/features/tutorial/tutorial-store";
import { showToast } from "@/shared/lib/notifications";
import { measure, referenceField, type Measurement } from "./grading";
import { readyMachine, startAt } from "./machine-setups";
import { recordAttempt } from "./progress";
import { TASKS, prepareTask, programNameOf } from "./tasks";
import { TUTORIALS } from "./tutorials";

export type LevelResult = {
  seconds: number;
  stars: number | null;
  score?: number;
  measurement?: Measurement;
  crashed?: boolean;
};

type Phase = "playing" | "measuring" | "complete";

type LevelSession = {
  mode: GameMode | null;
  level: LevelInfo | null;
  phase: Phase;
  startedAt: number;
  result: LevelResult | null;
  /** Free play's own job, kept while a level borrows the job store. */
  freeplayJob: { design: PartDesign; program: string; edited: boolean } | null;
  error: string | null;

  enter: (mode: GameMode, levelId: string | null) => void;
  /** Start the current level again from its first state. */
  restart: () => void;
  /** A tutorial reached its last step. */
  completeTutorial: () => Promise<void>;
  /** Measure the task's part and report it. */
  inspectTask: () => Promise<void>;
};

const elapsed = (since: number) => Math.round((Date.now() - since) / 1000);

export const useLevelSession = create<LevelSession>((set, get) => ({
  mode: null,
  level: null,
  phase: "playing",
  startedAt: Date.now(),
  result: null,
  freeplayJob: null,
  error: null,

  enter: (mode, levelId) => {
    const previous = get();
    const level = mode === "freeplay" ? null : levelById(levelId ?? "");
    // Free play's job is put aside when a level takes the job store over, and
    // given back when the trainee returns to free play.
    if (previous.mode === "freeplay" && mode !== "freeplay") {
      const job = useJobStore.getState();
      set({ freeplayJob: { design: job.design, program: job.program, edited: job.programEdited } });
    }
    set({ mode, level, phase: "playing", startedAt: Date.now(), result: null, error: null });
    // Levels run with the shop's standard set, so a task's program and its
    // grading mean the same for everyone; free play with the machine's own.
    setActiveTools(mode === "freeplay" ? freePlayTools(MACHINES[0].id) : TOOL_LIBRARY);

    if (mode === "freeplay") {
      const job = get().freeplayJob;
      startAt(readyMachine(), job?.design ?? SAMPLE_DESIGN, job?.edited ? job.program : undefined);
      return;
    }
    if (!level) {
      set({ error: "That level does not exist." });
      return;
    }
    if (level.kind === "tutorial") {
      const tutorial = TUTORIALS[level.id];
      if (!tutorial) return set({ error: "This tutorial is not available yet." });
      useTutorialStore.getState().start(tutorial.steps, tutorial.prepare);
    } else {
      const task = TASKS[level.id];
      if (!task) return set({ error: "This task is not available yet." });
      prepareTask(task);
    }
  },

  restart: () => {
    const { mode, level } = get();
    if (!mode) return;
    // A task starts again on a fresh blank, but with the trainee's program.
    const program = useJobStore.getState().program;
    get().enter(mode, level?.id ?? null);
    const task = level && TASKS[level.id];
    if (task) prepareTask(task, program);
  },

  completeTutorial: async () => {
    const { level, startedAt, phase } = get();
    if (!level || phase !== "playing") return;
    const seconds = elapsed(startedAt);
    set({ phase: "complete", result: { seconds, stars: null } });
    const reply = await recordAttempt(level.machineId, { levelId: level.id, completed: true, seconds });
    if ("error" in reply) return set({ error: reply.error });
    set((s) => ({ result: s.result && { ...s.result, stars: reply.stars } }));
  },

  inspectTask: async () => {
    const { level, startedAt } = get();
    const task = level && TASKS[level.id];
    const removal = useStockRegistry.getState().removal;
    if (!level || !task || !removal) return;
    set({ phase: "measuring", error: null });
    try {
      const actual = await removal.exportField();
      const reference = await referenceField(task.design, removal.voxel);
      const { x, y, z } = task.design.stock;
      const m = measure(actual, reference, task.tolerance, x * y * z);
      const crashed = useMachineStore.getState().machine.alarms.some((a) => a.code === "crash");
      const score = crashed ? Math.min(m.score, 50) : m.score;
      const seconds = elapsed(startedAt);
      set({ phase: "complete", result: { seconds, stars: null, score, measurement: m, crashed } });
      const reply = await recordAttempt(level.machineId, { levelId: level.id, completed: true, seconds, score });
      if ("error" in reply) return set({ error: reply.error });
      set((s) => ({ result: s.result && { ...s.result, stars: reply.stars } }));
    } catch (error) {
      set({ phase: "playing", error: error instanceof Error ? error.message : String(error) });
    }
  },
}));

/** Has the task's program run to its end on this blank? */
export function taskProgramDone(): boolean {
  const { level } = useLevelSession.getState();
  const task = level && TASKS[level.id];
  if (!task) return false;
  return useMachineStore.getState().machine.lastProgramDone === programNameOf(task.design);
}

/**
 * Puts the simulator in the mode and level it was opened with, and reports a
 * tutorial's completion when the tutorial engine reaches the end — whichever
 * tutorial is running by then: in the workshop a level can be started from
 * the terminal without the page changing.
 */
export function useLevelRuntime(mode: GameMode, levelId: string | null) {
  useEffect(() => {
    useLevelSession.getState().enter(mode, levelId);
  }, [mode, levelId]);

  useEffect(
    () =>
      useTutorialStore.subscribe((s, prev) => {
        if (useLevelSession.getState().mode !== "tutorial") return;
        if (s.status === "complete" && prev.status !== "complete") {
          void useLevelSession.getState().completeTutorial();
          showToast("Tutorial complete.", "success");
        }
      }),
    [],
  );
}

/** The mode in force now: the route's at first, then whatever was started. */
export const useGameMode = (): GameMode => useLevelSession((s) => s.mode ?? "freeplay");
