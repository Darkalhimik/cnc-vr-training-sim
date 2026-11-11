"use client";

import { create } from "zustand";
import { MACHINES, type MachineId } from "@/entities/catalog/machines";
import { useMachineStore } from "@/entities/machine/machine-store";
import { buildWorld, stationById, type Station, type Vec2 } from "@/entities/world/layout";

/** The workshop, laid out once from the catalogue. */
export const WORLD = buildWorld(MACHINES);

/** Eye height of a standing trainee, metres. */
export const EYE_HEIGHT = 1.65;

/**
 * The trainee is one person, always: on a desktop the camera is their eyes and
 * nothing else. Clicking a machine, the warehouse or a tool rack never moves
 * the view — it opens that station's menu (`view`), and while it is open the
 * station's own controls answer the mouse. Walking on keeps the menu open.
 * A headset has no menus — everything in reach can be used — so its view
 * only says which station the player was last taken to.
 */
export type WorldView = { kind: "walk" } | { kind: "station"; id: string };

type WorldStore = {
  view: WorldView;
  /** Where the trainee stands: plan position, and the way they face
   *  (forward is (sin yaw, cos yaw), as in layout.ts). */
  player: { position: Vec2; yaw: number };
  /** A walk for the scene to make — on foot on a desktop, a jump in a
   *  headset — ending with the station's menu open. `seq` changes on every
   *  request, so asking twice walks twice. */
  travel: { stationId: string; seq: number } | null;
  /** The station under the desktop pointer whose menu is not open yet. */
  hovered: string | null;
  /** The desktop player is crouching (Ctrl). */
  crouching: boolean;
  /** AR glasses and phones have no workshop: the machine out is picked from
   *  a menu. */
  arMachineId: MachineId;
  /** The part being looked at in the warehouse. */
  selectedPart: string | null;
  /** The tool being looked at, in the crib or on a cart (a crib tool id). */
  selectedTool: string | null;

  /** Walk to a station; its menu opens on arrival. */
  goTo: (stationId: string) => void;
  /** Stand at a station at once, with its menu open (the page's start, a
   *  headset's jump). */
  arrive: (stationId: string) => void;
  /** Open a station's menu where the player stands. */
  interact: (stationId: string) => void;
  /** Close the menu; the player stays where they are. */
  leave: () => void;
  setPlayer: (position: Vec2, yaw: number) => void;
  setHovered: (stationId: string | null) => void;
  setCrouching: (crouching: boolean) => void;
  setArMachine: (id: MachineId) => void;
  selectPart: (id: string | null) => void;
  selectTool: (id: string | null) => void;
};

/** Stations with a menu. The level terminal is used on its own screen, the
 *  progress wall is only read, and an empty bay has nothing to use. */
const MENU_KINDS: Station["kind"][] = ["machine", "warehouse", "toolbox", "toolcart"];
export const hasMenu = (station: Station | null) => !!station && MENU_KINDS.includes(station.kind);
const usable = hasMenu;

export const useWorldStore = create<WorldStore>((set, get) => ({
  view: { kind: "walk" },
  player: { position: WORLD.spawn.position, yaw: WORLD.spawn.yaw },
  travel: null,
  hovered: null,
  crouching: false,
  arMachineId: MACHINES[0].id,
  selectedPart: null,
  selectedTool: null,

  goTo: (stationId) => {
    if (!stationById(WORLD, stationId)) return;
    set({ travel: { stationId, seq: (get().travel?.seq ?? 0) + 1 } });
  },
  arrive: (stationId) => {
    const station = stationById(WORLD, stationId);
    if (!station) return;
    set({
      player: { position: station.stand.position, yaw: station.stand.yaw },
      view: usable(station) ? { kind: "station", id: stationId } : get().view,
    });
  },
  interact: (stationId) => {
    const station = stationById(WORLD, stationId);
    if (!usable(station)) return;
    const { view } = get();
    if (view.kind === "station" && view.id === stationId) return;
    set({ view: { kind: "station", id: stationId }, hovered: null, selectedPart: null, selectedTool: null });
  },
  leave: () => set({ view: { kind: "walk" }, selectedPart: null, selectedTool: null }),
  setPlayer: (position, yaw) => set({ player: { position, yaw } }),
  setHovered: (stationId) => {
    if (get().hovered !== stationId) set({ hovered: stationId });
  },
  setCrouching: (crouching) => set({ crouching }),
  setArMachine: (id) => set({ arMachineId: id, selectedTool: null }),
  selectPart: (id) => set({ selectedPart: id }),
  selectTool: (id) => set({ selectedTool: id }),
}));

/** The station whose menu is open, if any. */
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
