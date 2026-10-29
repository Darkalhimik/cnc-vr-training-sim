"use client";

import { useMachineStore } from "@/entities/machine/machine-store";
import { useSessionStore } from "./session-store";
import { useJobStore } from "@/features/part-development/job-store";
import { showToast } from "@/shared/ui/toast";
import type { MachinePartId } from "@/entities/machine/machine-parts";

/**
 * Operating a part, from any input — mouse, touch or an XR controller ray.
 * The tutorial is not told here: it follows machine state on its own (see
 * useTutorialSync), because half of what it waits for is the control
 * finishing something rather than a click.
 */
export function useInteraction() {
  return (partId: MachinePartId, sign?: 1 | -1) => {
    // Not part of the machine: the key that opens the full-size pendant.
    if (partId === "full_panel") {
      const session = useSessionStore.getState();
      session.setFullPanelOpen(!session.fullPanelOpen);
      return;
    }
    // In part development the vise takes and gives back the job stock.
    const machine = useMachineStore.getState();
    if (partId === "vise" && useSessionStore.getState().gameMode === "develop") {
      const { stock } = useJobStore.getState().design;
      const outcome = machine.setStock(
        machine.machine.stock ? null : { size: [stock.x, stock.y, stock.z], material: stock.material },
      );
      if (outcome.rejected) showToast(outcome.rejected, "warning");
      return;
    }
    const { rejected, notice } = machine.operate(partId, sign);
    const message = rejected ?? notice;
    if (message) showToast(message, "warning");
  };
}
