/**
 * Where a programmed point ends up in machine coordinates.
 *
 * Three stages, in the order a Fanuc-style control applies them:
 * 1. program -> part: G51 scaling, then G68 rotation (centres are program
 *    coordinates). Cutter compensation works on the result, so offsets are
 *    never scaled and corners stay where the rotated contour puts them.
 * 2. part -> machine, plain: work offset + G52/G92 shift + tool length on Z.
 * 3. part -> machine under G254 (DWO) or G234 (TCPC): the part frame is fixed
 *    to the platter, so the tool tip target is carried through the trunnion
 *    with kinematics.ts and the linear axes solved for it.
 *
 * Work offsets are machine X/Y/Z of the part zero for a zero-length tool,
 * taken at B = 0 with C at the offset's own C value (the platter turned to
 * square the part). With a C offset of 0 that is exactly workOriginInTable()'s
 * convention; with a non-zero C the part frame is the table frame turned by
 * that C, which keeps G254 at B0 C0 identical to plain G54.
 */
import {
  type MachinePosition,
  type Vec3,
  directionToMachine,
  directionToTable,
  linearForTableTip,
  machineToTable,
  noseAt,
  workOriginInTable,
} from "../machine/kinematics";
import { add, rotateAbout, scale, sub } from "./geometry";

/** G51 and G68 as active. */
export type Transform = {
  scaling: { center: Vec3; factor: number } | null;
  rotation: { center: Vec3; axis: Vec3; radians: number } | null;
};

export const IDENTITY: Transform = { scaling: null, rotation: null };

export function toPart(t: Transform, p: Vec3): Vec3 {
  let q = p;
  if (t.scaling) q = add(t.scaling.center, scale(sub(q, t.scaling.center), t.scaling.factor));
  if (t.rotation) q = add(t.rotation.center, rotateAbout(sub(q, t.rotation.center), t.rotation.axis, t.rotation.radians));
  return q;
}

export function fromPart(t: Transform, p: Vec3): Vec3 {
  let q = p;
  if (t.rotation) q = add(t.rotation.center, rotateAbout(sub(q, t.rotation.center), t.rotation.axis, -t.rotation.radians));
  if (t.scaling) q = add(t.scaling.center, scale(sub(q, t.scaling.center), 1 / t.scaling.factor));
  return q;
}

/** A direction (an arc axis) in the part frame. */
export const directionToPart = (t: Transform, d: Vec3): Vec3 =>
  t.rotation ? rotateAbout(d, t.rotation.axis, t.rotation.radians) : d;

/** Everything needed to put a part-frame point on the machine, captured when
 *  the move is read — cutter compensation may emit it a block later. */
export type Frame = {
  mode: "plain" | "dwo" | "tcp";
  /** Work offset X/Y/Z. */
  base: Vec3;
  /** G52 + G92 shift, X/Y/Z. */
  shift: Vec3;
  /** Rotary offset: work offset B/C plus shifts. */
  rotary: { b: number; c: number };
  /** Plain mode: added to machine Z (+H for G43, -H for G44). DWO/TCPC: the
   *  tool length along the tool axis. */
  length: number;
};

/** Machine position for a part-frame point and program B/C. */
export function frameToMachine(f: Frame, part: Vec3, b: number, c: number): MachinePosition {
  const mb = b + f.rotary.b;
  const mc = c + f.rotary.c;
  if (f.mode === "plain") {
    return {
      x: f.base[0] + f.shift[0] + part[0],
      y: f.base[1] + f.shift[1] + part[1],
      z: f.base[2] + f.shift[2] + part[2] + f.length,
      b: mb,
      c: mc,
    };
  }
  const local = add(add(workOriginInTable({ x: f.base[0], y: f.base[1], z: f.base[2] }), f.shift), part);
  const tip = directionToTable(local, 0, f.rotary.c);
  return { ...linearForTableTip(tip, mb, mc, f.length), b: mb, c: mc };
}

/** The inverse: part-frame point and program B/C of a machine position. */
export function machineToFrame(f: Frame, m: MachinePosition): { part: Vec3; b: number; c: number } {
  const b = m.b - f.rotary.b;
  const c = m.c - f.rotary.c;
  if (f.mode === "plain") {
    return {
      part: [m.x - f.base[0] - f.shift[0], m.y - f.base[1] - f.shift[1], m.z - f.base[2] - f.shift[2] - f.length],
      b,
      c,
    };
  }
  const tip = machineToTable(sub(noseAt(m), [0, 0, f.length]), m.b, m.c);
  const local = directionToMachine(tip, 0, f.rotary.c);
  return { part: sub(sub(local, workOriginInTable({ x: f.base[0], y: f.base[1], z: f.base[2] })), f.shift), b, c };
}
