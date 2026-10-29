/**
 * UMC-500 kinematics: where the tool is relative to the part, for any machine
 * position, and the inverse.
 *
 * The spindle head carries X/Y/Z; the trunnion carries the part on B (tilt
 * about the machine Y axis) and C (rotation about the platter axis). Haas
 * signs B so that +B tips the platter face towards −X (umc500.md): a negative
 * rotation about +Y, which is why B enters the rotations below negated. So the
 * tool always points straight down in the machine, and it is the part that
 * turns underneath it.
 *
 * Frames, all in millimetres:
 * - machine frame: fixed to the base. X right, Y away from the operator, Z up
 *   — the frame of the CAD in tools/blender/build_umc500.py, before the model
 *   is centred on its footprint;
 * - table frame: fixed to the platter. Origin at the platter's top centre;
 *   axes equal to the machine's at B = 0, C = 0;
 * - stock frame: the table frame lifted to the vise top, so the stock's
 *   bottom face centre is the origin.
 *
 * The constants mirror measurements in the build script; the rig checks the
 * loaded model against them in development.
 */
import type { Axis } from "./machine-types";

export type Vec3 = [number, number, number];
export type MachinePosition = Record<Axis, number>;

/** Machine position the CAD was drawn at. */
export const CAD_POSE: MachinePosition = { x: -53, y: 0, z: -259, b: 0, c: 0 };
/** Spindle nose centre (gauge line) at CAD_POSE. */
export const NOSE_AT_CAD_POSE: Vec3 = [252, -328.5, 1098];
/** A point on the B axis, which runs along machine +Y. */
export const B_PIVOT: Vec3 = [0, -533, 897];
/** Platter top centre at B = 0; the C axis runs along machine +Z through it. */
export const C_CENTER: Vec3 = [0, -533, 849];
/** Height of the vise top above the platter: the stock frame's origin. */
export const VISE_TOP = 100;

const RAD = Math.PI / 180;

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** Rotation about +Y by `deg` (right-handed). */
function rotY([x, y, z]: Vec3, deg: number): Vec3 {
  const c = Math.cos(deg * RAD);
  const s = Math.sin(deg * RAD);
  return [x * c + z * s, y, -x * s + z * c];
}

/** Rotation about +Z by `deg` (right-handed). */
function rotZ([x, y, z]: Vec3, deg: number): Vec3 {
  const c = Math.cos(deg * RAD);
  const s = Math.sin(deg * RAD);
  return [x * c - y * s, x * s + y * c, z];
}

const C_FROM_B = sub(C_CENTER, B_PIVOT);

/** Spindle nose position in the machine frame. */
export function noseAt(p: MachinePosition): Vec3 {
  return add(NOSE_AT_CAD_POSE, [p.x - CAD_POSE.x, p.y - CAD_POSE.y, p.z - CAD_POSE.z]);
}

/** Machine X/Y/Z that put the spindle nose at `nose`. */
export function linearForNose(nose: Vec3): Pick<MachinePosition, "x" | "y" | "z"> {
  const d = sub(nose, NOSE_AT_CAD_POSE);
  return { x: d[0] + CAD_POSE.x, y: d[1] + CAD_POSE.y, z: d[2] + CAD_POSE.z };
}

/** A table-frame point, in the machine frame, with the trunnion at (b, c). */
export function tableToMachine(p: Vec3, b: number, c: number): Vec3 {
  return add(B_PIVOT, rotY(add(C_FROM_B, rotZ(p, c)), -b));
}

/** A machine-frame point, in the table frame, with the trunnion at (b, c). */
export function machineToTable(p: Vec3, b: number, c: number): Vec3 {
  return rotZ(sub(rotY(sub(p, B_PIVOT), b), C_FROM_B), -c);
}

/** A machine-frame direction, in the table frame. */
export function directionToTable(d: Vec3, b: number, c: number): Vec3 {
  return rotZ(rotY(d, b), -c);
}

/** A table-frame direction, in the machine frame. */
export function directionToMachine(d: Vec3, b: number, c: number): Vec3 {
  return rotY(rotZ(d, c), -b);
}

export const tableToStock = (p: Vec3): Vec3 => [p[0], p[1], p[2] - VISE_TOP];
export const stockToTable = (p: Vec3): Vec3 => [p[0], p[1], p[2] + VISE_TOP];

/** Tool tip and axis (tip towards spindle) in the stock frame. */
export function toolInStock(p: MachinePosition, toolLength: number): { tip: Vec3; axis: Vec3 } {
  const tip = sub(noseAt(p), [0, 0, toolLength]);
  return {
    tip: tableToStock(machineToTable(tip, p.b, p.c)),
    axis: directionToTable([0, 0, 1], p.b, p.c),
  };
}

/**
 * Machine X/Y/Z that put the tool tip on a stock-frame point with the
 * trunnion at (b, c) — the inverse the control solves for dynamic work
 * offsets (G254) and tool centre point control (G234).
 */
export function linearForStockTip(
  tip: Vec3,
  b: number,
  c: number,
  toolLength: number,
): Pick<MachinePosition, "x" | "y" | "z"> {
  const tipMachine = tableToMachine(stockToTable(tip), b, c);
  return linearForNose(add(tipMachine, [0, 0, toolLength]));
}

/** Machine X/Y/Z that put the tool tip on a table-frame point at (b, c). */
export function linearForTableTip(
  tip: Vec3,
  b: number,
  c: number,
  toolLength: number,
): Pick<MachinePosition, "x" | "y" | "z"> {
  return linearForNose(add(tableToMachine(tip, b, c), [0, 0, toolLength]));
}

/**
 * A work offset's origin in the table frame. Work offsets are machine X/Y/Z
 * taken with B = C = 0 (where table and machine axes coincide) for a
 * zero-length tool, so the origin is simply where the gauge line would be.
 */
export function workOriginInTable(offset: Pick<MachinePosition, "x" | "y" | "z">): Vec3 {
  return sub(noseAt({ ...offset, b: 0, c: 0 }), C_CENTER);
}

/**
 * Trunnion angles that turn a stock-frame face normal straight up at the
 * spindle — how a side feature gets machined with 3+2 positioning. Prefers
 * the C solution nearest `fromC`.
 */
export function anglesFacingUp(normal: Vec3, fromC = 0): { b: number; c: number } {
  const [nx, ny, nz] = normal;
  const horizontal = Math.hypot(nx, ny);
  if (horizontal < 1e-9) return { b: nz > 0 ? 0 : 180, c: fromC };
  // C swings the normal into the +X half of the XZ plane; B then lifts it.
  const c = -Math.atan2(ny, nx) / RAD;
  const b = Math.atan2(horizontal, nz) / RAD;
  const options = [c, c + 360, c - 360];
  const nearest = options.reduce((best, v) => (Math.abs(v - fromC) < Math.abs(best - fromC) ? v : best));
  return { b, c: nearest };
}
