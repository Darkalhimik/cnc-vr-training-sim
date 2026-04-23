import type { MachinePartId } from "@/entities/machine/machine-parts";
import type { MachineState } from "@/entities/machine/machine-types";

export type { MachineState } from "@/entities/machine/machine-types";

export type SimulationMode = "desktop" | "vr" | "ar";

export type TutorialSubStep = {
  id: string;
  instruction: string;
  highlight: MachinePartId[];
  isComplete: (state: MachineState) => boolean;
};

export type TutorialStep = {
  id: string;
  title: string;
  description: string;
  highlight: MachinePartId[];
  actionLabel: string;
  isComplete: (state: MachineState) => boolean;
  subSteps?: TutorialSubStep[];
};
