/**
 * The stock surface as the worker keeps it: the latest mesh of every chunk,
 * merged into render tiles (TILE³ chunks) for the main thread. A cut re-meshes
 * only its dirty chunks; a tile is then rebuilt by copying, not re-meshing.
 *
 * Pure: runs in the worker and in Node.
 */
import { tileChunks, tileOfChunk, type Grid } from "./grid";
import { meshAll, meshDirty, type ChunkMesh, type MeshData } from "./mesher";

/** One render tile's mesh. Empty arrays: the tile has no surface left. */
export type TileMesh = MeshData & { tile: number };

export type Surface = {
  readonly grid: Grid;
  /** Chunks with surface only. */
  readonly chunks: Map<number, ChunkMesh>;
};

/** Meshes a fresh grid: the surface, and every tile that has any. */
export function createSurface(grid: Grid): { surface: Surface; tiles: TileMesh[] } {
  const chunks = new Map(meshAll(grid).map((m) => [m.chunk, m]));
  const surface = { grid, chunks };
  const tiles = new Set([...chunks.keys()].map((c) => tileOfChunk(grid, c)));
  return { surface, tiles: [...tiles].map((t) => mergeTile(surface, t)) };
}

/** Re-meshes the chunks a cut dirtied; returns the tiles they belong to. */
export function refreshSurface(surface: Surface): TileMesh[] {
  const touched = new Set<number>();
  for (const m of meshDirty(surface.grid)) {
    if (m.indices.length > 0) surface.chunks.set(m.chunk, m);
    else surface.chunks.delete(m.chunk);
    touched.add(tileOfChunk(surface.grid, m.chunk));
  }
  return [...touched].map((t) => mergeTile(surface, t));
}

function mergeTile(surface: Surface, tile: number): TileMesh {
  const parts: ChunkMesh[] = [];
  let vertexCount = 0;
  let indexCount = 0;
  for (const chunk of tileChunks(surface.grid, tile)) {
    const part = surface.chunks.get(chunk);
    if (!part) continue;
    parts.push(part);
    vertexCount += part.positions.length / 3;
    indexCount += part.indices.length;
  }
  const positions = new Float32Array(3 * vertexCount);
  const normals = new Float32Array(3 * vertexCount);
  const indices = vertexCount <= 0xffff ? new Uint16Array(indexCount) : new Uint32Array(indexCount);
  let base = 0;
  let at = 0;
  for (const part of parts) {
    positions.set(part.positions, 3 * base);
    normals.set(part.normals, 3 * base);
    const src = part.indices;
    for (let n = 0; n < src.length; n++) indices[at + n] = src[n] + base;
    at += src.length;
    base += part.positions.length / 3;
  }
  return { tile, positions, normals, indices };
}
