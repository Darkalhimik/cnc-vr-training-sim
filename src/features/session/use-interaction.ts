"use client";

import { useMachineStore } from "@/entities/machine/machine-store";
import { useSessionStore } from "./session-store";
import { useJobStore } from "@/features/part-development/job-store";
import { showToast } from "@/shared/ui/toast";
import type { MachinePartId } from "@/entities/machine/machine-parts";
import { partInHand } from "@/features/xr/grab";
import { pulse } from "@/features/xr/haptics";

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
    // The vise takes and gives back the job's blank — free play's design, or
    // the level's.
    const machine = useMachineStore.getState();
    if (partId === "vise") {
      const { stock } = useJobStore.getState().design;
      const outcome = machine.setStock(
        machine.machine.stock ? null : { size: [stock.x, stock.y, stock.z], material: stock.material },
      );
      if (outcome.rejected) showToast(outcome.rejected, "warning");
      return;
    }
    if (partId === "cycle_start" && partInHand.current) {
      pulse("tap");
      showToast("The part is in your hand: put it back in the vise or on a shelf first.", "warning");
      return;
    }
    const { rejected, notice } = machine.operate(partId, sign);
    // The controller that pressed feels it; the handwheel clicks through its detents.
    pulse(partId === "handwheel" && !rejected ? "detent" : "tap");
    const message = rejected ?? notice;
    if (message) showToast(message, "warning");
  };
}
