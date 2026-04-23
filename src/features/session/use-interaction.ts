"use client";

import { useMachineStore } from "@/entities/machine/machine-store";
import { useSessionStore } from "./session-store";
import { useTutorialStore } from "@/features/tutorial/tutorial-store";
import type { MachinePartId } from "@/entities/machine/machine-parts";

export function useInteraction() {
  const gameMode = useSessionStore((s) => s.gameMode);
  const machineInteract = useMachineStore((s) => s.interactWithPart);
  const checkStep = useTutorialStore((s) => s.checkStepCompletion);

  return (partId: MachinePartId) => {
    machineInteract(partId);

    if (gameMode === "tutorial") {
      checkStep();
    }
  };
}
