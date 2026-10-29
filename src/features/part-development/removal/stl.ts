/**
 * Binary STL from indexed meshes. Units are millimetres, the stock frame's.
 *
 * Pure: runs in the worker and in Node.
 */
import type { MeshData } from "./mesher";

const HEADER = "cnc-vr-training-sim stock, mm";

export function writeStl(meshes: MeshData[]): ArrayBuffer {
  let triangles = 0;
  for (const m of meshes) triangles += m.indices.length / 3;
  const buffer = new ArrayBuffer(84 + 50 * triangles);
  const view = new DataView(buffer);
  for (let n = 0; n < HEADER.length; n++) view.setUint8(n, HEADER.charCodeAt(n));
  view.setUint32(80, triangles, true);

  let o = 84;
  for (const { positions: p, indices } of meshes) {
    for (let t = 0; t < indices.length; t += 3) {
      const a = 3 * indices[t];
      const b = 3 * indices[t + 1];
      const c = 3 * indices[t + 2];
      const ux = p[b] - p[a];
      const uy = p[b + 1] - p[a + 1];
      const uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a];
      const vy = p[c + 1] - p[a + 1];
      const vz = p[c + 2] - p[a + 2];
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      view.setFloat32(o, nx, true);
      view.setFloat32(o + 4, ny, true);
      view.setFloat32(o + 8, nz, true);
      o += 12;
      for (const v of [a, b, c]) {
        view.setFloat32(o, p[v], true);
        view.setFloat32(o + 4, p[v + 1], true);
        view.setFloat32(o + 8, p[v + 2], true);
        o += 12;
      }
      o += 2; // attribute byte count, unused
    }
  }
  return buffer;
}
