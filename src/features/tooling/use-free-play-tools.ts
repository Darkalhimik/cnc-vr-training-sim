"use client";

import { useEffect } from "react";
import type { MachineId } from "@/entities/catalog/machines";
import { useMachineStore } from "@/entities/machine/machine-store";
import { freePlayTools, loadIntoMachine, useToolingStore } from "./tooling-store";

/**
 * In free play the machine carries the trainee's own loadout: put in when
 * their loadouts arrive and whenever one is saved, or — if a program was
 * running — as soon as it stops. Levels load the standard set themselves.
 */
export function useFreePlayTools(machineId: MachineId, enabled: boolean) {
  const loadout = useToolingStore((s) => s.loadouts[machineId]);
  const idle = useMachineStore((s) => s.machine.program === "idle");
  useEffect(() => {
    if (enabled && idle) loadIntoMachine(freePlayTools(machineId));
  }, [enabled, idle, loadout, machineId]);
}
