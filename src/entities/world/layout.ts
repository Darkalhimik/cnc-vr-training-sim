/**
 * The workshop the trainee walks: a lobby with the warehouse, the tool crib,
 * the level terminal and the progress wall, and through a door the shop hall,
 * its machines in bays either side of an aisle, each with its tool cart.
 *
 * The crib is the shop's — a CT40 tool fits every 40-taper mill — so it
 * stands in the lobby; what a machine has loaded is its own, so its cart
 * stands in its bay (docs/haas-ngc/tooling.md).
 *
 * The layout is computed, not drawn: bays come from the machine catalogue,
 * so a new machine takes the next bay and the hall grows a row when the bays
 * run out. Everything the scene, the desktop walker and the VR teleport need
 * — floors, walls, colliders, stations, where to stand — comes from here.
 *
 * Pure: metres, Y up, the world's floor at y = 0. The lobby's back wall is
 * at +z; walking in, you face −z, through the door into the hall.
 */
import type { MachineId, MachineInfo } from "@/entities/catalog/machines";

export type Vec2 = [number, number];
export type Rect = { min: Vec2; max: Vec2 };
/** A straight wall in plan, from `a` to `b`, with openings along it. */
export type Wall = { a: Vec2; b: Vec2; height: number; doors: { at: number; width: number; height: number }[] };

export type StationKind = "machine" | "warehouse" | "toolbox" | "toolcart" | "terminal" | "progress" | "bay";

export type Station = {
  id: string;
  kind: StationKind;
  label: string;
  /** Plan position of the station's origin (a machine's footprint centre). */
  position: Vec2;
  /** Turn about +Y; 0 means the station's front faces +z. */
  yaw: number;
  /** Where a trainee stands to use it, and which way they look. */
  stand: { position: Vec2; yaw: number };
  /** Plan rectangle nobody walks through. */
  footprint: Rect | null;
  machineId?: MachineId;
};

export type Room = { id: "lobby" | "hall"; label: string; floor: Rect; height: number };

/** What furnishes the rooms besides the stations. */
export type FurnitureKind =
  | "bench"
  | "desk"
  | "plant"
  | "workbench"
  | "rack"
  | "cart"
  | "pallet"
  | "bollard"
  | "extinguisher";

/** A piece of furniture: plan position of its footprint centre, its turn
 *  (front towards +z at 0), and its plan size before turning. Solid pieces
 *  are walked round; wall-hung ones are not in the way. */
export type Furniture = { kind: FurnitureKind; position: Vec2; yaw: number; size: Vec2; solid: boolean };

export type WorldLayout = {
  rooms: Room[];
  walls: Wall[];
  stations: Station[];
  spawn: { position: Vec2; yaw: number };
  /** Everything a walker collides with: wall segments and footprints. */
  colliders: { walls: [Vec2, Vec2][]; rects: Rect[] };
  /** The hall's aisle, for its floor marking. */
  aisle: Rect;
  /** The far end of the hall, past the last bays: bench work and stock. */
  service: Rect;
  furniture: Furniture[];
};

/** A machine bay: deep enough for the machine, its full pendant and boards. */
export const BAY = { width: 6, depth: 6 };
const AISLE = 3.5;
const HALL_HEIGHT = 6;
const LOBBY = { width: 12, depth: 9, height: 3.4 };
const DOOR = { width: 2.4, height: 2.6 };
/** Bays per side the hall is built for, however few machines there are. */
const MIN_COLUMNS = 3;
/** Depth of the service area at the hall's far end. */
const SERVICE_DEPTH = 4;
/** Standing distance in front of a station. */
const STAND = { machine: 2.4, warehouse: 1.9, toolbox: 1.7, toolcart: 1.3, terminal: 1.6, progress: 2.2 };
/** A machine's tool cart, in its bay: beside the machine on the door side
 *  (the pendant is on the other), level with its front. */
const CART = { size: [0.9, 0.55] as Vec2, forward: 1.25, side: -2.15 };

const rect = (cx: number, cz: number, w: number, d: number): Rect => ({
  min: [cx - w / 2, cz - d / 2],
  max: [cx + w / 2, cz + d / 2],
});

/** A point `distance` in front of something at `p` facing `yaw`. */
function inFront(p: Vec2, yaw: number, distance: number, side = 0): Vec2 {
  const [fx, fz] = [Math.sin(yaw), Math.cos(yaw)];
  const [rx, rz] = [Math.cos(yaw), -Math.sin(yaw)];
  return [p[0] + fx * distance + rx * side, p[1] + fz * distance + rz * side];
}

/** The yaw that looks from `from` towards `to`. */
const facing = (from: Vec2, to: Vec2) => Math.atan2(to[0] - from[0], to[1] - from[1]);

/** A footprint turned by `yaw` (quarter turns only), as an axis-aligned rect. */
function turned(position: Vec2, size: Vec2, yaw: number): Rect {
  const quarter = Math.round(yaw / (Math.PI / 2)) % 2 !== 0;
  const [w, d] = quarter ? [size[1], size[0]] : size;
  return rect(position[0], position[1], w, d);
}

export function buildWorld(machines: Pick<MachineInfo, "id" | "name" | "maker" | "footprint">[]): WorldLayout {
  // ------------------------------------------------------------ hall
  const columns = Math.max(MIN_COLUMNS, Math.ceil(machines.length / 2));
  const hallWidth = 2 * BAY.depth + AISLE;
  const hallLength = columns * BAY.width + 2 + SERVICE_DEPTH;
  const hall: Room = {
    id: "hall",
    label: "Shop",
    floor: { min: [-hallWidth / 2, -hallLength], max: [hallWidth / 2, 0] },
    height: HALL_HEIGHT,
  };
  const lobby: Room = {
    id: "lobby",
    label: "Lobby",
    floor: { min: [-LOBBY.width / 2, 0], max: [LOBBY.width / 2, LOBBY.depth] },
    height: LOBBY.height,
  };

  // Bays alternate west, east, down the hall; a machine faces the aisle.
  const stations: Station[] = [];
  for (let i = 0; i < columns * 2; i++) {
    const column = Math.floor(i / 2);
    const west = i % 2 === 0;
    const position: Vec2 = [(west ? -1 : 1) * (AISLE / 2 + BAY.depth / 2), -1 - (column + 0.5) * BAY.width];
    const yaw = west ? Math.PI / 2 : -Math.PI / 2;
    const machine = machines[i];
    // Operators stand a little to the pendant's side of the door.
    const stand = inFront(position, yaw, STAND.machine, 0.4);
    stations.push(
      machine
        ? {
            id: machine.id,
            kind: "machine",
            label: `${machine.maker} ${machine.name}`,
            position,
            yaw,
            stand: { position: stand, yaw: facing(stand, inFront(position, yaw, 0, 0.4)) },
            footprint: turned(position, machine.footprint, yaw),
            machineId: machine.id,
          }
        : {
            id: `bay-${i + 1}`,
            kind: "bay",
            label: `Bay ${i + 1}`,
            position,
            yaw,
            stand: { position: stand, yaw: facing(stand, position) },
            footprint: null,
          },
    );
    if (machine) {
      const cart = inFront(position, yaw, CART.forward, CART.side);
      const cartStand = inFront(cart, yaw, STAND.toolcart);
      stations.push({
        id: `toolcart-${machine.id}`,
        kind: "toolcart",
        label: `${machine.name} tool cart`,
        position: cart,
        yaw,
        stand: { position: cartStand, yaw: facing(cartStand, cart) },
        footprint: turned(cart, CART.size, yaw),
        machineId: machine.id,
      });
    }
  }

  // ------------------------------------------------------------ lobby
  // The warehouse: for now one cabinet of parts against the west wall; the
  // tool crib beside it, nearer the shop door.
  const warehouse: Vec2 = [-LOBBY.width / 2 + 0.35, 4.6];
  const toolbox: Vec2 = [-LOBBY.width / 2 + 0.33, 2.2];
  const terminal: Vec2 = [LOBBY.width / 2 - 0.45, 4.6];
  const progress: Vec2 = [-3.6, 0.12];
  stations.push(
    {
      id: "warehouse",
      kind: "warehouse",
      label: "Warehouse",
      position: warehouse,
      yaw: Math.PI / 2,
      stand: { position: inFront(warehouse, Math.PI / 2, STAND.warehouse), yaw: -Math.PI / 2 },
      footprint: turned(warehouse, [1.2, 0.5], Math.PI / 2),
    },
    {
      id: "toolbox",
      kind: "toolbox",
      label: "Tool crib",
      position: toolbox,
      yaw: Math.PI / 2,
      stand: { position: inFront(toolbox, Math.PI / 2, STAND.toolbox), yaw: -Math.PI / 2 },
      footprint: turned(toolbox, [1.36, 0.46], Math.PI / 2),
    },
    {
      id: "terminal",
      kind: "terminal",
      label: "Level terminal",
      position: terminal,
      yaw: -Math.PI / 2,
      stand: { position: inFront(terminal, -Math.PI / 2, STAND.terminal), yaw: Math.PI / 2 },
      footprint: turned(terminal, [1.4, 0.6], -Math.PI / 2),
    },
    {
      id: "progress",
      kind: "progress",
      label: "Progress wall",
      position: progress,
      yaw: 0,
      stand: { position: inFront(progress, 0, STAND.progress), yaw: Math.PI },
      footprint: null,
    },
  );

  // ------------------------------------------------------------ walls
  const [lx0, lz0] = lobby.floor.min;
  const [lx1, lz1] = lobby.floor.max;
  const [hx0, hz0] = hall.floor.min;
  const [hx1] = hall.floor.max;
  const door = { at: 0, width: DOOR.width, height: DOOR.height };
  const walls: Wall[] = [
    // Lobby: back, sides, and the wall it shares with the hall, with the door.
    { a: [lx0, lz1], b: [lx1, lz1], height: LOBBY.height, doors: [] },
    { a: [lx0, lz0], b: [lx0, lz1], height: LOBBY.height, doors: [] },
    { a: [lx1, lz0], b: [lx1, lz1], height: LOBBY.height, doors: [] },
    // The hall's south wall runs the hall's full width; the door is at x = 0.
    { a: [hx0, 0], b: [hx1, 0], height: HALL_HEIGHT, doors: [{ ...door, at: -hx0 }] },
    { a: [hx0, hz0], b: [hx0, 0], height: HALL_HEIGHT, doors: [] },
    { a: [hx1, hz0], b: [hx1, 0], height: HALL_HEIGHT, doors: [] },
    { a: [hx0, hz0], b: [hx1, hz0], height: HALL_HEIGHT, doors: [] },
  ];

  // A wall collides along its length, except where a door opens.
  const segments: [Vec2, Vec2][] = [];
  for (const w of walls) {
    const length = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
    const dir: Vec2 = [(w.b[0] - w.a[0]) / length, (w.b[1] - w.a[1]) / length];
    let from = 0;
    for (const d of [...w.doors].sort((p, q) => p.at - q.at)) {
      segments.push([w.a, [w.a[0] + dir[0] * (d.at - d.width / 2), w.a[1] + dir[1] * (d.at - d.width / 2)]]);
      from = d.at + d.width / 2;
    }
    segments.push([[w.a[0] + dir[0] * from, w.a[1] + dir[1] * from], w.b]);
  }

  // ------------------------------------------------------------ furniture
  // Placed from the rooms' edges, so a longer hall carries its service area
  // along with it. Walking lines stay clear: the lobby's middle, the door,
  // the aisle and the middle of the service area.
  const service: Rect = { min: [hx0, hz0], max: [hx1, hz0 + SERVICE_DEPTH] };
  const furniture: Furniture[] = [
    // Lobby: a bench by the entrance, a briefing desk by the shop door, plants.
    { kind: "bench", position: [-2.6, lz1 - 0.45], yaw: Math.PI, size: [1.8, 0.5], solid: true },
    { kind: "desk", position: [3.7, 1.25], yaw: 0, size: [2.1, 0.8], solid: true },
    { kind: "plant", position: [lx0 + 0.55, lz1 - 0.55], yaw: 0, size: [0.6, 0.6], solid: true },
    { kind: "plant", position: [lx1 - 0.55, lz1 - 0.55], yaw: 0, size: [0.6, 0.6], solid: true },
    { kind: "plant", position: [1.9, 0.5], yaw: 0, size: [0.5, 0.5], solid: true },
    { kind: "extinguisher", position: [-1.75, 0.16], yaw: 0, size: [0.25, 0.2], solid: false },
    // Hall: bollards either side of the door, an extinguisher by it.
    { kind: "bollard", position: [-1.55, -0.45], yaw: 0, size: [0.2, 0.2], solid: true },
    { kind: "bollard", position: [1.55, -0.45], yaw: 0, size: [0.2, 0.2], solid: true },
    { kind: "extinguisher", position: [1.9, -0.16], yaw: Math.PI, size: [0.25, 0.2], solid: false },
    // Service area: workbench and cart west, stock rack and a pallet east.
    { kind: "workbench", position: [-4.6, hz0 + 0.55], yaw: 0, size: [2.2, 0.8], solid: true },
    { kind: "cart", position: [-6.7, hz0 + 2.1], yaw: Math.PI / 2, size: [0.9, 0.55], solid: true },
    { kind: "rack", position: [4.6, hz0 + 0.6], yaw: 0, size: [2.6, 0.9], solid: true },
    { kind: "pallet", position: [1.9, hz0 + 0.75], yaw: 0, size: [1.2, 1.0], solid: true },
    { kind: "extinguisher", position: [hx1 - 0.16, hz0 + 2.4], yaw: -Math.PI / 2, size: [0.25, 0.2], solid: false },
  ];

  return {
    rooms: [lobby, hall],
    walls,
    stations,
    spawn: { position: [0, LOBBY.depth - 1.6], yaw: Math.PI },
    colliders: {
      walls: segments,
      rects: [
        ...stations.flatMap((s) => (s.footprint ? [s.footprint] : [])),
        ...furniture.filter((f) => f.solid).map((f) => turned(f.position, f.size, f.yaw)),
      ],
    },
    aisle: { min: [-AISLE / 2, service.max[1]], max: [AISLE / 2, -0.5] },
    service,
    furniture,
  };
}

export const stationById = (layout: WorldLayout, id: string) => layout.stations.find((s) => s.id === id) ?? null;

/**
 * Moves a walker of radius `r` from `from` by `step`, sliding along whatever
 * it meets rather than stopping dead — the desktop walk and VR thumbstick
 * movement both use it.
 */
export function slide(layout: WorldLayout, from: Vec2, step: Vec2, r = 0.3): Vec2 {
  const blocked = (p: Vec2) =>
    layout.colliders.walls.some(([a, b]) => distanceToSegment(p, a, b) < r) ||
    layout.colliders.rects.some((q) => p[0] > q.min[0] - r && p[0] < q.max[0] + r && p[1] > q.min[1] - r && p[1] < q.max[1] + r);
  const full: Vec2 = [from[0] + step[0], from[1] + step[1]];
  if (!blocked(full)) return full;
  const alongX: Vec2 = [from[0] + step[0], from[1]];
  if (!blocked(alongX)) return alongX;
  const alongZ: Vec2 = [from[0], from[1] + step[1]];
  if (!blocked(alongZ)) return alongZ;
  return from;
}

function distanceToSegment(p: Vec2, a: Vec2, b: Vec2) {
  const [dx, dz] = [b[0] - a[0], b[1] - a[1]];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz));
}

/** Which room a plan point is in, if any. */
export const roomAt = (layout: WorldLayout, p: Vec2) =>
  layout.rooms.find((r) => p[0] >= r.floor.min[0] && p[0] <= r.floor.max[0] && p[1] >= r.floor.min[1] && p[1] <= r.floor.max[1]) ?? null;
