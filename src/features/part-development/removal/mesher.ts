/**
 * Surface nets over the distance field, one chunk at a time.
 *
 * Every cell the surface passes through gets one vertex, at the mean of the
 * crossings on its edges; every lattice edge the surface crosses gets a quad
 * joining the four cells around it. Normals are the field's gradient at the
 * vertex, so they agree across chunk seams without any stitching.
 *
 * A chunk owns the edges that start in its cells and builds vertices for one
 * extra layer of cells below it, so neighbouring chunks produce bit-identical
 * vertices along their seam and the union of chunk meshes is closed.
 *
 * Pure: runs in the worker and in Node.
 */
import { CHUNK, chunkCells, type Grid } from "./grid";

/** Indexed triangles in stock-frame millimetres. Empty arrays: no surface. */
export type MeshData = {
  positions: Float32Array<ArrayBuffer>;
  normals: Float32Array<ArrayBuffer>;
  /** 16-bit unless there are more than 65 535 vertices. */
  indices: Uint16Array<ArrayBuffer> | Uint32Array<ArrayBuffer>;
};

export type ChunkMesh = MeshData & { chunk: number };

// Scratch reused across chunks; results are copied out at their exact size.
const WINDOW = (CHUNK + 1) ** 3;
const cellVertex = new Int32Array(WINDOW);
let positions = new Float32Array(3 * 4096);
let normals = new Float32Array(3 * 4096);
let indices = new Uint32Array(6 * 4096);

export function meshChunk(g: Grid, chunk: number): ChunkMesh {
  const { i0, i1, j0, j1, k0, k1 } = chunkCells(g, chunk);
  const [nx, ny] = g.dims;
  const nxy = nx * ny;
  const data = g.data;
  const h = g.voxel;
  const [ox, oy, oz] = g.origin;
  // Vertex window: cells [i0 − 1, i1) and likewise in y and z.
  const wx = i1 - i0 + 1;
  const wy = j1 - j0 + 1;
  cellVertex.fill(-1, 0, wx * wy * (k1 - k0 + 1));
  let vertexCount = 0;
  let indexCount = 0;

  const vertex = (ci: number, cj: number, ck: number): number => {
    const slot = ci - i0 + 1 + wx * (cj - j0 + 1 + wy * (ck - k0 + 1));
    const known = cellVertex[slot];
    if (known >= 0) return known;

    const b = ci + nx * (cj + ny * ck);
    const c0 = data[b];
    const c1 = data[b + 1];
    const c2 = data[b + nx];
    const c3 = data[b + nx + 1];
    const c4 = data[b + nxy];
    const c5 = data[b + nxy + 1];
    const c6 = data[b + nxy + nx];
    const c7 = data[b + nxy + nx + 1];
    let sx = 0;
    let sy = 0;
    let sz = 0;
    let n = 0;
    // Crossings on the cell's twelve edges, in cell units.
    if (c0 < 0 !== c1 < 0) { sx += c0 / (c0 - c1); n++; }
    if (c2 < 0 !== c3 < 0) { sx += c2 / (c2 - c3); sy += 1; n++; }
    if (c4 < 0 !== c5 < 0) { sx += c4 / (c4 - c5); sz += 1; n++; }
    if (c6 < 0 !== c7 < 0) { sx += c6 / (c6 - c7); sy += 1; sz += 1; n++; }
    if (c0 < 0 !== c2 < 0) { sy += c0 / (c0 - c2); n++; }
    if (c1 < 0 !== c3 < 0) { sy += c1 / (c1 - c3); sx += 1; n++; }
    if (c4 < 0 !== c6 < 0) { sy += c4 / (c4 - c6); sz += 1; n++; }
    if (c5 < 0 !== c7 < 0) { sy += c5 / (c5 - c7); sx += 1; sz += 1; n++; }
    if (c0 < 0 !== c4 < 0) { sz += c0 / (c0 - c4); n++; }
    if (c1 < 0 !== c5 < 0) { sz += c1 / (c1 - c5); sx += 1; n++; }
    if (c2 < 0 !== c6 < 0) { sz += c2 / (c2 - c6); sy += 1; n++; }
    if (c3 < 0 !== c7 < 0) { sz += c3 / (c3 - c7); sx += 1; sy += 1; n++; }
    const u = sx / n;
    const v = sy / n;
    const w = sz / n;

    // Gradient of the trilinear interpolant at the vertex: points into air.
    let gx = (1 - v) * (1 - w) * (c1 - c0) + v * (1 - w) * (c3 - c2) + (1 - v) * w * (c5 - c4) + v * w * (c7 - c6);
    let gy = (1 - u) * (1 - w) * (c2 - c0) + u * (1 - w) * (c3 - c1) + (1 - u) * w * (c6 - c4) + u * w * (c7 - c5);
    let gz = (1 - u) * (1 - v) * (c4 - c0) + u * (1 - v) * (c5 - c1) + (1 - u) * v * (c6 - c2) + u * v * (c7 - c3);
    const len = Math.sqrt(gx * gx + gy * gy + gz * gz);
    if (len > 0) {
      gx /= len;
      gy /= len;
      gz /= len;
    } else {
      gz = 1;
    }

    if (3 * vertexCount + 3 > positions.length) {
      positions = grow(positions);
      normals = grow(normals);
    }
    const p = 3 * vertexCount;
    positions[p] = ox + (ci + u) * h;
    positions[p + 1] = oy + (cj + v) * h;
    positions[p + 2] = oz + (ck + w) * h;
    normals[p] = gx;
    normals[p + 1] = gy;
    normals[p + 2] = gz;
    cellVertex[slot] = vertexCount;
    return vertexCount++;
  };

  // Counter-clockwise seen from the air side when `flip` is false.
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (indexCount + 6 > indices.length) indices = grow(indices);
    if (flip) {
      indices[indexCount++] = a;
      indices[indexCount++] = c;
      indices[indexCount++] = b;
      indices[indexCount++] = a;
      indices[indexCount++] = d;
      indices[indexCount++] = c;
    } else {
      indices[indexCount++] = a;
      indices[indexCount++] = b;
      indices[indexCount++] = c;
      indices[indexCount++] = a;
      indices[indexCount++] = c;
      indices[indexCount++] = d;
    }
  };

  // Edges on the lattice boundary never cross: the skin samples are all air.
  for (let k = k0; k < k1; k++) {
    for (let j = j0; j < j1; j++) {
      let b = i0 + nx * (j + ny * k);
      for (let i = i0; i < i1; i++, b++) {
        const inside = data[b] < 0;
        if (data[b + 1] < 0 !== inside && j > 0 && k > 0) {
          quad(vertex(i, j - 1, k - 1), vertex(i, j, k - 1), vertex(i, j, k), vertex(i, j - 1, k), !inside);
        }
        if (data[b + nx] < 0 !== inside && i > 0 && k > 0) {
          quad(vertex(i - 1, j, k - 1), vertex(i - 1, j, k), vertex(i, j, k), vertex(i, j, k - 1), !inside);
        }
        if (data[b + nxy] < 0 !== inside && i > 0 && j > 0) {
          quad(vertex(i - 1, j - 1, k), vertex(i, j - 1, k), vertex(i, j, k), vertex(i - 1, j, k), !inside);
        }
      }
    }
  }

  return {
    chunk,
    positions: positions.slice(0, 3 * vertexCount),
    normals: normals.slice(0, 3 * vertexCount),
    indices: vertexCount <= 0xffff ? Uint16Array.from(indices.subarray(0, indexCount)) : indices.slice(0, indexCount),
  };
}

function grow<T extends Float32Array<ArrayBuffer> | Uint32Array<ArrayBuffer>>(array: T): T {
  const next = new (array.constructor as new (length: number) => T)(array.length * 2);
  next.set(array);
  return next;
}

/** Re-meshes every chunk marked dirty and clears the marks. Emptied chunks
 *  come back with empty arrays, so their old mesh can be dropped. */
export function meshDirty(g: Grid): ChunkMesh[] {
  const out: ChunkMesh[] = [];
  for (let c = 0; c < g.dirty.length; c++) {
    if (!g.dirty[c]) continue;
    g.dirty[c] = 0;
    out.push(meshChunk(g, c));
  }
  return out;
}

/** Meshes every chunk that has surface. */
export function meshAll(g: Grid): ChunkMesh[] {
  const out: ChunkMesh[] = [];
  for (let c = 0; c < g.dirty.length; c++) {
    const mesh = meshChunk(g, c);
    if (mesh.indices.length > 0) out.push(mesh);
  }
  return out;
}
