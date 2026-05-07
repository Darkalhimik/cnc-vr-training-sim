import type { MachinePartId } from "@/entities/machine/machine-parts";
import type { InteractionEvent } from "@/entities/machine/interaction-events";

export type StepPhase = {
  id: string;
  instruction: string;
  highlight: MachinePartId[];
  expects: (event: InteractionEvent) => boolean;
};

export type TutorialStep = {
  id: string;
  title: string;
  shortLabel: string;
  phases: StepPhase[];
};
