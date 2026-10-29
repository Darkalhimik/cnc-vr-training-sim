/**
 * The stock as a narrow-band signed distance field on a regular lattice.
 *
 * One signed byte per sample, in 1/64 voxel, clamped to ±127 — just under two
 * voxels either side of the surface. Meshing needs no more than the sign and
 * the distance at the samples next to the surface, and a byte keeps the
 * default 100×100×50 mm block at 4 MB. Negative is material.
 *
 * The lattice is offset half a voxel from the stock faces, so an untouched
 * face lies exactly between two layers of samples, and a one-sample skin of
 * air surrounds the block: cutting only ever adds air, so the skin stays air
 * and the surface stays closed.
 *
 * Pure: no DOM, no three.js — it runs in the worker and in Node.
 */
import type { StockSpec } from "./types";

/** Distance steps per voxel edge. */
export const STEPS = 64;
/** Largest stored distance, in steps. A saturated sample only says "far". */
export const BAND = 127;
/** Cells per chunk edge: the unit of re-meshing. */
export const CHUNK = 32;
/** Chunks per render tile edge. Small chunks keep re-meshing cheap; tiles of
 *  them keep draw calls down — the default block is 32 meshes, not ~150. */
export const TILE = 2;
/** Sample budget (8 MB); the voxel grows until the stock fits. */
export const MAX_SAMPLES = 8_000_000;

export type Vec3 = [number, number, number];

/** What the main thread needs to know about the lattice. */
export type GridInfo = {
  /** Voxel edge in use, mm. */
  voxel: number;
  /** Samples per axis. */
  dims: Vec3;
  /** Stock-frame position of sample (0, 0, 0), mm. */
  origin: Vec3;
  /** Chunks per axis. */
  chunks: Vec3;
};

export type Grid = GridInfo & {
  /** Distance per sample, x fastest, then y, then z. */
  data: Int8Array<ArrayBuffer>;
  /** Per chunk: a sample it meshes from changed since it was last meshed. */
  dirty: Uint8Array<ArrayBuffer>;
};

/** Share of a voxel's volume a stored distance stands for: 1 inside, 0 outside,
 *  linear across the half voxel either side of the surface. Index q + 128. */
export const FILL = (() => {
  const table = new Float64Array(256);
  for (let q = -128; q < 128; q++) table[q + 128] = Math.min(1, Math.max(0, 0.5 - q / STEPS));
  return table;
})();

const dimsFor = (size: Vec3, voxel: number): Vec3 =>
  size.map((s) => Math.ceil(s / voxel - 1e-9) + 2) as Vec3;

/** The voxel edge a stock gets: longest side / 200 within [0.25, 2] mm unless
 *  given, then coarsened until the lattice fits MAX_SAMPLES. */
export function resolveVoxel(spec: StockSpec): number {
  const longest = Math.max(...spec.size);
  let voxel = spec.voxel && spec.voxel > 0 ? spec.voxel : Math.min(2, Math.max(0.25, longest / 200));
  for (;;) {
    const [nx, ny, nz] = dimsFor(spec.size, voxel);
    const samples = nx * ny * nz;
    if (samples <= MAX_SAMPLES) return voxel;
    // The air skin makes the count grow slightly faster than the volume.
    voxel *= Math.cbrt(samples / MAX_SAMPLES) * 1.002;
  }
}

/** A fresh, uncut block. */
export function createGrid(spec: StockSpec): Grid {
  const size = spec.size;
  if (!Array.isArray(size) || size.length !== 3 || !size.every((s) => Number.isFinite(s) && s > 0)) {
    throw new Error(`Stock size must be three positive millimetre lengths, got ${JSON.stringify(size)}`);
  }
  const voxel = resolveVoxel(spec);
  const dims = dimsFor(size, voxel);
  const [nx, ny, nz] = dims;
  const origin: Vec3 = [
    -((nx - 1) * voxel) / 2,
    -((ny - 1) * voxel) / 2,
    size[2] / 2 - ((nz - 1) * voxel) / 2,
  ];
  const chunks = dims.map((n) => Math.ceil((n - 1) / CHUNK)) as Vec3;
  const data = new Int8Array(nx * ny * nz);

  // Exact box distance, quantised.
  const [hx, hy, hz] = [size[0] / 2, size[1] / 2, size[2] / 2];
  const toSteps = STEPS / voxel;
  let index = 0;
  for (let k = 0; k < nz; k++) {
    const dz = Math.abs(origin[2] + k * voxel - hz) - hz;
    for (let j = 0; j < ny; j++) {
      const dy = Math.abs(origin[1] + j * voxel) - hy;
      for (let i = 0; i < nx; i++, index++) {
        const dx = Math.abs(origin[0] + i * voxel) - hx;
        const ox = dx > 0 ? dx : 0;
        const oy = dy > 0 ? dy : 0;
        const oz = dz > 0 ? dz : 0;
        const inside = Math.min(Math.max(dx, dy, dz), 0);
        const q = Math.round((Math.sqrt(ox * ox + oy * oy + oz * oz) + inside) * toSteps);
        data[index] = q > BAND ? BAND : q < -BAND ? -BAND : q;
      }
    }
  }

  return { voxel, dims, origin, chunks, data, dirty: new Uint8Array(chunks[0] * chunks[1] * chunks[2]) };
}

export const gridInfo = (g: Grid): GridInfo => ({
  voxel: g.voxel,
  dims: [...g.dims],
  origin: [...g.origin],
  chunks: [...g.chunks],
});

/** Chunks whose meshes read any sample in the inclusive ranges. A chunk meshes
 *  cells [c·CHUNK − 1, (c+1)·CHUNK) — one extra layer below for the quads it
 *  shares — so it reads samples [c·CHUNK − 1, (c+1)·CHUNK]. */
export function markDirty(g: Grid, i0: number, i1: number, j0: number, j1: number, k0: number, k1: number) {
  const [cx, cy, cz] = g.chunks;
  const x0 = Math.max(0, Math.ceil(i0 / CHUNK) - 1);
  const y0 = Math.max(0, Math.ceil(j0 / CHUNK) - 1);
  const z0 = Math.max(0, Math.ceil(k0 / CHUNK) - 1);
  const x1 = Math.min(cx - 1, Math.floor((i1 + 1) / CHUNK));
  const y1 = Math.min(cy - 1, Math.floor((j1 + 1) / CHUNK));
  const z1 = Math.min(cz - 1, Math.floor((k1 + 1) / CHUNK));
  for (let z = z0; z <= z1; z++) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) g.dirty[x + cx * (y + cy * z)] = 1;
    }
  }
}

/** Cells a chunk owns, as half-open index ranges. */
export function chunkCells(info: GridInfo, chunk: number) {
  const [cx, cy] = info.chunks;
  const x = chunk % cx;
  const y = Math.floor(chunk / cx) % cy;
  const z = Math.floor(chunk / (cx * cy));
  const [nx, ny, nz] = info.dims;
  return {
    i0: x * CHUNK,
    i1: Math.min((x + 1) * CHUNK, nx - 1),
    j0: y * CHUNK,
    j1: Math.min((y + 1) * CHUNK, ny - 1),
    k0: z * CHUNK,
    k1: Math.min((z + 1) * CHUNK, nz - 1),
  };
}

/** The render tile a chunk belongs to. */
export function tileOfChunk(info: GridInfo, chunk: number): number {
  const [cx, cy] = info.chunks;
  const [tx, ty] = [Math.ceil(cx / TILE), Math.ceil(cy / TILE)];
  const x = chunk % cx;
  const y = Math.floor(chunk / cx) % cy;
  const z = Math.floor(chunk / (cx * cy));
  return Math.floor(x / TILE) + tx * (Math.floor(y / TILE) + ty * Math.floor(z / TILE));
}

/** The chunks a render tile is made of. */
export function tileChunks(info: GridInfo, tile: number): number[] {
  const [cx, cy, cz] = info.chunks;
  const [tx, ty] = [Math.ceil(cx / TILE), Math.ceil(cy / TILE)];
  const x0 = (tile % tx) * TILE;
  const y0 = (Math.floor(tile / tx) % ty) * TILE;
  const z0 = Math.floor(tile / (tx * ty)) * TILE;
  const out: number[] = [];
  for (let z = z0; z < Math.min(z0 + TILE, cz); z++) {
    for (let y = y0; y < Math.min(y0 + TILE, cy); y++) {
      for (let x = x0; x < Math.min(x0 + TILE, cx); x++) out.push(x + cx * (y + cy * z));
    }
  }
  return out;
}

/** Stock-frame box that holds every vertex a render tile's mesh can have, mm.
 *  A chunk's vertices sit in its cells and the extra layer below them. */
export function tileBox(info: GridInfo, tile: number): { min: Vec3; max: Vec3 } {
  const { origin: o, voxel: h } = info;
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const chunk of tileChunks(info, tile)) {
    const { i0, i1, j0, j1, k0, k1 } = chunkCells(info, chunk);
    const lo = [i0 - 1, j0 - 1, k0 - 1];
    const hi = [i1, j1, k1];
    for (let d = 0; d < 3; d++) {
      min[d] = Math.min(min[d], o[d] + lo[d] * h);
      max[d] = Math.max(max[d], o[d] + hi[d] * h);
    }
  }
  return { min, max };
}

/** Material left, mm³, from the samples alone (no mesh). */
export function materialVolume(g: Grid): number {
  let sum = 0;
  for (let n = 0; n < g.data.length; n++) sum += FILL[g.data[n] + 128];
  return sum * g.voxel ** 3;
}
