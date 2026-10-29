/**
 * Messages between createStockRemoval and removal.worker.ts. Every request
 * gets exactly one reply with its id; the worker handles them in order, so
 * replies arrive in order too.
 */
import type { GridInfo } from "./grid";
import type { TileMesh } from "./surface";
import type { CutReport, CutterShape } from "./types";

/** Floats per pose in a packed pose buffer: tip xyz, then axis xyz. */
export const POSE_STRIDE = 6;

export type Request =
  | { id: number; type: "reset"; size: [number, number, number]; voxel?: number }
  /** Poses packed POSE_STRIDE floats each, transferred. */
  | { id: number; type: "cut"; tool: CutterShape; poses: Float64Array<ArrayBuffer> }
  | { id: number; type: "stl" };

export type Reply =
  /** Every tile with surface; the main thread replaces all it has. */
  | { id: number; type: "reset"; info: GridInfo; tiles: TileMesh[] }
  /** Only the tiles the cut changed; empty ones mean "drop it". */
  | { id: number; type: "cut"; report: CutReport; tiles: TileMesh[] }
  | { id: number; type: "stl"; stl: ArrayBuffer }
  | { id: number; type: "error"; message: string };

export const tileBuffers = (tiles: TileMesh[]): ArrayBuffer[] =>
  tiles.flatMap((m) => [m.positions.buffer, m.normals.buffer, m.indices.buffer]);
