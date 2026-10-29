"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { useMachineStore } from "@/entities/machine/machine-store";
import { cncTutorialSteps } from "@/features/cnc-tutorial/steps";
import type { MachinePartId } from "@/entities/machine/machine-parts";
import type { MachineState } from "@/entities/machine/machine-types";
import { advanceTutorial, type TutorialCursor } from "@/features/cnc-tutorial/tutorial-engine";
import type { StepPhase, TutorialStep } from "@/features/cnc-tutorial/tutorial-types";
import { useJobStore } from "@/features/part-development/job-store";
import { useSessionStore } from "@/features/session/session-store";
import { showToast } from "@/shared/lib/notifications";

type TutorialStore = {
  /** The running tutorial's steps; the startup until a level sets others. */
  steps: readonly TutorialStep[];
  stepIndex: number;
  phaseIndex: number;
  status: TutorialCursor["status"];
  reached: number;
  celebrationDismissed: boolean;
  startedAt: number;
  /** Completed steps undone along the way — a tutorial with none is clean. */
  violations: number;
  /** Puts the machine (and the job) where the tutorial starts. */
  prepare: () => void;

  /**
   * Bring the tutorial in line with the machine. Returns the violation message
   * when a completed step was undone.
   */
  sync: (machine: MachineState) => string | null;
  /** Begin a tutorial from its first step. */
  start: (steps: readonly TutorialStep[], prepare: () => void) => void;
  reset: () => void;
  dismissCelebration: () => void;
};

const fresh = () => ({
  stepIndex: 0,
  phaseIndex: 0,
  status: "active" as const,
  reached: 0,
  celebrationDismissed: false,
  startedAt: Date.now(),
  violations: 0,
});

export const useTutorialStore = create<TutorialStore>((set, get) => ({
  steps: cncTutorialSteps,
  ...fresh(),
  prepare: () => useMachineStore.getState().reset(),

  sync: (machine) => {
    const { steps, stepIndex, phaseIndex, status, reached, violations } = get();
    const { cursor, violation } = advanceTutorial(steps, { stepIndex, phaseIndex, status, reached }, machine);
    if (
      cursor.stepIndex !== stepIndex ||
      cursor.phaseIndex !== phaseIndex ||
      cursor.status !== status ||
      cursor.reached !== reached
    ) {
      set({ ...cursor, ...(violation ? { celebrationDismissed: false, violations: violations + 1 } : {}) });
    }
    return violation;
  },

  start: (steps, prepare) => {
    // Tutorial first: preparing the machine triggers a sync, and run against
    // the old steps it would report every completed step as undone.
    set({ steps, prepare, ...fresh() });
    prepare();
  },

  reset: () => {
    set(fresh());
    get().prepare();
  },

  dismissCelebration: () => set({ celebrationDismissed: true }),
}));

/**
 * Keeps the tutorial following the machine while mounted. The tutorial reads
 * machine state, not clicks, so it has to hear timer-driven changes — the boot
 * finishing, the zero return arriving — as well as the trainee's own actions.
 * The job is watched too: a programming tutorial advances as the program is
 * written.
 */
export function useTutorialSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const sync = (machine: MachineState) => {
      const violation = useTutorialStore.getState().sync(machine);
      if (violation) showToast(violation, "warning");
    };
    sync(useMachineStore.getState().machine);
    const offMachine = useMachineStore.subscribe((state, prev) => {
      if (state.machine !== prev.machine) sync(state.machine);
    });
    const offJob = useJobStore.subscribe((state, prev) => {
      if (state.program !== prev.program) sync(useMachineStore.getState().machine);
    });
    return () => {
      offMachine();
      offJob();
    };
  }, [enabled]);
}

// Derived selectors. Each must return a referentially stable value when the
// store hasn't changed, or useSyncExternalStore loops: the step arrays are
// stable, and misses go through frozen empties.

const EMPTY_HIGHLIGHTS: MachinePartId[] = [];
const EMPTY_KEYS: string[] = [];

export const useTutorialSteps = () => useTutorialStore((s) => s.steps);

export const useCurrentStep = () => useTutorialStore((s) => s.steps[s.stepIndex] ?? null);

export const useCurrentPhase = (): StepPhase | null =>
  useTutorialStore((s) => s.steps[s.stepIndex]?.phases[s.phaseIndex] ?? null);

/** A phase's highlights plus the FULL PANEL key, made once per phase. */
const withPanelKey = new WeakMap<StepPhase, MachinePartId[]>();

/** Machine parts to light. A phase that wants full-panel keys lights the
 *  pendant's FULL PANEL key too, until the panel is open. */
export const useTutorialHighlights = (): MachinePartId[] => {
  const panelOpen = useSessionStore((s) => s.fullPanelOpen);
  return useTutorialStore((s) => {
    if (s.status === "complete") return EMPTY_HIGHLIGHTS;
    const phase = s.steps[s.stepIndex]?.phases[s.phaseIndex];
    if (!phase) return EMPTY_HIGHLIGHTS;
    if (!phase.keys?.length || panelOpen) return phase.highlight;
    let lit = withPanelKey.get(phase);
    if (!lit) {
      lit = [...phase.highlight, "full_panel"];
      withPanelKey.set(phase, lit);
    }
    return lit;
  });
};

/** Full-panel keys the current phase asks for. */
export const useTutorialKeys = (): string[] =>
  useTutorialStore((s) => {
    if (s.status === "complete") return EMPTY_KEYS;
    return s.steps[s.stepIndex]?.phases[s.phaseIndex]?.keys ?? EMPTY_KEYS;
  });
