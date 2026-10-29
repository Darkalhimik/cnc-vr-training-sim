import type { MachinePartId } from "@/entities/machine/machine-parts";
import type { MachineState } from "@/entities/machine/machine-types";

/**
 * One instruction within a step. A phase is complete when the machine shows
 * its outcome, not when a particular button was pressed: the boot finishing or
 * the zero return arriving home count the same as a click, and a phase whose
 * outcome is already true is skipped on the way in — with the door already
 * shut, "close the door" never appears.
 */
export type StepPhase = {
  id: string;
  instruction: string;
  highlight: MachinePartId[];
  done: (machine: MachineState) => boolean;
};

/**
 * A step's safety condition: what must remain true on the machine once the
 * step is done. Required, not optional — a startup sequence you can dismantle
 * from behind teaches the wrong thing, and every new step has to answer this.
 */
export type StepGuard = {
  /** True while the step's outcome still holds. */
  holds: (machine: MachineState) => boolean;
  /** Shown when it stops holding and the tutorial sends the user back. */
  violation: string;
};

export type TutorialStep = {
  id: string;
  title: string;
  shortLabel: string;
  guard: StepGuard;
  phases: StepPhase[];
};
