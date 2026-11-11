"use client";

import { useMachineStore } from "@/entities/machine/machine-store";
import { idealWorkOffset } from "@/entities/part/setup";
import { activeTools } from "@/entities/part/tool-library";
import { useJobStore } from "./job-store";
import { programName, setupSteps, type SetupStep } from "./setup";

/** A button that does a setup step for the trainee. `run` returns why it
 *  could not, or null. */
export type Shortcut = { label: string; run: () => string | null };

const machine = useMachineStore.getState;

/**
 * Shortcuts for making a part: each setup step done for the trainee, the way
 * a setter would hand the machine over. The step's own way — the pendant,
 * the vise, the valve — stays as it was; these are for when the point is the
 * part, not the setting up. Probing writes what the WIPS routines would.
 */
const SHORTCUTS: Record<string, Shortcut> = {
  ready: {
    label: "Start it",
    run: () => {
      machine().makeReady();
      return null;
    },
  },
  stock: {
    label: "Clamp it",
    run: () => {
      const { stock } = useJobStore.getState().design;
      if (!machine().machine.doorOpen) machine().operate("door");
      return machine().setStock({ size: [stock.x, stock.y, stock.z], material: stock.material }).rejected ?? null;
    },
  },
  program: {
    label: "Load it",
    run: () => {
      const { design, program } = useJobStore.getState();
      return machine().loadProgram(programName(design), program).rejected ?? null;
    },
  },
  tools: {
    label: "Measure all",
    run: () => {
      const tools = { ...machine().machine.tools };
      for (const t of activeTools()) tools[t.number] = { ...tools[t.number], length: t.length, lengthWear: 0, diameter: t.diameter };
      machine().setOffsets({ tools });
      return null;
    },
  },
  zero: {
    label: "Probe it",
    run: () => {
      const { stock } = useJobStore.getState().design;
      machine().setOffsets({ workOffsets: { ...machine().machine.workOffsets, G54: idealWorkOffset(stock) } });
      return null;
    },
  },
  run: {
    label: "Run it",
    run: () => {
      if (machine().machine.doorOpen) machine().operate("door");
      const mode = machine().pressKey("MEMORY").rejected;
      if (mode) return mode;
      return machine().operate("cycle_start").rejected ?? null;
    },
  },
};

export const shortcutFor = (step: SetupStep): Shortcut | null => SHORTCUTS[step.id] ?? null;

/**
 * Every setup step not done yet, done in order — started, clamped, loaded,
 * measured and probed — short of running, which stays the trainee's press.
 */
export function setUpAll(): string | null {
  for (let i = 0; i < 5; i++) {
    const { design, program } = useJobStore.getState();
    const next = setupSteps(machine().machine, design, program).find((s) => !s.done);
    if (!next || next.id === "run") return null;
    const refused = SHORTCUTS[next.id]?.run() ?? null;
    if (refused) return refused;
  }
  return null;
}
