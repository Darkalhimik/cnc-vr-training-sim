/**
 * The tools loaded in the UMC-500's carousel for part development: what the
 * CAM picks from, what the offset table starts with, and what the material
 * removal engine sweeps through the stock.
 *
 * Lengths are gauge line to tip, the value TOOL OFFSET MEASURE would record
 * for H. Diameters are the D register (Haas Setting 40 = diameter).
 */
export type CutterKind = "flat" | "ball" | "drill" | "spot" | "face";

export type LibraryTool = {
  number: number;
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

export const TOOL_LIBRARY: LibraryTool[] = [
  { number: 1, name: "50 mm face mill", kind: "face", diameter: 50, fluteLength: 6, length: 72, stickout: 30, holderDiameter: 50 },
  { number: 2, name: "10 mm flat end mill", kind: "flat", diameter: 10, fluteLength: 22, length: 95, stickout: 38, holderDiameter: 32 },
  { number: 3, name: "6 mm flat end mill", kind: "flat", diameter: 6, fluteLength: 16, length: 88, stickout: 30, holderDiameter: 28 },
  { number: 4, name: "10 mm spot drill 90°", kind: "spot", diameter: 10, fluteLength: 8, length: 82, stickout: 28, holderDiameter: 28, tipAngle: 90 },
  { number: 5, name: "5.0 mm drill", kind: "drill", diameter: 5, fluteLength: 52, length: 110, stickout: 60, holderDiameter: 24, tipAngle: 118 },
  { number: 6, name: "6.8 mm drill (M8 tap)", kind: "drill", diameter: 6.8, fluteLength: 63, length: 118, stickout: 68, holderDiameter: 24, tipAngle: 118 },
  { number: 7, name: "8.5 mm drill (M10 tap)", kind: "drill", diameter: 8.5, fluteLength: 75, length: 126, stickout: 78, holderDiameter: 26, tipAngle: 118 },
  { number: 8, name: "6 mm ball end mill", kind: "ball", diameter: 6, fluteLength: 14, length: 90, stickout: 32, holderDiameter: 28 },
];

export const toolByNumber = (n: number) => TOOL_LIBRARY.find((t) => t.number === n) ?? null;

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
