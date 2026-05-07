"use client";

import { useMachineStore } from "@/entities/machine/machine-store";
import { useTutorialStore } from "@/features/tutorial/tutorial-store";
import { showToast } from "@/shared/ui/toast";
import { useSessionStore } from "./session-store";
import type { MachinePartId } from "@/entities/machine/machine-parts";

export function useInteraction() {
  const gameMode = useSessionStore((s) => s.gameMode);

  return (partId: MachinePartId) => {
    const event = useMachineStore.getState().interactWithPart(partId);

    if (event.kind === "rejected") {
      showToast(event.reason, "warning");
      return;
    }

    if (gameMode === "tutorial" && event.kind !== "noop") {
      useTutorialStore.getState().consumeEvent(event);
    }
  };
}
