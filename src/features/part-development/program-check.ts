/**
 * Checking a program before it runs: the alarms the control would raise, from
 * the interpreter, plus where the real tools would go — which the control
 * cannot know, and which is how an unmeasured tool or a wrong G54 Z crashes.
 */
import { interpret, type Diagnostic, type NcResult, type NcSetup } from "@/entities/nc";
import { VISE_TOP, toolInStock } from "@/entities/machine/kinematics";
import type { MachineState } from "@/entities/machine/machine-types";
import { setupOf } from "@/entities/machine/program-run";
import { JAW_GRIP, type PartDesign, type Stock } from "@/entities/part/part-design";
import { idealWorkOffset } from "@/entities/part/setup";
import { activeTools, toolByNumber, type LibraryTool } from "@/entities/part/tool-library";

/** Vise body, 140 × 70 mm, and jaws 25 mm thick outside the stock (build_umc500.py). */
const VISE_BODY: [number, number] = [140, 70];
const JAW_THICKNESS = 25;
/** The UMC-500 platter, Ø500 mm. */
const PLATTER_RADIUS = 250;

/** "ideal": the setup the probe shortcuts produce; "machine": as it is set up now. */
export type CheckAgainst = "ideal" | "machine";

export type ProgramCheck = {
  result: NcResult;
  /** Moves that would drive a tool into the vise or the platter, one per tool. */
  crashes: Diagnostic[];
};

/** Gauge-line tool lengths and G54 at the top-face centre, from home. */
export function idealSetup(design: PartDesign): NcSetup {
  return {
    workOffsets: { G54: idealWorkOffset(design.stock) },
    tools: Object.fromEntries(
      activeTools().map((t) => [t.number, { number: t.number, length: t.length, diameter: t.diameter }]),
    ),
    toolInSpindle: 0,
    start: { x: 0, y: 0, z: 0, b: 0, c: 0 },
    options: { metricDefault: true },
  };
}

export function checkProgram(program: string, design: PartDesign, against: CheckAgainst, m: MachineState): ProgramCheck {
  const setup = against === "ideal" ? idealSetup(design) : setupOf(m);
  const result = interpret(program, setup);
  return { result, crashes: intoTheFixture(result, setup.toolInSpindle, design.stock) };
}

/** What a tool tip at `tip` (stock frame) would be inside, if anything solid. */
function hitAt([x, y, z]: number[], tool: LibraryTool, stock: Stock): string | null {
  const r = tool.diameter / 2;
  const halfX = Math.max(VISE_BODY[0] / 2, stock.x / 2 + JAW_THICKNESS) + r;
  const halfY = VISE_BODY[1] / 2 + r;
  if (z < JAW_GRIP && Math.abs(x) <= halfX && Math.abs(y) <= halfY) return "the vise";
  if (z < -VISE_TOP && Math.hypot(x, y) <= PLATTER_RADIUS + r) return "the platter";
  return null;
}

/**
 * The first move of each tool that ends with its real tip inside the vise or
 * the platter. The program's offsets decide where the machine goes; the
 * tool's real length decides where the tip ends up.
 */
function intoTheFixture(result: NcResult, startTool: number, stock: Stock): Diagnostic[] {
  const out: Diagnostic[] = [];
  const flagged = new Set<number>();
  let tool = toolByNumber(startTool);
  for (const m of result.motions) {
    if (m.kind === "toolChange") tool = toolByNumber(m.tool);
    if ((m.kind !== "rapid" && m.kind !== "feed") || !tool || flagged.has(tool.number)) continue;
    const tip = toolInStock(m.to, tool.length).tip;
    const hit = hitAt(tip, tool, stock);
    if (!hit) continue;
    flagged.add(tool.number);
    out.push({
      line: m.line,
      severity: "alarm",
      code: "CRASH",
      message:
        `T${tool.number} would drive into ${hit}, ${(JAW_GRIP - tip[2]).toFixed(1)} mm below the top of the jaws. ` +
        `Check its length offset (H${String(tool.number).padStart(2, "0")}) and G54 Z.`,
      ...(m.program ? { program: m.program } : {}),
    });
  }
  return out;
}
