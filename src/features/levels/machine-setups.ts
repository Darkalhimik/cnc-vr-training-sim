/**
 * Where levels start: the machine and the job as a shift would hand them
 * over. Each level builds its start from these, so "a blank clamped and
 * probed" means the same thing in a tutorial, a task and free play.
 */
import { useMachineStore } from "@/entities/machine/machine-store";
import { loadedPockets } from "@/entities/machine/tool-changer";
import { defaultCodes, readyMachineState, type MachineState, type ToolOffset } from "@/entities/machine/machine-types";
import type { PartDesign, Stock } from "@/entities/part/part-design";
import { idealWorkOffset } from "@/entities/part/setup";
import { activeTools } from "@/entities/part/tool-library";
import { useJobStore } from "@/features/part-development/job-store";

/** The blank the tutorials hand out: small, aluminium, quick to cut. */
export const PRACTICE_STOCK: Stock = { x: 80, y: 60, z: 30, material: "aluminium" };

export const blankDesign = (programNumber: number, name = "Practice blank", stock = PRACTICE_STOCK): PartDesign => ({
  name,
  programNumber,
  stock,
  features: [],
});

/** The tool table for the tools loaded now: gauge-line lengths from the tool
 *  setter when probed, unmeasured otherwise. */
function toolTable(probed: boolean): Record<number, ToolOffset> {
  return Object.fromEntries(
    activeTools().map((t) => [t.number, { length: probed ? t.length : 0, lengthWear: 0, diameter: t.diameter, diameterWear: 0 }]),
  );
}

export type ReadyOptions = {
  /** Clamped in the vise. */
  stock?: Stock | null;
  /** G54 at the top-face centre and every tool measured, as the probes leave it. */
  probed?: boolean;
  doorOpen?: boolean;
  /** Extra programs in control memory; `active` selects one. */
  programs?: Record<string, string>;
  active?: string;
  patch?: Partial<MachineState>;
};

/** A started, homed machine, set up as asked, with the tools loaded now
 *  (setActiveTools) in the changer: T in pocket T. */
export function readyMachine(o: ReadyOptions = {}): MachineState {
  const base = readyMachineState;
  const numbers = activeTools().map((t) => t.number);
  const spindle = numbers.includes(base.toolInSpindle) ? base.toolInSpindle : (numbers[0] ?? 0);
  return {
    ...base,
    doorOpen: o.doorOpen ?? false,
    stock: o.stock ? { size: [o.stock.x, o.stock.y, o.stock.z], material: o.stock.material } : null,
    workOffsets:
      o.probed && o.stock ? { ...base.workOffsets, G54: idealWorkOffset(o.stock) } : base.workOffsets,
    tools: toolTable(o.probed ?? false),
    toolInSpindle: spindle,
    pockets: loadedPockets(numbers, spindle),
    // The spindle tool's pocket is the empty one, at the arm.
    carouselPocket: spindle || 1,
    activeCodes: spindle === base.toolInSpindle ? base.activeCodes : defaultCodes(spindle),
    programs: { ...base.programs, ...o.programs },
    activeProgram: o.active ?? base.activeProgram,
    ...o.patch,
  };
}

/** Load a level's start into the stores. */
export function startAt(machine: MachineState, design: PartDesign, program?: string) {
  useJobStore.getState().loadJob(design, program);
  useMachineStore.getState().load(machine);
}
