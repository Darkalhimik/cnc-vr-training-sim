/**
 * The removal engine's worker: owns the distance field and the surface, cuts,
 * and re-meshes what a cut changed before replying, so a resolved cut()
 * always comes with its geometry. Mesh buffers are transferred, never copied.
 */
import { createGrid, gridInfo, materialVolume } from "./grid";
import { tileBuffers, type Reply, type Request } from "./protocol";
import { writeStl } from "./stl";
import { createSurface, refreshSurface, type Surface } from "./surface";
import { cutPath } from "./sweep";
import { compileTool } from "./tool";

// The project compiles against the DOM lib, not the worker lib; this is the
// part of DedicatedWorkerGlobalScope used here.
type Scope = {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage(message: Reply, transfer: Transferable[]): void;
};
const scope = self as unknown as Scope;

let surface: Surface | null = null;

function handle(request: Request) {
  switch (request.type) {
    case "reset": {
      const grid = createGrid({ size: request.size, voxel: request.voxel });
      const fresh = createSurface(grid);
      surface = fresh.surface;
      scope.postMessage(
        { id: request.id, type: "reset", info: gridInfo(grid), tiles: fresh.tiles },
        tileBuffers(fresh.tiles),
      );
      return;
    }
    case "cut": {
      if (!surface) throw new Error("No stock: call reset() before cut().");
      const report = cutPath(surface.grid, compileTool(request.tool), request.poses);
      const tiles = refreshSurface(surface);
      scope.postMessage({ id: request.id, type: "cut", report, tiles }, tileBuffers(tiles));
      return;
    }
    case "load": {
      const { chunks } = request.info;
      const grid = {
        ...request.info,
        data: request.data,
        dirty: new Uint8Array(chunks[0] * chunks[1] * chunks[2]),
      };
      const fresh = createSurface(grid);
      surface = fresh.surface;
      scope.postMessage(
        { id: request.id, type: "reset", info: gridInfo(grid), tiles: fresh.tiles },
        tileBuffers(fresh.tiles),
      );
      return;
    }
    case "field": {
      if (!surface) throw new Error("No stock: call reset() before field().");
      const { grid } = surface;
      const data = grid.data.slice();
      scope.postMessage(
        { id: request.id, type: "field", info: gridInfo(grid), data, volumeMm3: materialVolume(grid) },
        [data.buffer],
      );
      return;
    }
    case "stl": {
      if (!surface) throw new Error("No stock: call reset() before exportStl().");
      // Every cut re-meshes before replying, so the chunk meshes are current.
      const stl = writeStl([...surface.chunks.values()]);
      scope.postMessage({ id: request.id, type: "stl", stl }, [stl]);
      return;
    }
  }
}

scope.onmessage = (event) => {
  const request = event.data;
  try {
    handle(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    scope.postMessage({ id: request.id, type: "error", message }, []);
  }
};
