import type { MachinePartId } from "@/entities/machine/machine-parts";
import type { InteractionEvent } from "@/entities/machine/interaction-events";
import type { MachineState } from "@/entities/machine/machine-types";

export type StepPhase = {
  id: string;
  instruction: string;
  highlight: MachinePartId[];
  expects: (event: InteractionEvent) => boolean;
  /**
   * Whether the machine already shows this phase's outcome. Used only when
   * (re-)entering a step, to skip past what is already true — after being sent
   * back for leaving the door open, the step should say "close the door", not
   * ask you to open the one that is open.
   */
  satisfied?: (machine: MachineState) => boolean;
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
