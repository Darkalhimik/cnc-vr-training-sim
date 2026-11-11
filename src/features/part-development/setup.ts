import type { MachineState } from "@/entities/machine/machine-types";
import { idealWorkOffset } from "@/entities/part/setup";
import type { PartDesign } from "@/entities/part/part-design";

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
  /** How to do it — on the machine: its pendant, the full panel, the vise,
   *  the door, the valve and switch at the back. Nothing here does it for
   *  the trainee. */
  detail: string;
  done: boolean;
};

/**
 * The job's setup, read off the machine. Every step is done at the machine:
 * the program comes on the USB stick and is loaded from LIST PROGRAM, and
 * the 5-axis program's G254 needs gauge-line tool lengths and a work offset
 * at the real part zero (operation.md §7, gcode.md G254), which the WIPS
 * routines measure — TOOL OFFSET MEASURE in MDI, F3 on OFFSET → WORK. The
 * manual touch-off and PART ZERO SET stay for 3-axis practice.
 */
export function setupSteps(m: MachineState, design: PartDesign, program: string): SetupStep[] {
  const name = programName(design);
  const { stock } = design;
  const clamped =
    !!m.stock && m.stock.size[0] === stock.x && m.stock.size[1] === stock.y && m.stock.size[2] === stock.z;
  const tools = toolsCalled(program);
  const unmeasured = tools.filter((t) => (m.tools[t]?.length ?? 0) <= 0);
  const ideal = idealWorkOffset(stock);
  const g54 = m.workOffsets.G54;
  const zeroSet = Math.abs(g54.x - ideal.x) < 0.5 && Math.abs(g54.y - ideal.y) < 0.5 && Math.abs(g54.z - ideal.z) < 0.5;
  const loaded = m.programs[name] === program && m.activeProgram === name;
  const wrongBlank = m.stock && !clamped ? ` A ${m.stock.size.join(" × ")} blank is in the vise: click the vise to take it out first.` : "";

  return [
    {
      id: "ready",
      title: "Machine started and homed",
      detail:
        "Air valve at the back, main switch on the side, POWER ON, release E-STOP, RESET, then POWER UP for the zero return.",
      done: m.control === "on" && m.homed && m.alarms.length === 0,
    },
    {
      id: "stock",
      title: `Blank ${stock.x} × ${stock.y} × ${stock.z} clamped`,
      detail: `Open the door and click the vise: it takes this blank and grips its bottom 8 mm.${wrongBlank}`,
      done: clamped,
    },
    {
      id: "program",
      title: `${name} in control memory and active`,
      detail: `The workspace writes it to the USB stick in the pendant. Full panel: LIST PROGRAM, RIGHT to the USB tab, highlight ${name}, SELECT PROGRAM.`,
      done: loaded,
    },
    {
      id: "tools",
      title: `Tool lengths measured (${tools.map((t) => `T${t}`).join(" ") || "no tools"})`,
      detail: `Door shut. For each tool${unmeasured.length ? ` (${unmeasured.map((t) => `T${t}`).join(" ")} left)` : ""}: MDI, type T and its number, ATC FWD to put it in the spindle, then TOOL OFFSET MEASURE and CYCLE START — the WIPS tool setter writes its gauge-line length.`,
      done: unmeasured.length === 0,
    },
    {
      id: "zero",
      title: "G54 at the top-face centre",
      detail:
        "OFFSET (again for the WORK tab), highlight G54, press F3 for the WIPS probe, shut the door, CYCLE START. Or by hand: PART ZERO SET in HANDLE JOG.",
      done: zeroSet,
    },
    {
      id: "run",
      title: "Door shut, MEMORY, CYCLE START",
      detail: "Watch it cut. FEED HOLD pauses; SINGLE BLOCK steps through.",
      done: m.lastProgramDone === name,
    },
  ];
}
