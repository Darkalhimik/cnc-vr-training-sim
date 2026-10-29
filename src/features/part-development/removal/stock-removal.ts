/**
 * Live material removal for the part on the trunnion.
 *
 * The distance field, the cutting and the meshing all live in a Web Worker
 * (removal.worker.ts); this side only packs poses, and swaps one
 * BufferGeometry per re-meshed render tile inside `group`. The worker starts
 * on the first call, so importing this module during SSR is harmless.
 */
import * as THREE from "three";
import { tileBox, type GridInfo } from "./grid";
import { POSE_STRIDE, type Reply, type Request } from "./protocol";
import type { TileMesh } from "./surface";
import type { CutReport, CutterShape, StockSpec, ToolPose } from "./types";

export interface StockRemoval {
  reset(spec: StockSpec): Promise<void>;
  /** Sweep the cutter through consecutive poses (linear interpolation of tip and
   *  axis between them; the engine subsamples so nothing is skipped). */
  cut(tool: CutterShape, poses: ToolPose[]): Promise<CutReport>;
  /** Meshes of the current stock, in stock-frame millimetres. Updated in place
   *  as chunks are re-meshed; the caller parents and scales it. */
  readonly group: THREE.Group;
  /** Voxel edge in use, mm (the automatic or capped one); 0 until reset() resolves. */
  readonly voxel: number;
  /** Binary STL of the current stock surface. */
  exportStl(): Promise<Blob>;
  /** A copy of the distance field and the material it holds, for saving. */
  exportField(): Promise<{ info: GridInfo; data: Int8Array<ArrayBuffer>; volumeMm3: number }>;
  /** Show a saved field instead of a fresh blank; it can be cut further. */
  load(field: { info: GridInfo; data: Int8Array<ArrayBuffer> }): Promise<void>;
  dispose(): void;
}

export type StockRemovalOptions = {
  /** Let pointer rays hit the stock. Off by default: a ray test against every
   *  chunk's triangles on each pointer move is too slow for a headset, and a
   *  hit would resolve to the trunnion part the stock is parented under. */
  raycast?: boolean;
};

const noRaycast = () => {};

/** Machined aluminium, for when the caller brings no material. */
const defaultMaterial = () =>
  new THREE.MeshStandardMaterial({ color: "#c3c8ce", metalness: 0.35, roughness: 0.45 });

export function createStockRemoval(material?: THREE.Material, options: StockRemovalOptions = {}): StockRemoval {
  const group = new THREE.Group();
  group.name = "StockRemoval";
  const ownMaterial = material ? null : defaultMaterial();
  const stockMaterial = material ?? ownMaterial!;

  const meshes = new Map<number, THREE.Mesh>();
  const pending = new Map<number, { resolve: (reply: Reply) => void; reject: (error: Error) => void }>();
  let info: GridInfo | null = null;
  let worker: Worker | null = null;
  let nextId = 1;
  let disposed = false;

  function failAll(error: Error) {
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
  }

  function connect(): Worker {
    if (worker) return worker;
    if (typeof window === "undefined" || typeof Worker === "undefined") {
      throw new Error("StockRemoval needs a browser: it runs in a Web Worker.");
    }
    const w = new Worker(new URL("./removal.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (event: MessageEvent<Reply>) => receive(event.data);
    w.onerror = (event) => {
      // The worker's state is gone with it; the next call starts a fresh one,
      // which needs a reset() before it can cut.
      w.terminate();
      if (worker === w) worker = null;
      failAll(new Error(`Stock removal worker failed: ${event.message || "unknown error"}`));
    };
    worker = w;
    return w;
  }

  function send(request: Request, transfer: Transferable[] = []): Promise<Reply> {
    return new Promise((resolve, reject) => {
      if (disposed) {
        reject(new Error("StockRemoval is disposed."));
        return;
      }
      try {
        const w = connect();
        pending.set(request.id, { resolve, reject });
        w.postMessage(request, transfer);
      } catch (error) {
        pending.delete(request.id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  function receive(reply: Reply) {
    if (disposed) return;
    // Geometry goes in before the promise settles, so a resolved call is on screen.
    if (reply.type === "reset") {
      info = reply.info;
      for (const tile of [...meshes.keys()]) drop(tile);
      apply(reply.tiles);
    } else if (reply.type === "cut") {
      apply(reply.tiles);
    }
    const entry = pending.get(reply.id);
    pending.delete(reply.id);
    if (!entry) return;
    if (reply.type === "error") entry.reject(new Error(reply.message));
    else entry.resolve(reply);
  }

  function drop(tile: number) {
    const mesh = meshes.get(tile);
    if (!mesh) return;
    group.remove(mesh);
    mesh.geometry.dispose();
    meshes.delete(tile);
  }

  function apply(tiles: TileMesh[]) {
    if (!info) return;
    for (const m of tiles) {
      if (m.indices.length === 0) {
        drop(m.tile);
        continue;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(m.positions, 3));
      geometry.setAttribute("normal", new THREE.BufferAttribute(m.normals, 3));
      geometry.setIndex(new THREE.BufferAttribute(m.indices, 1));
      // Bounds from the tile's cells rather than a pass over the vertices.
      const { min, max } = tileBox(info, m.tile);
      geometry.boundingBox = new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max));
      geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());

      const mesh = meshes.get(m.tile);
      if (mesh) {
        // A new geometry rather than new attributes: dispose() is what frees
        // the old GPU buffers.
        mesh.geometry.dispose();
        mesh.geometry = geometry;
        continue;
      }
      const created = new THREE.Mesh(geometry, stockMaterial);
      created.name = `StockTile_${m.tile}`;
      created.userData.tile = m.tile;
      created.matrixAutoUpdate = false; // positions are already in the stock frame
      if (!options.raycast) created.raycast = noRaycast;
      group.add(created);
      meshes.set(m.tile, created);
    }
  }

  return {
    group,

    get voxel() {
      return info?.voxel ?? 0;
    },

    async reset(spec) {
      await send({ id: nextId++, type: "reset", size: [...spec.size], voxel: spec.voxel });
    },

    async cut(tool, poses) {
      const packed = new Float64Array(poses.length * POSE_STRIDE);
      poses.forEach(({ tip, axis }, n) => {
        packed.set(tip, n * POSE_STRIDE);
        packed.set(axis, n * POSE_STRIDE + 3);
      });
      const reply = await send({ id: nextId++, type: "cut", tool: { ...tool }, poses: packed }, [packed.buffer]);
      if (reply.type !== "cut") throw new Error(`Unexpected reply to cut: ${reply.type}`);
      return reply.report;
    },

    async exportStl() {
      const reply = await send({ id: nextId++, type: "stl" });
      if (reply.type !== "stl") throw new Error(`Unexpected reply to exportStl: ${reply.type}`);
      return new Blob([reply.stl], { type: "model/stl" });
    },

    async exportField() {
      const reply = await send({ id: nextId++, type: "field" });
      if (reply.type !== "field") throw new Error(`Unexpected reply to exportField: ${reply.type}`);
      return { info: reply.info, data: reply.data, volumeMm3: reply.volumeMm3 };
    },

    async load(field) {
      // A copy is transferred, so the caller keeps its field.
      const data = field.data.slice();
      await send({ id: nextId++, type: "load", info: field.info, data }, [data.buffer]);
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      worker?.terminate();
      worker = null;
      failAll(new Error("StockRemoval is disposed."));
      for (const chunk of [...meshes.keys()]) drop(chunk);
      ownMaterial?.dispose();
    },
  };
}
