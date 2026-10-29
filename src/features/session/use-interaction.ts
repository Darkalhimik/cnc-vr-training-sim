"use client";

import { useMachineStore } from "@/entities/machine/machine-store";
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
    const { rejected, notice } = useMachineStore.getState().operate(partId, sign);
    const message = rejected ?? notice;
    if (message) showToast(message, "warning");
  };
}
