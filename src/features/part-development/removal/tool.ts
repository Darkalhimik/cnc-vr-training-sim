/**
 * Cutters as solids of revolution about the tool axis.
 *
 * A point is described by `a`, its height above the tip along the axis, and
 * `r`, its distance from the axis; the distance to a revolved solid is then the
 * 2D distance to its profile in the (r, a) half-plane. Every profile here is
 * convex, which keeps the distances exact and cheap.
 *
 * Only the flutes cut. The shank above them and the holder above the stickout
 * are kept as plain cylinders for collision checks.
 *
 * Pure: runs in the worker and in Node.
 */
import type { CutterShape } from "./types";

export type Tool = {
  /** Drill or chamfer: a cone up to the full diameter. Otherwise a cylinder
   *  with its bottom edge rounded by `corner` (0 flat, radius for a ball). */
  readonly cone: boolean;
  readonly radius: number;
  readonly corner: number;
  /** Cutting length from the tip. */
  readonly flute: number;
  /** Cone half-angle, as sine and cosine. */
  readonly sin: number;
  readonly cos: number;
  /** Height at which the cone reaches the full diameter. */
  readonly coneHeight: number;
  /** Where the cone meets the side (or the top, on flutes shorter than the cone). */
  readonly coneR: number;
  readonly coneA: number;
  readonly shankRadius: number;
  readonly stickout: number;
  readonly holderRadius: number;
  readonly holderTop: number;
  /** Farthest cutting point from the tip, mm: bounds how far a tilt moves the flutes. */
  readonly reach: number;
};

const DEFAULT_TIP_ANGLE = { drill: 118, chamfer: 90 } as const;
const DEFAULT_HOLDER_DIAMETER = 40;
const DEFAULT_HOLDER_LENGTH = 60;

const positive = (v: number | undefined, name: string) => {
  if (v === undefined || !Number.isFinite(v) || v <= 0) throw new Error(`Cutter ${name} must be a positive number, got ${v}`);
  return v;
};

export function compileTool(shape: CutterShape): Tool {
  const radius = positive(shape.diameter, "diameter") / 2;
  const stickout = positive(shape.stickout, "stickout");
  // Flutes cannot reach past the holder face.
  const flute = Math.min(positive(shape.fluteLength, "fluteLength"), stickout);
  const cone = shape.kind === "drill" || shape.kind === "chamfer";

  let corner = 0;
  if (shape.kind === "ball") corner = radius;
  else if (shape.kind === "bull") corner = Math.min(radius, Math.max(0, shape.cornerRadius ?? 0));

  let sin = 1;
  let cos = 0;
  if (cone) {
    const angle = shape.tipAngle ?? DEFAULT_TIP_ANGLE[shape.kind as "drill" | "chamfer"];
    const half = (Math.min(179, Math.max(1, angle)) * Math.PI) / 360;
    sin = Math.sin(half);
    cos = Math.cos(half);
  }

  const holderLength = shape.holderLength ?? DEFAULT_HOLDER_LENGTH;
  return withFlute(
    {
      cone,
      radius,
      corner,
      flute,
      sin,
      cos,
      coneHeight: cone ? (radius * cos) / sin : 0,
      coneR: radius,
      coneA: 0,
      shankRadius: (shape.shankDiameter ?? shape.diameter) / 2,
      stickout,
      holderRadius: (shape.holderDiameter ?? DEFAULT_HOLDER_DIAMETER) / 2,
      holderTop: stickout + Math.max(0, holderLength),
      reach: 0,
    },
    flute,
  );
}

/** The same cutter with flutes `flute` long. A move along the tool's own axis
 *  sweeps exactly the cutter at its lower end with flutes lengthened by the
 *  move, so a plunge is cut as one stamp. */
export function withFlute(t: Tool, flute: number): Tool {
  const full = !t.cone || t.coneHeight <= flute;
  return {
    ...t,
    flute,
    coneA: t.cone ? Math.min(t.coneHeight, flute) : 0,
    coneR: full ? t.radius : (flute * t.sin) / t.cos,
    reach: Math.hypot(flute, t.radius),
  };
}

function segment(r: number, a: number, r0: number, a0: number, r1: number, a1: number) {
  const ur = r1 - r0;
  const ua = a1 - a0;
  const len2 = ur * ur + ua * ua;
  let t = len2 > 0 ? ((r - r0) * ur + (a - a0) * ua) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dr = r - r0 - t * ur;
  const da = a - a0 - t * ua;
  return Math.sqrt(dr * dr + da * da);
}

/** Signed distance from (r, a) to the flutes, mm; negative inside. */
export function fluteDistance(t: Tool, r: number, a: number): number {
  const top = a - t.flute;
  if (!t.cone) {
    // A strip |r| ≤ R − corner, a ≥ corner, grown by `corner`: rounds the
    // bottom edge; the top is cut flat at the flute length.
    const qr = r - t.radius + t.corner;
    const qa = t.corner - a;
    const d = (qr > 0 && qa > 0 ? Math.sqrt(qr * qr + qa * qa) : qr > qa ? qr : qa) - t.corner;
    return d > top ? d : top;
  }
  // Inside a convex polygon the nearest edge line gives the exact distance.
  const flank = r * t.cos - a * t.sin;
  const side = r - t.radius;
  let inside = flank > side ? flank : side;
  if (top > inside) inside = top;
  if (inside <= 0) return inside;
  // Outside, the nearest edge segment does, corners included.
  const d1 = segment(r, a, 0, 0, t.coneR, t.coneA);
  const d2 = segment(r, a, t.coneR, t.coneA, t.coneR, t.flute);
  const d3 = segment(r, a, t.coneR, t.flute, 0, t.flute);
  return Math.min(d1, d2, d3);
}
