/**
 * Saved parts as three.js meshes. Shelf previews are coarse enough to mesh
 * on the main thread in a few milliseconds; the full-resolution close-up goes
 * through the removal engine's worker (StockRemoval.load), like the stock on
 * the machine.
 */
import * as THREE from "three";
import { MATERIALS, type StockMaterial } from "@/entities/part/tool-library";
import { createSurface } from "@/features/part-development/removal/surface";
import { fieldGrid, type PartField } from "./part-field";

/** One indexed geometry in stock-frame millimetres (Z up, origin at the
 *  bottom-face centre). */
export function meshField(field: PartField): THREE.BufferGeometry {
  const { tiles } = createSurface(fieldGrid(field));
  let vertices = 0;
  let indices = 0;
  for (const t of tiles) {
    vertices += t.positions.length / 3;
    indices += t.indices.length;
  }
  const position = new Float32Array(vertices * 3);
  const normal = new Float32Array(vertices * 3);
  const index = new Uint32Array(indices);
  let base = 0;
  let at = 0;
  for (const t of tiles) {
    position.set(t.positions, base * 3);
    normal.set(t.normals, base * 3);
    for (let i = 0; i < t.indices.length; i++) index[at + i] = t.indices[i] + base;
    at += t.indices.length;
    base += t.positions.length / 3;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** The look of machined stock, by material. */
export function partMaterial(material: string): THREE.MeshStandardMaterial {
  const known = MATERIALS[material as StockMaterial];
  return new THREE.MeshStandardMaterial({
    color: known?.color ?? "#c3c8ce",
    metalness: material === "pom" ? 0.05 : 0.6,
    roughness: material === "pom" ? 0.55 : 0.38,
  });
}
