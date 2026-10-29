/**
 * A part as the designer describes it: a block of stock with machined
 * features on its top and four sides.
 *
 * Feature coordinates are face-local millimetres: (u, v) measured from the
 * face's centre, u to the right and v up as you look at the face from
 * outside the part; `depth` goes into the part along the face normal.
 *
 * The part frame is the one the CAM programs in and the trainee sets G54 to:
 * origin at the top-face centre of the stock, axes those of the table at
 * B = C = 0. The bottom JAW_GRIP mm are inside the vise jaws.
 */
import type { StockMaterial } from "./tool-library";

export type Vec3 = [number, number, number];
export type Face = "top" | "front" | "back" | "left" | "right";

export const FACES: Face[] = ["top", "front", "right", "back", "left"];
export const FACE_LABEL: Record<Face, string> = {
  top: "Top",
  front: "Front",
  back: "Back",
  left: "Left",
  right: "Right",
};

/** How deep the vise jaws grip the stock. Side features must stay above it. */
export const JAW_GRIP = 8;

export type Stock = { x: number; y: number; z: number; material: StockMaterial };

type Base = { id: string; face: Face };

export type Feature =
  | (Base & { kind: "face"; depth: number })
  | (Base & {
      kind: "pocket-rect";
      center: [number, number];
      size: [number, number];
      cornerRadius: number;
      depth: number;
    })
  | (Base & { kind: "pocket-circle"; center: [number, number]; diameter: number; depth: number })
  | (Base & { kind: "hole"; center: [number, number]; diameter: number; depth: number })
  | (Base & { kind: "slot"; start: [number, number]; end: [number, number]; width: number; depth: number })
  /** Profiles the outside of the part down to a finished size, top face only. */
  | (Base & { kind: "contour"; size: [number, number]; cornerRadius: number; depth: number });

export type FeatureKind = Feature["kind"];

export type PartDesign = {
  name: string;
  /** Program number the CAM writes, e.g. 1001 → O01001. */
  programNumber: number;
  stock: Stock;
  features: Feature[];
};

/** A face's frame in the part frame: centre, in-face axes and outward normal. */
export function faceFrame(face: Face, stock: Stock): { origin: Vec3; u: Vec3; v: Vec3; n: Vec3 } {
  const { x, y, z } = stock;
  const midZ = -z / 2;
  switch (face) {
    case "top":
      return { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] };
    case "front":
      return { origin: [0, -y / 2, midZ], u: [1, 0, 0], v: [0, 0, 1], n: [0, -1, 0] };
    case "back":
      return { origin: [0, y / 2, midZ], u: [-1, 0, 0], v: [0, 0, 1], n: [0, 1, 0] };
    case "left":
      return { origin: [-x / 2, 0, midZ], u: [0, -1, 0], v: [0, 0, 1], n: [-1, 0, 0] };
    case "right":
      return { origin: [x / 2, 0, midZ], u: [0, 1, 0], v: [0, 0, 1], n: [1, 0, 0] };
  }
}

/** Width and height of a face as seen from outside: the u and v extents. */
export function faceSize(face: Face, stock: Stock): [number, number] {
  switch (face) {
    case "top":
      return [stock.x, stock.y];
    case "front":
    case "back":
      return [stock.x, stock.z];
    case "left":
    case "right":
      return [stock.y, stock.z];
  }
}

/** A face-local point (u, v, depth below the face) in the part frame. */
export function facePoint(face: Face, stock: Stock, u: number, v: number, depth = 0): Vec3 {
  const f = faceFrame(face, stock);
  return [0, 1, 2].map((i) => f.origin[i] + u * f.u[i] + v * f.v[i] - depth * f.n[i]) as Vec3;
}

/** The face-local footprint of a feature: [uMin, vMin, uMax, vMax]. */
export function featureBounds(f: Feature, stock: Stock): [number, number, number, number] {
  const [w, h] = faceSize(f.face, stock);
  switch (f.kind) {
    case "face":
      return [-w / 2, -h / 2, w / 2, h / 2];
    case "pocket-rect":
      return [f.center[0] - f.size[0] / 2, f.center[1] - f.size[1] / 2, f.center[0] + f.size[0] / 2, f.center[1] + f.size[1] / 2];
    case "pocket-circle":
    case "hole":
      return [f.center[0] - f.diameter / 2, f.center[1] - f.diameter / 2, f.center[0] + f.diameter / 2, f.center[1] + f.diameter / 2];
    case "slot": {
      const r = f.width / 2;
      return [
        Math.min(f.start[0], f.end[0]) - r,
        Math.min(f.start[1], f.end[1]) - r,
        Math.max(f.start[0], f.end[0]) + r,
        Math.max(f.start[1], f.end[1]) + r,
      ];
    }
    case "contour":
      return [-w / 2, -h / 2, w / 2, h / 2];
  }
}

export type DesignIssue = { featureId: string | null; message: string };

/** What would make the part impossible or unsafe to machine as designed. */
export function validateDesign(d: PartDesign): DesignIssue[] {
  const issues: DesignIssue[] = [];
  const { stock } = d;
  if (stock.x < 20 || stock.y < 20 || stock.z < 15) {
    issues.push({ featureId: null, message: "Stock is too small to hold in the vise (min 20 × 20 × 15 mm)." });
  }
  if (stock.x > 160 || stock.y > 160 || stock.z > 120) {
    issues.push({ featureId: null, message: "Stock is larger than the vise and work envelope allow (max 160 × 160 × 120 mm)." });
  }
  for (const f of d.features) {
    const [w, h] = faceSize(f.face, stock);
    const [u0, v0, u1, v1] = featureBounds(f, stock);
    if (f.kind !== "face" && f.kind !== "contour" && (u0 < -w / 2 || u1 > w / 2 || v0 < -h / 2 || v1 > h / 2)) {
      issues.push({ featureId: f.id, message: "Runs off the edge of the face." });
    }
    const along = f.face === "top" ? stock.z : f.face === "front" || f.face === "back" ? stock.y : stock.x;
    if (f.depth <= 0 || f.depth >= along) {
      issues.push({ featureId: f.id, message: `Depth must be between 0 and ${along} mm.` });
    }
    if (f.face !== "top" && v0 < -h / 2 + JAW_GRIP + 2) {
      issues.push({ featureId: f.id, message: `Reaches into the vise jaws — keep it ${JAW_GRIP + 2} mm above the bottom.` });
    }
    if (f.face === "top" && stock.z - f.depth < JAW_GRIP) {
      issues.push({ featureId: f.id, message: "Cuts down into the vise jaws." });
    }
    if (f.kind === "contour" && f.face !== "top") {
      issues.push({ featureId: f.id, message: "Outside contours are machined from the top face." });
    }
    if (f.kind === "contour" && (f.size[0] > stock.x || f.size[1] > stock.y)) {
      issues.push({ featureId: f.id, message: "Finished size is bigger than the stock." });
    }
    if (f.kind === "pocket-rect" && f.cornerRadius < 3.2) {
      issues.push({ featureId: f.id, message: "Corner radius below 3.2 mm: no end mill in the carousel fits." });
    }
  }
  return issues;
}

let nextId = 1;
export const newFeatureId = () => `f${Date.now().toString(36)}${(nextId++).toString(36)}`;

/** A small part that exercises every operation: what Part development opens with. */
export const SAMPLE_DESIGN: PartDesign = {
  name: "Training bracket",
  programNumber: 1001,
  stock: { x: 80, y: 60, z: 40, material: "aluminium" },
  features: [
    { id: "f-face", kind: "face", face: "top", depth: 1 },
    { id: "f-contour", kind: "contour", face: "top", size: [76, 56], cornerRadius: 6, depth: 12 },
    { id: "f-pocket", kind: "pocket-rect", face: "top", center: [-12, 0], size: [30, 24], cornerRadius: 5, depth: 8 },
    { id: "f-bore", kind: "pocket-circle", face: "top", center: [20, 10], diameter: 16, depth: 6 },
    { id: "f-hole1", kind: "hole", face: "top", center: [22, -15], diameter: 6.8, depth: 18 },
    { id: "f-slot", kind: "slot", face: "front", start: [-20, 4], end: [20, 4], width: 6, depth: 3 },
    { id: "f-side-hole", kind: "hole", face: "right", center: [0, 6], diameter: 5, depth: 12 },
  ],
};
