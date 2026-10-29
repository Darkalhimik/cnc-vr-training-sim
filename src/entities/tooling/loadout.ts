/**
 * What a machine has loaded: its tool table, tool number → a tool from the
 * crib. The crib is the shop's; the loadout is the machine's own — which tool
 * is T5 on this machine, and whether it fits this machine's spindle and
 * changer.
 *
 * Tool T sits in pocket T when the magazine is loaded (Haas: "Sequence All
 * Pockets"); the pocket table then drifts as tools are changed.
 */
import type { MachineTooling } from "@/entities/catalog/machines";
import { assemblyById, type AssembledTool } from "./catalog";

export type LoadoutSlot = { number: number; assembly: string };
export type Loadout = LoadoutSlot[];

/** The shop's standard set, T1–T8. Levels always run with it, so a task's
 *  program and its grading mean the same thing for everyone. */
export const STANDARD_LOADOUT: Loadout = [
  { number: 1, assembly: "face-50" },
  { number: 2, assembly: "em-10" },
  { number: 3, assembly: "em-6" },
  { number: 4, assembly: "spot-10" },
  { number: 5, assembly: "drill-5.0" },
  { number: 6, assembly: "drill-6.8" },
  { number: 7, assembly: "drill-8.5" },
  { number: 8, assembly: "ball-6" },
];

/** The tool table's flags (Haas SMTC): a large tool needs both neighbouring
 *  pockets empty, a heavy one slows the changer. */
export function toolFlags(tool: AssembledTool, spec: MachineTooling) {
  const large = tool.cutterSpec.diameter > spec.maxDiameter;
  return { large, heavy: large || tool.mass >= spec.heavyFrom };
}

export type LoadoutIssue = { number: number | null; text: string };

/** Everything that stops a loadout going into this machine. Empty: it fits. */
export function checkLoadout(loadout: Loadout, spec: MachineTooling): LoadoutIssue[] {
  const issues: LoadoutIssue[] = [];
  const seen = new Set<number>();
  const at = new Map(loadout.map((s) => [s.number, s]));
  for (const slot of loadout) {
    const n = slot.number;
    if (!Number.isInteger(n) || n < 1 || n > spec.pockets) {
      issues.push({ number: n, text: `T${n}: the changer has pockets 1 to ${spec.pockets}.` });
      continue;
    }
    if (seen.has(n)) issues.push({ number: n, text: `T${n} is in the table twice.` });
    seen.add(n);
    const tool = assemblyById(slot.assembly);
    if (!tool) {
      issues.push({ number: n, text: `T${n}: the crib has no tool "${slot.assembly}".` });
      continue;
    }
    if (tool.holderSpec.interface !== spec.interface) {
      issues.push({ number: n, text: `T${n} ${tool.name}: a ${tool.holderSpec.interface} holder does not fit a ${spec.interface} spindle.` });
    }
    if (tool.length > spec.maxLength) {
      issues.push({ number: n, text: `T${n} ${tool.name}: ${tool.length} mm from the gauge line, the changer takes ${spec.maxLength}.` });
    }
    if (tool.mass > spec.maxMass) {
      issues.push({ number: n, text: `T${n} ${tool.name}: ${tool.mass} kg, the changer takes ${spec.maxMass}.` });
    }
    const d = tool.cutterSpec.diameter;
    if (d > spec.maxDiameterLarge) {
      issues.push({ number: n, text: `T${n} ${tool.name}: Ø${d} mm, the changer takes Ø${spec.maxDiameterLarge} at most.` });
    } else if (d > spec.maxDiameter) {
      // Pockets wrap round the carousel: 1 and the last are neighbours.
      const before = n === 1 ? spec.pockets : n - 1;
      const after = n === spec.pockets ? 1 : n + 1;
      const taken = [before, after].filter((p) => at.has(p));
      if (taken.length) {
        issues.push({
          number: n,
          text: `T${n} ${tool.name} is large (over Ø${spec.maxDiameter}): empty ${taken.map((p) => `T${p}`).join(" and ")} beside it.`,
        });
      }
    }
  }
  return issues;
}

/** Tool number order, for display and storage. */
export const sortLoadout = (loadout: Loadout) => [...loadout].sort((a, b) => a.number - b.number);
