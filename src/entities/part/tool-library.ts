/**
 * The tools in the machine: what the CAM picks from, what the offset table
 * starts with, what the removal engine sweeps through the stock and what the
 * rig hangs in the changer.
 *
 * They come from the shop's crib (entities/tooling): the standard set while a
 * level runs, the machine's own loadout in free play. `activeTools()` is
 * whichever is loaded now; `TOOL_LIBRARY` is always the standard set.
 *
 * Lengths are gauge line to tip, the value TOOL OFFSET MEASURE would record
 * for H. Diameters are the D register (Haas Setting 40 = diameter).
 */
import { assemblyById, type CutterKind } from "@/entities/tooling/catalog";
import { STANDARD_LOADOUT, type Loadout } from "@/entities/tooling/loadout";

export type { CutterKind };

export type LibraryTool = {
  number: number;
  /** The crib's tool this is (entities/tooling/catalog.ts). */
  assembly: string;
  name: string;
  kind: CutterKind;
  diameter: number;
  /** Cutting length from the tip. */
  fluteLength: number;
  /** Gauge line to tip. */
  length: number;
  /** Tip to holder face. */
  stickout: number;
  holderDiameter: number;
  /** Drill / spot point angle, degrees. */
  tipAngle?: number;
};

/** A loadout as the tools in the machine, tool number order. Slots naming a
 *  tool the crib does not have are left out. */
export function loadoutTools(loadout: Loadout): LibraryTool[] {
  const tools: LibraryTool[] = [];
  for (const slot of [...loadout].sort((a, b) => a.number - b.number)) {
    const a = assemblyById(slot.assembly);
    if (!a) continue;
    tools.push({
      number: slot.number,
      assembly: a.id,
      name: a.name,
      kind: a.cutterSpec.kind,
      diameter: a.cutterSpec.diameter,
      fluteLength: a.cutterSpec.fluteLength,
      length: a.length,
      stickout: a.stickout,
      holderDiameter: a.holderSpec.noseDiameter,
      ...(a.cutterSpec.tipAngle ? { tipAngle: a.cutterSpec.tipAngle } : {}),
    });
  }
  return tools;
}

/** The shop's standard set, T1–T8: what every level runs with. */
export const TOOL_LIBRARY: LibraryTool[] = loadoutTools(STANDARD_LOADOUT);

let active = TOOL_LIBRARY;
let activeVersion = 0;

/** The tools loaded in the machine now. */
export const activeTools = () => active;
/** Changes whenever another set is loaded: the rig rebuilds its tools on it. */
export const activeToolsVersion = () => activeVersion;

export function setActiveTools(tools: LibraryTool[]) {
  const same =
    tools.length === active.length && tools.every((t, i) => t.number === active[i].number && t.assembly === active[i].assembly);
  if (same) return;
  active = tools;
  activeVersion++;
}

export const toolByNumber = (n: number) => active.find((t) => t.number === n) ?? null;

export type StockMaterial = "aluminium" | "steel" | "pom";

export const MATERIALS: Record<StockMaterial, { label: string; color: string }> = {
  aluminium: { label: "Aluminium 6061", color: "#c3c9d0" },
  steel: { label: "Steel 1018", color: "#8d949b" },
  pom: { label: "POM (acetal)", color: "#efece4" },
};

/**
 * Starting cutting data per tool kind and material: spindle speed, feed,
 * plunge feed, axial step-down, radial step-over as a share of diameter.
 * Conservative handbook values, scaled by diameter for end mills.
 */
export function cuttingData(tool: LibraryTool, material: StockMaterial) {
  // Surface speed (m/min) and chip load (mm/tooth) by material.
  const table = {
    aluminium: { vc: 250, fz: 0.05, ap: 0.5 },
    steel: { vc: 90, fz: 0.03, ap: 0.2 },
    pom: { vc: 300, fz: 0.08, ap: 0.6 },
  }[material];
  const flutes = tool.kind === "drill" || tool.kind === "spot" ? 2 : tool.kind === "face" ? 5 : 3;
  const rpm = Math.min(8100, Math.round((table.vc * 1000) / (Math.PI * tool.diameter) / 10) * 10);
  const feed = Math.round(rpm * flutes * table.fz);
  return {
    rpm,
    feed,
    plunge: Math.round(feed * (tool.kind === "drill" ? 1 : 0.35)),
    /** Axial depth of cut, mm. */
    stepDown: Math.max(0.2, Math.round(tool.diameter * table.ap * 10) / 10),
    /** Radial step-over, mm. */
    stepOver: tool.diameter * (tool.kind === "face" ? 0.7 : 0.45),
    /** Peck depth for drills, mm. */
    peck: Math.round(tool.diameter * (material === "steel" ? 1 : 2) * 10) / 10,
  };
}
