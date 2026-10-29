/**
 * Vector helpers and arcs for the interpreter. Arcs are kept as arcs (centre,
 * axis, sweep) until the very end so cutter compensation can offset them
 * exactly; they become chords only when motions are emitted.
 */
import type { Vec3 } from "../machine/kinematics";

export type { Vec3 };

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const distance = (a: Vec3, b: Vec3) => length(sub(a, b));
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), t));
export function unit(a: Vec3): Vec3 {
  const l = length(a);
  return l > 0 ? scale(a, 1 / l) : [0, 0, 0];
}

/** Rotates `v` about the unit axis `n` by `angle` radians (right-handed). */
export function rotateAbout(v: Vec3, n: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return add(add(scale(v, c), scale(cross(n, v), s)), scale(n, dot(n, v) * (1 - c)));
}

export type Plane = "G17" | "G18" | "G19";

/** First and second in-plane axis, and the normal. G03 turns counter-clockwise
 *  about +normal: G17 about +Z, G18 about +Y (Z towards X), G19 about +X. */
export const PLANE_AXES: Record<Plane, [number, number, number]> = {
  G17: [0, 1, 2],
  G18: [2, 0, 1],
  G19: [1, 2, 0],
};

export function planeNormal(plane: Plane): Vec3 {
  const n: Vec3 = [0, 0, 0];
  n[PLANE_AXES[plane][2]] = 1;
  return n;
}

/**
 * A circular or helical arc. The motion turns counter-clockwise about `n`
 * by `sweep`; the radius runs from r0 to r1 (equal unless the programmed
 * end was slightly off the circle) and the helix rises along `n`.
 */
export type Arc = {
  from: Vec3;
  to: Vec3;
  /** In the plane of `from`. */
  center: Vec3;
  n: Vec3;
  /** Radians, (0, 2π]. */
  sweep: number;
  r0: number;
  r1: number;
};

/** Angle from u0 to u1 about n, in (0, 2π]: equal directions give a full turn. */
export function sweepAbout(u0: Vec3, u1: Vec3, n: Vec3): number {
  const a = Math.atan2(dot(cross(u0, u1), n), dot(u0, u1));
  return a <= 1e-9 ? a + 2 * Math.PI : a;
}

/** Component of `v` in the plane normal to unit `n`. */
export const inPlane = (v: Vec3, n: Vec3): Vec3 => sub(v, scale(n, dot(v, n)));

/** Builds the arc from its centre (any height; projected onto the start's plane). */
export function arcFromCenter(from: Vec3, to: Vec3, center: Vec3, n: Vec3): Arc {
  const c = add(from, inPlane(sub(center, from), n));
  const u0 = inPlane(sub(from, c), n);
  const u1 = inPlane(sub(to, c), n);
  return { from, to, center: c, n, sweep: sweepAbout(unit(u0), unit(u1), n), r0: length(u0), r1: length(u1) };
}

export function arcPoint(arc: Arc, t: number): Vec3 {
  const u = unit(sub(arc.from, arc.center));
  const r = arc.r0 + (arc.r1 - arc.r0) * t;
  const rise = dot(sub(arc.to, arc.from), arc.n);
  return add(add(arc.center, scale(rotateAbout(u, arc.n, arc.sweep * t), r)), scale(arc.n, rise * t));
}

/** Chords needed to keep within `tolerance` of the arc. */
export function arcChords(arc: Arc, tolerance: number): number {
  const r = Math.max(arc.r0, arc.r1);
  const step = r > tolerance ? 2 * Math.acos(1 - tolerance / r) : Math.PI / 2;
  return Math.min(20000, Math.max(1, Math.ceil(arc.sweep / Math.min(step, Math.PI / 2))));
}

/** Length of the arc's path (helix included). */
export function arcLength(arc: Arc): number {
  const r = (arc.r0 + arc.r1) / 2;
  return Math.hypot(r * arc.sweep, dot(sub(arc.to, arc.from), arc.n));
}

/** Where the line through `p` along `d` meets the one through `q` along `e`,
 *  in XY (z from `p`). Null when they are parallel. */
export function intersectLines(p: Vec3, d: Vec3, q: Vec3, e: Vec3): Vec3 | null {
  const den = d[0] * e[1] - d[1] * e[0];
  if (Math.abs(den) < 1e-12) return null;
  const t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den;
  return [p[0] + d[0] * t, p[1] + d[1] * t, p[2]];
}

/** XY intersections of the line through `p` along unit `d` with a circle. */
export function intersectLineCircle(p: Vec3, d: Vec3, c: Vec3, r: number): Vec3[] {
  const fx = p[0] - c[0];
  const fy = p[1] - c[1];
  const b = fx * d[0] + fy * d[1];
  const disc = b * b - (fx * fx + fy * fy - r * r);
  if (disc < -1e-9) return [];
  const s = Math.sqrt(Math.max(0, disc));
  return [-b - s, -b + s].map((t): Vec3 => [p[0] + d[0] * t, p[1] + d[1] * t, p[2]]);
}

/** XY intersections of two circles. */
export function intersectCircles(c1: Vec3, r1: number, c2: Vec3, r2: number): Vec3[] {
  const dx = c2[0] - c1[0];
  const dy = c2[1] - c1[1];
  const d = Math.hypot(dx, dy);
  if (d < 1e-12 || d > r1 + r2 + 1e-9 || d < Math.abs(r1 - r2) - 1e-9) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const mx = c1[0] + (a * dx) / d;
  const my = c1[1] + (a * dy) / d;
  return [
    [mx + (h * dy) / d, my - (h * dx) / d, c1[2]],
    [mx - (h * dy) / d, my + (h * dx) / d, c1[2]],
  ];
}
