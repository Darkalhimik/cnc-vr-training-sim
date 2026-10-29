/**
 * The shop's tool crib: every holder, cutter and assembled tool the trainer
 * has.
 *
 * Tools are not a machine's own. A tool is a cutter clamped in a holder, and
 * the holder's taper is what a spindle takes: a CT40 holder fits every Haas
 * 40-taper mill, so one crib serves the whole shop and each machine loads
 * from it what its spindle takes (loadout.ts). Research and sources:
 * docs/haas-ngc/tooling.md.
 *
 * Millimetres and kilograms. The eight tools of the standard set keep the
 * exact sizes the levels, the CAM and the removal engine were tuned on; the
 * rest are common sizes a shop keeps beside them.
 */

export type CutterKind = "flat" | "ball" | "drill" | "spot" | "face";

/** The taper a holder has and a spindle takes. CT40 (Haas's CAT40) and BT40
 *  are both 40-taper but do not interchange: flange and pull stud differ. */
export type SpindleInterface = "CT40" | "BT40";

export type HolderKind = "side-lock" | "er-collet" | "shrink-fit" | "shell-mill" | "drill-chuck";

export type Holder = {
  id: string;
  name: string;
  interface: SpindleInterface;
  kind: HolderKind;
  /** Gauge line to the holder's face, where the cutter comes out. */
  gaugeLength: number;
  /** Diameter at the face: what passes nearest the work. */
  noseDiameter: number;
  /** Shank (or arbor) diameters it clamps, smallest and largest. */
  clamps: [number, number];
  maxRpm: number;
  mass: number;
};

export type CutterMaterial = "solid-carbide" | "hss-co" | "indexable";

export type Cutter = {
  id: string;
  name: string;
  kind: CutterKind;
  diameter: number;
  /** Shank diameter; a shell mill's arbor bore. */
  shank: number;
  /** Flutes, or inserts on a face mill. */
  flutes: number;
  /** Cutting length from the tip. */
  fluteLength: number;
  overallLength: number;
  material: CutterMaterial;
  coating: string;
  /** Drill and spot drill point angle, degrees. */
  tipAngle?: number;
};

/** A cutter in a holder: what goes into a pocket. */
export type ToolAssembly = {
  /** Stable: machines' loadouts store it. */
  id: string;
  name: string;
  holder: string;
  cutter: string;
  /** Holder face to tip. */
  stickout: number;
};

export const HOLDER_KIND_LABEL: Record<HolderKind, string> = {
  "side-lock": "Side-lock end mill holder",
  "er-collet": "ER collet chuck",
  "shrink-fit": "Shrink-fit holder",
  "shell-mill": "Shell mill arbor",
  "drill-chuck": "Keyless drill chuck",
};

/** How each kind of holder grips, in a sentence. */
export const HOLDER_CLAMPING: Record<HolderKind, string> = {
  "side-lock":
    "A set screw bears on the flat of a Weldon shank. Rigid and cannot pull out, but runs out a little more than a collet.",
  "er-collet":
    "A slotted collet closes round the shank as the nut is tightened. One chuck takes a range of shanks by changing the collet.",
  "shrink-fit":
    "The bore is heated, the shank slides in, and the holder shrinks onto it as it cools. Least runout, slimmest nose.",
  "shell-mill":
    "The cutter sits on a pilot, two keys drive it, and a screw through its centre holds it on.",
  "drill-chuck":
    "Three jaws close on the shank from the sleeve. Quick to change drills, for drilling only — no side load.",
};

export const CUTTER_MATERIAL_LABEL: Record<CutterMaterial, string> = {
  "solid-carbide": "Solid carbide",
  "hss-co": "HSS-Co (cobalt steel)",
  indexable: "Steel body, carbide inserts",
};

export const CUTTER_KIND_LABEL: Record<CutterKind, string> = {
  face: "Face mill",
  flat: "Flat end mill",
  ball: "Ball end mill",
  spot: "Spot drill",
  drill: "Twist drill",
};

const ct40 = (h: Omit<Holder, "interface">): Holder => ({ ...h, interface: "CT40" });

export const HOLDERS: Holder[] = [
  ct40({ id: "ct40-shell-22", name: "CT40 shell mill arbor Ø22", kind: "shell-mill", gaugeLength: 42, noseDiameter: 50, clamps: [22, 22], maxRpm: 15000, mass: 1.55 }),
  ct40({ id: "ct40-shell-27", name: "CT40 shell mill arbor Ø27", kind: "shell-mill", gaugeLength: 45, noseDiameter: 60, clamps: [27, 27], maxRpm: 12000, mass: 1.9 }),
  ct40({ id: "ct40-sl-6", name: "CT40 side-lock holder Ø6", kind: "side-lock", gaugeLength: 58, noseDiameter: 28, clamps: [6, 6], maxRpm: 18000, mass: 1.15 }),
  ct40({ id: "ct40-sl-10", name: "CT40 side-lock holder Ø10", kind: "side-lock", gaugeLength: 57, noseDiameter: 32, clamps: [10, 10], maxRpm: 18000, mass: 1.25 }),
  ct40({ id: "ct40-sl-12", name: "CT40 side-lock holder Ø12", kind: "side-lock", gaugeLength: 63, noseDiameter: 40, clamps: [12, 12], maxRpm: 15000, mass: 1.4 }),
  ct40({ id: "ct40-sl-16", name: "CT40 side-lock holder Ø16", kind: "side-lock", gaugeLength: 63, noseDiameter: 44, clamps: [16, 16], maxRpm: 15000, mass: 1.55 }),
  ct40({ id: "ct40-sf-8", name: "CT40 shrink-fit holder Ø8", kind: "shrink-fit", gaugeLength: 80, noseDiameter: 27, clamps: [8, 8], maxRpm: 25000, mass: 1.2 }),
  ct40({ id: "ct40-er16", name: "CT40 ER16 collet chuck", kind: "er-collet", gaugeLength: 54, noseDiameter: 28, clamps: [1, 10], maxRpm: 20000, mass: 1.1 }),
  ct40({ id: "ct40-er16-mini", name: "CT40 ER16 collet chuck, mini nut", kind: "er-collet", gaugeLength: 50, noseDiameter: 24, clamps: [1, 10], maxRpm: 20000, mass: 1.05 }),
  ct40({ id: "ct40-er20-mini", name: "CT40 ER20 collet chuck, mini nut", kind: "er-collet", gaugeLength: 48, noseDiameter: 26, clamps: [1, 13], maxRpm: 20000, mass: 1.1 }),
  ct40({ id: "ct40-er32", name: "CT40 ER32 collet chuck", kind: "er-collet", gaugeLength: 60, noseDiameter: 50, clamps: [2, 20], maxRpm: 15000, mass: 1.45 }),
  ct40({ id: "ct40-chuck-13", name: "CT40 keyless drill chuck 1–13", kind: "drill-chuck", gaugeLength: 95, noseDiameter: 50, clamps: [1, 13], maxRpm: 8000, mass: 2.1 }),
];

const carbide = (c: Omit<Cutter, "material" | "coating"> & { coating?: string }): Cutter => ({
  coating: "AlTiN",
  ...c,
  material: "solid-carbide",
});
const hss = (c: Omit<Cutter, "material" | "coating">): Cutter => ({ ...c, material: "hss-co", coating: "TiN" });

export const CUTTERS: Cutter[] = [
  { id: "face-50", name: "Ø50 face mill", kind: "face", diameter: 50, shank: 22, flutes: 5, fluteLength: 6, overallLength: 30, material: "indexable", coating: "PVD-coated inserts" },
  { id: "face-63", name: "Ø63 face mill", kind: "face", diameter: 63, shank: 22, flutes: 5, fluteLength: 6, overallLength: 40, material: "indexable", coating: "PVD-coated inserts" },
  { id: "face-80", name: "Ø80 face mill", kind: "face", diameter: 80, shank: 27, flutes: 6, fluteLength: 6, overallLength: 50, material: "indexable", coating: "PVD-coated inserts" },
  carbide({ id: "em-3", name: "Ø3 end mill, 2 flutes", kind: "flat", diameter: 3, shank: 3, flutes: 2, fluteLength: 8, overallLength: 50 }),
  carbide({ id: "em-6", name: "Ø6 end mill, 3 flutes", kind: "flat", diameter: 6, shank: 6, flutes: 3, fluteLength: 16, overallLength: 57 }),
  carbide({ id: "em-8", name: "Ø8 end mill, 3 flutes", kind: "flat", diameter: 8, shank: 8, flutes: 3, fluteLength: 19, overallLength: 63 }),
  carbide({ id: "em-10", name: "Ø10 end mill, 3 flutes", kind: "flat", diameter: 10, shank: 10, flutes: 3, fluteLength: 22, overallLength: 72 }),
  carbide({ id: "em-12", name: "Ø12 end mill, 3 flutes", kind: "flat", diameter: 12, shank: 12, flutes: 3, fluteLength: 26, overallLength: 83 }),
  carbide({ id: "em-16", name: "Ø16 end mill, 4 flutes", kind: "flat", diameter: 16, shank: 16, flutes: 4, fluteLength: 32, overallLength: 92 }),
  carbide({ id: "bm-4", name: "Ø4 ball end mill", kind: "ball", diameter: 4, shank: 4, flutes: 2, fluteLength: 10, overallLength: 50 }),
  carbide({ id: "bm-6", name: "Ø6 ball end mill", kind: "ball", diameter: 6, shank: 6, flutes: 2, fluteLength: 14, overallLength: 57 }),
  carbide({ id: "bm-10", name: "Ø10 ball end mill", kind: "ball", diameter: 10, shank: 10, flutes: 2, fluteLength: 20, overallLength: 72 }),
  carbide({ id: "spot-6", name: "Ø6 spot drill 90°", kind: "spot", diameter: 6, shank: 6, flutes: 2, fluteLength: 6, overallLength: 50, tipAngle: 90, coating: "TiAlN" }),
  carbide({ id: "spot-10", name: "Ø10 spot drill 90°", kind: "spot", diameter: 10, shank: 10, flutes: 2, fluteLength: 8, overallLength: 55, tipAngle: 90, coating: "TiAlN" }),
  hss({ id: "drill-3.3", name: "Ø3.3 jobber drill", kind: "drill", diameter: 3.3, shank: 3.3, flutes: 2, fluteLength: 36, overallLength: 65, tipAngle: 118 }),
  hss({ id: "drill-4.2", name: "Ø4.2 jobber drill", kind: "drill", diameter: 4.2, shank: 4.2, flutes: 2, fluteLength: 43, overallLength: 75, tipAngle: 118 }),
  hss({ id: "drill-5.0", name: "Ø5.0 jobber drill", kind: "drill", diameter: 5, shank: 5, flutes: 2, fluteLength: 52, overallLength: 86, tipAngle: 118 }),
  hss({ id: "drill-6.8", name: "Ø6.8 jobber drill", kind: "drill", diameter: 6.8, shank: 6.8, flutes: 2, fluteLength: 63, overallLength: 109, tipAngle: 118 }),
  hss({ id: "drill-8.5", name: "Ø8.5 jobber drill", kind: "drill", diameter: 8.5, shank: 8.5, flutes: 2, fluteLength: 75, overallLength: 117, tipAngle: 118 }),
  hss({ id: "drill-10.2", name: "Ø10.2 jobber drill", kind: "drill", diameter: 10.2, shank: 10.2, flutes: 2, fluteLength: 87, overallLength: 133, tipAngle: 118 }),
  hss({ id: "drill-12", name: "Ø12 jobber drill", kind: "drill", diameter: 12, shank: 12, flutes: 2, fluteLength: 101, overallLength: 151, tipAngle: 118 }),
];

/** The crib, in the order it is shelved: face mills, end mills, ball mills,
 *  spot drills, drills. The first eight make the shop's standard set. */
export const ASSEMBLIES: ToolAssembly[] = [
  { id: "face-50", name: "50 mm face mill", holder: "ct40-shell-22", cutter: "face-50", stickout: 30 },
  { id: "em-10", name: "10 mm flat end mill", holder: "ct40-sl-10", cutter: "em-10", stickout: 38 },
  { id: "em-6", name: "6 mm flat end mill", holder: "ct40-sl-6", cutter: "em-6", stickout: 30 },
  { id: "spot-10", name: "10 mm spot drill 90°", holder: "ct40-er16", cutter: "spot-10", stickout: 28 },
  { id: "drill-5.0", name: "5.0 mm drill", holder: "ct40-er16-mini", cutter: "drill-5.0", stickout: 60 },
  { id: "drill-6.8", name: "6.8 mm drill (M8 tap)", holder: "ct40-er16-mini", cutter: "drill-6.8", stickout: 68 },
  { id: "drill-8.5", name: "8.5 mm drill (M10 tap)", holder: "ct40-er20-mini", cutter: "drill-8.5", stickout: 78 },
  { id: "ball-6", name: "6 mm ball end mill", holder: "ct40-sl-6", cutter: "bm-6", stickout: 32 },
  { id: "face-63", name: "63 mm face mill", holder: "ct40-shell-22", cutter: "face-63", stickout: 40 },
  { id: "face-80", name: "80 mm face mill", holder: "ct40-shell-27", cutter: "face-80", stickout: 50 },
  { id: "em-16", name: "16 mm flat end mill", holder: "ct40-sl-16", cutter: "em-16", stickout: 48 },
  { id: "em-12", name: "12 mm flat end mill", holder: "ct40-sl-12", cutter: "em-12", stickout: 42 },
  { id: "em-8", name: "8 mm flat end mill, shrink fit", holder: "ct40-sf-8", cutter: "em-8", stickout: 36 },
  { id: "em-3", name: "3 mm flat end mill", holder: "ct40-er16", cutter: "em-3", stickout: 16 },
  { id: "ball-10", name: "10 mm ball end mill", holder: "ct40-sl-10", cutter: "bm-10", stickout: 36 },
  { id: "ball-4", name: "4 mm ball end mill", holder: "ct40-er16", cutter: "bm-4", stickout: 20 },
  { id: "spot-6", name: "6 mm spot drill 90°", holder: "ct40-er16", cutter: "spot-6", stickout: 22 },
  { id: "drill-3.3", name: "3.3 mm drill (M4 tap)", holder: "ct40-chuck-13", cutter: "drill-3.3", stickout: 45 },
  { id: "drill-4.2", name: "4.2 mm drill (M5 tap)", holder: "ct40-er16-mini", cutter: "drill-4.2", stickout: 52 },
  { id: "drill-10.2", name: "10.2 mm drill (M12 tap)", holder: "ct40-er32", cutter: "drill-10.2", stickout: 92 },
  { id: "drill-12", name: "12 mm drill", holder: "ct40-chuck-13", cutter: "drill-12", stickout: 105 },
];

const DENSITY: Record<CutterMaterial, number> = {
  "solid-carbide": 14.5e-6,
  "hss-co": 8.1e-6,
  // A face mill's body is pocketed for its inserts and chips.
  indexable: 7.85e-6 * 0.6,
};

/** A tool with its holder and cutter looked up, and what follows from them. */
export type AssembledTool = ToolAssembly & {
  holderSpec: Holder;
  cutterSpec: Cutter;
  /** Gauge line to tip: the length the tool setter measures. */
  length: number;
  /** Holder, cutter and pull stud, kg. */
  mass: number;
};

const holderById = new Map(HOLDERS.map((h) => [h.id, h]));
const cutterById = new Map(CUTTERS.map((c) => [c.id, c]));

function assemble(a: ToolAssembly): AssembledTool {
  const holderSpec = holderById.get(a.holder);
  const cutterSpec = cutterById.get(a.cutter);
  if (!holderSpec || !cutterSpec) throw new Error(`Tool ${a.id} names a holder or cutter the crib does not have.`);
  const r = cutterSpec.diameter / 2;
  const cutterMass = Math.PI * r * r * cutterSpec.overallLength * DENSITY[cutterSpec.material];
  return {
    ...a,
    holderSpec,
    cutterSpec,
    length: holderSpec.gaugeLength + a.stickout,
    mass: Math.round((holderSpec.mass + cutterMass + 0.12) * 100) / 100,
  };
}

export const CRIB: AssembledTool[] = ASSEMBLIES.map(assemble);
const byId = new Map(CRIB.map((t) => [t.id, t]));

export const assemblyById = (id: string) => byId.get(id) ?? null;

/** Tools a spindle can take. */
export const cribFor = (spindle: SpindleInterface) => CRIB.filter((t) => t.holderSpec.interface === spindle);
