import type { MachineState } from "@/entities/machine/machine-types";
import type { TutorialStep } from "./tutorial-types";

export type TutorialCursor = {
  stepIndex: number;
  phaseIndex: number;
  status: "active" | "complete";
  /** Furthest step reached. Below it, a step whose guard still holds was
   *  already done once and is not asked for again. */
  reached: number;
};

export type TutorialUpdate = {
  cursor: TutorialCursor;
  /** Set when a completed step was undone and the cursor moved back to it. */
  violation: string | null;
};

/**
 * The first phase whose outcome the machine does not already show. Sending the
 * user back to a step should not ask for something that is already true — with
 * the door left open, the door step resumes at "close the door".
 */
function entryPhaseIndex(step: TutorialStep, machine: MachineState) {
  const index = step.phases.findIndex((phase) => !phase.done(machine));
  return index === -1 ? step.phases.length - 1 : index;
}

/** Bring the tutorial in line with the machine. Pure: same input, same answer. */
export function advanceTutorial(
  steps: readonly TutorialStep[],
  cursor: TutorialCursor,
  machine: MachineState,
): TutorialUpdate {
  // 1. Advance through every phase the machine already satisfies. One change
  //    can complete several — the boot finishing can leave a step whose next
  //    phase is already true.
  //    Coming back up after being sent back, a step that was already done
  //    and still holds is passed over too — losing air should cost the
  //    trainee the air step and RESET, not the whole sequence after them.
  let { stepIndex, phaseIndex, status, reached } = cursor;
  while (status === "active") {
    const step = steps[stepIndex];
    const redone = phaseIndex === 0 && stepIndex < reached && step.guard.holds(machine);
    if (!redone && !step.phases[phaseIndex].done(machine)) break;
    if (!redone && phaseIndex + 1 < step.phases.length) {
      phaseIndex += 1;
    } else {
      stepIndex += 1;
      phaseIndex = 0;
      reached = Math.max(reached, stepIndex);
      if (stepIndex >= steps.length) status = "complete";
    }
  }

  // 2. Re-check every step already completed, in the completed state too —
  //    that gap is what let a finished sequence be taken apart with no
  //    consequence. Undoing one sends the user back to it, earliest first,
  //    because a later step's prerequisites are the earlier ones.
  for (let i = 0; i < Math.min(stepIndex, steps.length); i++) {
    const step = steps[i];
    if (step.guard.holds(machine)) continue;
    return {
      cursor: { stepIndex: i, phaseIndex: entryPhaseIndex(step, machine), status: "active", reached },
      violation: step.guard.violation,
    };
  }

  return { cursor: { stepIndex, phaseIndex, status, reached }, violation: null };
}
