/**
 * Furniture and shop props, built from primitives into the merged scenery.
 * Each piece is drawn in its own frame: footprint centred on the origin,
 * front towards +z, standing on y = 0 — layout.ts says where it goes.
 */
import type { Furniture } from "@/entities/world/layout";
import type { StaticBuilder } from "./static-builder";

/** Wall-hung pieces stand 6 cm in front of the wall face (layout.ts puts
 *  them 16 cm off the wall's centre line): this is that gap. */
const WALL_FACE = 0.06;

function bench(b: StaticBuilder) {
  b.box("wood", [1.8, 0.05, 0.46], [0, 0.43, 0]);
  b.box("fabric", [1.7, 0.05, 0.4], [0, 0.48, 0]);
  for (const x of [-0.75, 0.75]) {
    for (const z of [-0.18, 0.18]) b.box("steel", [0.04, 0.41, 0.04], [x, 0.205, z]);
    b.box("steel", [0.04, 0.04, 0.4], [x, 0.06, 0]);
  }
}

function desk(b: StaticBuilder) {
  // A briefing desk: solid front the trainees face, worktop, a screen.
  b.box("paint", [2.1, 1.0, 0.62], [0, 0.5, -0.06]);
  b.box("steel", [2.12, 0.06, 0.64], [0, 0.03, -0.06]);
  b.box("wood", [2.2, 0.04, 0.82], [0, 1.02, 0]);
  b.box("blueSteel", [2.12, 0.08, 0.02], [0, 0.82, 0.255]);
  b.box("black", [0.56, 0.34, 0.025], [-0.45, 1.33, -0.15], [-0.1, 0, 0]);
  b.box("steel", [0.04, 0.16, 0.04], [-0.45, 1.12, -0.17]);
  b.box("steel", [0.22, 0.015, 0.16], [-0.45, 1.045, -0.17]);
}

function plant(b: StaticBuilder) {
  b.cylinder("ceramic", 0.2, 0.48, [0, 0.24, 0], { top: 0.25, segments: 20 });
  b.cylinder("black", 0.235, 0.02, [0, 0.47, 0], { segments: 20 });
  const leaves: [number, number, number, number][] = [
    [0, 0.85, 0, 0.32],
    [0.14, 1.1, 0.06, 0.24],
    [-0.12, 1.06, -0.08, 0.25],
    [0.04, 1.32, -0.05, 0.2],
    [-0.06, 0.72, 0.14, 0.2],
  ];
  for (const [x, y, z, r] of leaves) b.sphere("leaf", r, [x, y, z], [1, 1.25, 1]);
}

function workbench(b: StaticBuilder) {
  b.box("wood", [2.2, 0.05, 0.8], [0, 0.9, 0]);
  for (const x of [-1.02, 1.02]) {
    for (const z of [-0.33, 0.33]) b.box("steel", [0.06, 0.875, 0.06], [x, 0.4375, z]);
  }
  b.box("steel", [2.1, 0.03, 0.7], [0, 0.18, 0]);
  b.box("steel", [2.1, 0.06, 0.04], [0, 0.85, 0.34]);
  // A bench vise, jaws towards the front edge.
  b.box("blueSteel", [0.22, 0.12, 0.2], [0.62, 0.985, 0.22]);
  b.box("steel", [0.2, 0.08, 0.025], [0.62, 1.05, 0.33]);
  b.box("steel", [0.2, 0.08, 0.025], [0.62, 1.05, 0.29]);
  b.cylinder("steelLight", 0.012, 0.26, [0.62, 0.99, 0.37], { segments: 8, rotation: [0, 0, Math.PI / 2] });
  // Pegboard with hand tools against the wall.
  b.box("paint", [2.0, 0.9, 0.025], [0, 1.6, -0.38]);
  const tools: [number, number, number][] = [
    [-0.8, 0.22, 0.03],
    [-0.65, 0.26, 0.025],
    [-0.5, 0.3, 0.025],
    [-0.2, 0.34, 0.04],
    [0.15, 0.18, 0.05],
    [0.35, 0.24, 0.03],
    [0.6, 0.28, 0.03],
  ];
  for (const [x, h, w] of tools) b.box("steelLight", [w, h, 0.015], [x, 1.62, -0.36]);
  b.box("red", [0.32, 0.1, 0.12], [0.85, 1.75, -0.32]);
}

function rack(b: StaticBuilder) {
  // A cantilever rack of bar stock: uprights at the back, arms forward.
  for (const x of [-1.2, 0, 1.2]) {
    b.box("blueSteel", [0.1, 2.0, 0.1], [x, 1.0, -0.38]);
    b.box("blueSteel", [0.1, 0.08, 0.9], [x, 0.04, 0]);
    for (const y of [0.45, 0.9, 1.35, 1.8]) b.box("blueSteel", [0.06, 0.05, 0.75], [x, y, -0.03]);
  }
  const levels: [number, "aluminium" | "barSteel", number][] = [
    [0.45, "barSteel", 0.035],
    [0.9, "aluminium", 0.03],
    [1.35, "aluminium", 0.022],
    [1.8, "barSteel", 0.018],
  ];
  for (const [y, key, r] of levels) {
    for (let i = 0; i < 5; i++) {
      b.cylinder(key, r, 2.5, [0, y + 0.025 + r, -0.25 + i * (r * 2 + 0.02)], { segments: 10, rotation: [0, 0, Math.PI / 2] });
    }
  }
}

function cart(b: StaticBuilder) {
  b.box("red", [0.82, 0.78, 0.5], [0, 0.49, 0]);
  b.box("rubber", [0.84, 0.03, 0.52], [0, 0.895, 0]);
  for (const y of [0.25, 0.4, 0.55, 0.7]) b.box("black", [0.7, 0.01, 0.01], [0, y, 0.255]);
  b.box("steelLight", [0.6, 0.02, 0.02], [0, 0.8, 0.27]);
  for (const x of [-0.34, 0.34]) {
    for (const z of [-0.18, 0.18]) b.cylinder("rubber", 0.045, 0.04, [x, 0.05, z], { segments: 10, rotation: [Math.PI / 2, 0, 0] });
  }
}

function pallet(b: StaticBuilder) {
  for (const z of [-0.45, 0, 0.45]) b.box("pallet", [1.2, 0.1, 0.1], [0, 0.05, z]);
  for (let i = 0; i < 7; i++) b.box("pallet", [0.14, 0.022, 1.0], [-0.54 + i * 0.18, 0.111, 0]);
  // A stack of aluminium plate, strapped.
  for (let i = 0; i < 6; i++) b.box("aluminium", [0.9, 0.025, 0.7], [0, 0.135 + i * 0.027, 0]);
  b.box("black", [0.02, 0.17, 0.72], [0.25, 0.2, 0]);
  b.box("black", [0.02, 0.17, 0.72], [-0.25, 0.2, 0]);
}

function bollard(b: StaticBuilder) {
  b.cylinder("safety", 0.09, 1.0, [0, 0.5, 0], { segments: 14 });
  for (const y of [0.62, 0.82]) b.cylinder("black", 0.093, 0.06, [0, y, 0], { segments: 14 });
  b.cylinder("steel", 0.15, 0.02, [0, 0.01, 0], { segments: 14 });
}

function extinguisher(b: StaticBuilder) {
  // Hung on the wall, the bracket against its face.
  b.box("steel", [0.12, 0.08, 0.04], [0, 0.88, -WALL_FACE + 0.02]);
  b.cylinder("red", 0.08, 0.5, [0, 0.95, -WALL_FACE + 0.1], { segments: 16 });
  b.sphere("red", 0.08, [0, 1.2, -WALL_FACE + 0.1], [1, 0.5, 1]);
  b.box("black", [0.05, 0.08, 0.04], [0, 1.27, -WALL_FACE + 0.1]);
  b.box("black", [0.02, 0.3, 0.02], [0.07, 1.05, -WALL_FACE + 0.15]);
}

const BUILDERS: Record<Furniture["kind"], (b: StaticBuilder) => void> = {
  bench,
  desk,
  plant,
  workbench,
  rack,
  cart,
  pallet,
  bollard,
  extinguisher,
};

export function buildFurniture(b: StaticBuilder, pieces: Furniture[]) {
  for (const f of pieces) b.frame([f.position[0], 0, f.position[1]], f.yaw, () => BUILDERS[f.kind](b));
}
