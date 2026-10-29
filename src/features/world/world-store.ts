"use client";

import { create } from "zustand";
import { MACHINES } from "@/entities/catalog/machines";
import { useMachineStore } from "@/entities/machine/machine-store";
import { buildWorld, stationById, type Station, type Vec2 } from "@/entities/world/layout";

/** The workshop, laid out once from the catalogue. */
export const WORLD = buildWorld(MACHINES);

/** Eye height of a standing trainee, metres. */
export const EYE_HEIGHT = 1.65;

/**
 * On a desktop the trainee either walks, or stands at a station looking at
 * it: at a machine the camera orbits it and the side panel is the machine's,
 * at the warehouse the shelves can be picked from. A headset has no such
 * modes — everything in reach can be used — so it only ever "walks".
 */
export type WorldView = { kind: "walk" } | { kind: "station"; id: string };

type WorldStore = {
  view: WorldView;
  /** Where the trainee stands: plan position, and the way they face
   *  (forward is (sin yaw, cos yaw), as in layout.ts). */
  player: { position: Vec2; yaw: number };
  /** A move for the scene to make — walked on a desktop, a jump in a headset.
   *  `seq` changes on every request, so asking twice moves twice. */
  travel: { stationId: string; seq: number } | null;
  /** The part being looked at in the warehouse. */
  selectedPart: string | null;
  /** The tool being looked at, in the crib or on a cart (a crib tool id). */
  selectedTool: string | null;

  /** Go to a station; on a desktop its view opens on arrival. */
  goTo: (stationId: string) => void;
  /** The scene got there. */
  arrive: (stationId: string) => void;
  /** Back to walking, from where the station is used. */
  leave: () => void;
  setPlayer: (position: Vec2, yaw: number) => void;
  selectPart: (id: string | null) => void;
  selectTool: (id: string | null) => void;
};

export const useWorldStore = create<WorldStore>((set, get) => ({
  view: { kind: "walk" },
  player: { position: WORLD.spawn.position, yaw: WORLD.spawn.yaw },
  travel: null,
  selectedPart: null,
  selectedTool: null,

  goTo: (stationId) => {
    if (!stationById(WORLD, stationId)) return;
    set({ view: { kind: "walk" }, travel: { stationId, seq: (get().travel?.seq ?? 0) + 1 } });
  },
  arrive: (stationId) => {
    const station = stationById(WORLD, stationId);
    if (!station) return;
    set({
      player: { position: station.stand.position, yaw: station.stand.yaw },
      view: station.kind === "bay" ? { kind: "walk" } : { kind: "station", id: stationId },
    });
  },
  leave: () => set({ view: { kind: "walk" }, selectedPart: null, selectedTool: null }),
  setPlayer: (position, yaw) => set({ player: { position, yaw } }),
  selectPart: (id) => set({ selectedPart: id }),
  selectTool: (id) => set({ selectedTool: id }),
}));

/** The station a desktop trainee is at, if any. */
export const useCurrentStation = (): Station | null =>
  useWorldStore((s) => (s.view.kind === "station" ? stationById(WORLD, s.view.id) : null));

/** The machine stations, by machine id. */
export const machineStation = (machineId: string) =>
  WORLD.stations.find((s) => s.kind === "machine" && s.machineId === machineId) ?? null;

// Development only: lets the browser console (and browser checks) read and
// drive the workshop's state, and read the machine's.
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  const dev = window as unknown as { __world?: typeof useWorldStore; __machine?: typeof useMachineStore };
  dev.__world = useWorldStore;
  dev.__machine = useMachineStore;
}
