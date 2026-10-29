"use client";

import { useMachineStore } from "@/entities/machine/machine-store";
import type { MachineState } from "@/entities/machine/machine-types";
import { idealWorkOffset } from "@/entities/part/setup";
import { activeTools } from "@/entities/part/tool-library";
import type { PartDesign } from "@/entities/part/part-design";
import { useJobStore } from "./job-store";

/** The O-number the job's program is stored under. */
export const programName = (d: PartDesign) => `O${String(d.programNumber).padStart(5, "0")}`;

/** T numbers the program calls, from its M06 blocks. */
export function toolsCalled(program: string): number[] {
  const found = new Set<number>();
  for (const m of program.matchAll(/T(\d+)\s*M0?6/gi)) found.add(Number(m[1]));
  return [...found].sort((a, b) => a - b);
}

export type SetupStep = {
  id: string;
  title: string;
  detail: string;
  done: boolean;
  /** A shortcut that does the step for the trainee, where one makes sense. */
  action?: { label: string; run: () => string | null };
};

/**
 * The job's setup, read off the machine. 5-axis programs that use G254 need
 * gauge-line tool lengths and a work offset measured from the real part zero
 * (operation.md §7, gcode.md G254), which is what the probe shortcuts write;
 * the manual PART ZERO SET / TOOL OFFSET MEASURE keys stay available on the
 * pendant for 3-axis practice.
 */
export function setupSteps(m: MachineState, design: PartDesign, program: string): SetupStep[] {
  const name = programName(design);
  const { stock } = design;
  const clamped =
    !!m.stock && m.stock.size[0] === stock.x && m.stock.size[1] === stock.y && m.stock.size[2] === stock.z;
  const tools = toolsCalled(program);
  const measured = tools.every((t) => (m.tools[t]?.length ?? 0) > 0);
  const ideal = idealWorkOffset(stock);
  const g54 = m.workOffsets.G54;
  const zeroSet = Math.abs(g54.x - ideal.x) < 0.5 && Math.abs(g54.y - ideal.y) < 0.5 && Math.abs(g54.z - ideal.z) < 0.5;
  const loaded = m.programs[name] === program && m.activeProgram === name;
  const store = useMachineStore.getState;

  return [
    {
      id: "ready",
      title: "Machine started and homed",
      detail: "Power, E-stop released, alarms cleared, zero return done.",
      done: m.control === "on" && m.homed && m.alarms.length === 0,
      action: {
        label: "Start it",
        run: () => {
          store().makeReady();
          return null;
        },
      },
    },
    {
      id: "stock",
      title: `Blank ${stock.x} × ${stock.y} × ${stock.z} clamped`,
      detail: "Open the door and click the vise. The jaws grip the bottom 8 mm.",
      done: clamped,
      action: {
        label: "Clamp it",
        run: () => {
          if (!store().machine.doorOpen) store().operate("door");
          return (
            store().setStock({ size: [stock.x, stock.y, stock.z], material: stock.material }).rejected ?? null
          );
        },
      },
    },
    {
      id: "program",
      title: `${name} in control memory and active`,
      detail: "What LIST PROGRAM → SELECT PROGRAM would do after loading it from USB.",
      done: loaded,
      action: { label: "Send", run: () => store().loadProgram(name, useJobStore.getState().program).rejected ?? null },
    },
    {
      id: "tools",
      title: `Tool lengths measured (${tools.map((t) => `T${t}`).join(" ") || "no tools"})`,
      detail: "Gauge-line lengths, as the WIPS tool setter measures them.",
      done: measured,
      action: {
        label: "Tool setter",
        run: () => {
          const next = { ...store().machine.tools };
          for (const t of activeTools()) next[t.number] = { ...next[t.number], length: t.length, lengthWear: 0, diameter: t.diameter };
          store().setOffsets({ tools: next });
          return null;
        },
      },
    },
    {
      id: "zero",
      title: "G54 at the top-face centre",
      detail: `Expected about X${ideal.x.toFixed(1)} Y${ideal.y.toFixed(1)} Z${ideal.z.toFixed(1)}.`,
      done: zeroSet,
      action: {
        label: "Probe part",
        run: () => {
          store().setOffsets({ workOffsets: { ...store().machine.workOffsets, G54: ideal } });
          return null;
        },
      },
    },
    {
      id: "run",
      title: "Door shut, MEMORY, CYCLE START",
      detail: "Watch it cut. FEED HOLD pauses; SINGLE BLOCK steps through.",
      done: m.lastProgramDone === name,
    },
  ];
}
