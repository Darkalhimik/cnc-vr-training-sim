/**
 * Static scenery, merged: everything added here ends up as one mesh per
 * material. A wall of boxes, a rack of bars, every sign in the building — each
 * becomes a single draw call, which is what lets a headset draw the whole
 * workshop twice a frame.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { MaterialKey } from "./world-materials";

type V3 = [number, number, number];

const UP = new THREE.Vector3(0, 1, 0);
const ONE = new THREE.Vector3(1, 1, 1);

export class StaticBuilder {
  private parts = new Map<MaterialKey, THREE.BufferGeometry[]>();
  private stack: THREE.Matrix4[] = [new THREE.Matrix4()];

  private get top() {
    return this.stack[this.stack.length - 1];
  }

  /** Build `fn`'s pieces in a frame at (x, y, z), turned `yaw` about +Y. */
  frame(position: V3, yaw: number, fn: () => void) {
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion().setFromAxisAngle(UP, yaw),
      ONE,
    );
    this.stack.push(this.top.clone().multiply(local));
    fn();
    this.stack.pop();
  }

  add(key: MaterialKey, geometry: THREE.BufferGeometry, position: V3 = [0, 0, 0], rotation: V3 = [0, 0, 0]) {
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      ONE,
    );
    geometry.applyMatrix4(this.top.clone().multiply(local));
    const list = this.parts.get(key) ?? [];
    list.push(geometry);
    this.parts.set(key, list);
  }

  /** A box whose texture repeats every metre, whatever its size — a 12 m wall
   *  and a 30 cm shelf show the same grain. */
  box(key: MaterialKey, size: V3, position: V3, rotation?: V3) {
    const g = new THREE.BoxGeometry(...size);
    const [w, h, d] = size;
    // BoxGeometry's faces, four vertices each: ±x (depth × height),
    // ±y (width × depth), ±z (width × height).
    const span: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    const uv = g.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      const [su, sv] = span[Math.floor(i / 4)];
      uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    }
    this.add(key, g, position, rotation);
  }

  cylinder(key: MaterialKey, radius: number, height: number, position: V3, opts: { segments?: number; top?: number; rotation?: V3 } = {}) {
    this.add(key, new THREE.CylinderGeometry(opts.top ?? radius, radius, height, opts.segments ?? 16), position, opts.rotation);
  }

  sphere(key: MaterialKey, radius: number, position: V3, scale: V3 = [1, 1, 1]) {
    const g = new THREE.IcosahedronGeometry(radius, 1);
    g.scale(...scale);
    // Icosahedra come unindexed; everything merged with them must match.
    this.add(key, mergeVertices(g), position);
  }

  /** A quad, optionally mapped to a region [u0, v0, u1, v1] of its texture. */
  plane(key: MaterialKey, size: [number, number], position: V3, rotation: V3 = [0, 0, 0], uv?: [number, number, number, number]) {
    const g = new THREE.PlaneGeometry(...size);
    if (uv) {
      const a = g.getAttribute("uv") as THREE.BufferAttribute;
      for (let i = 0; i < a.count; i++) a.setXY(i, uv[0] + a.getX(i) * (uv[2] - uv[0]), uv[1] + a.getY(i) * (uv[3] - uv[1]));
    }
    this.add(key, g, position, rotation);
  }

  /** A quad on the floor, `size` along x and z, a hair above it. */
  floorQuad(key: MaterialKey, size: [number, number], center: [number, number], yaw = 0, lift = 0.003) {
    this.plane(key, size, [center[0], lift, center[1]], [-Math.PI / 2, 0, yaw]);
  }

  build(): { key: MaterialKey; geometry: THREE.BufferGeometry }[] {
    const out: { key: MaterialKey; geometry: THREE.BufferGeometry }[] = [];
    for (const [key, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      out.push({ key, geometry: merged });
    }
    this.parts.clear();
    return out;
  }
}

/** Indexes a non-indexed geometry, so it merges with indexed ones. */
function mergeVertices(g: THREE.BufferGeometry) {
  if (g.index) return g;
  const count = (g.getAttribute("position") as THREE.BufferAttribute).count;
  g.setIndex(Array.from({ length: count }, (_, i) => i));
  return g;
}
