"use client";

import { useEffect, useMemo } from "react";
import { TeleportTarget } from "@react-three/xr";
import * as THREE from "three";
import type { Rect, Room, Station, Wall, WorldLayout } from "@/entities/world/layout";
import { buildFurniture } from "./furniture";
import { StaticBuilder } from "./static-builder";
import { WallClock } from "./wall-clock";
import {
  createMaterials,
  disposeMaterials,
  hallFloorTexture,
  lobbyFloorTexture,
  signAtlas,
  signUv,
  type MaterialKey,
  type SignSpec,
} from "./world-materials";

/**
 * The workshop's shell, built from the layout: floors, walls with their door
 * openings, ceilings and the hall's roof, lights, columns, floor paint,
 * signage, furniture and soft contact shadows. Primitives and painted
 * textures only — nothing to rebuild when a bay is added — merged into one
 * mesh per material, because a headset renders the room twice a frame.
 * Only the floors stay separate: they are what the teleport arc lands on.
 */
const WALL_T = 0.2;
const noRaycast = () => {};

/** Draw order for what is see-through: shadows on the floor, then glass, then glows. */
const RENDER_ORDER: Partial<Record<MaterialKey, number>> = { shade: 1, glass: 2, glow: 3 };

/** Signs, deduplicated: each spec gets one region of the atlas. */
class SignBook {
  specs: SignSpec[] = [];
  private seen = new Map<string, number>();
  index(spec: SignSpec) {
    const key = JSON.stringify(spec);
    let i = this.seen.get(key);
    if (i === undefined) {
      i = this.specs.length;
      this.specs.push(spec);
      this.seen.set(key, i);
    }
    return i;
  }
}

type Ctx = { b: StaticBuilder; signs: SignBook };

/** A sign plate, `width` wide and 4:1, its face towards the frame's +z. */
function sign(c: Ctx, spec: SignSpec, width: number, position: [number, number, number], yaw: number) {
  const i = c.signs.index(spec);
  c.b.frame(position, yaw, () => {
    c.b.box("black", [width + 0.03, width / 4 + 0.03, 0.02], [0, 0, -0.012]);
    c.b.plane("sign", [width, width / 4], [0, 0, 0], [0, 0, 0], signUv(i));
  });
}

/**
 * Which side of a wall faces which room, as signs along the wall's left
 * normal (+z in its own frame, which turns −yaw from the plan direction).
 */
function wallSides(w: Wall, lobby: Room): { lobby: -1 | 0 | 1; hall: -1 | 0 | 1 } {
  const length = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
  // The wall frame turns by −yaw about +Y; its +z is then (−dz, dx)/length.
  const n: [number, number] = [-(w.b[1] - w.a[1]) / length, (w.b[0] - w.a[0]) / length];
  const mid: [number, number] = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
  const inLobby = (p: [number, number]) =>
    p[0] > lobby.floor.min[0] && p[0] < lobby.floor.max[0] && p[1] > lobby.floor.min[1] && p[1] < lobby.floor.max[1];
  const at = (s: number): [number, number] => [mid[0] + n[0] * s * 0.5, mid[1] + n[1] * s * 0.5];
  const lobbySide = inLobby(at(1)) ? 1 : inLobby(at(-1)) ? -1 : 0;
  if (w.height === lobby.height) return { lobby: lobbySide || 1, hall: 0 };
  return { lobby: lobbySide, hall: lobbySide === 0 ? 0 : lobbySide === 1 ? -1 : 1 };
}

/**
 * One wall: its pieces between doors, two-toned — wood wainscot in the lobby,
 * a dark dado in the hall — with a skirting board, and a frame round each door.
 * A wall between the rooms is two half-thick skins, one for each side.
 */
function wall(c: Ctx, w: Wall, lobby: Room) {
  const { b } = c;
  const length = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
  const yaw = Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0]);
  const sides = wallSides(w, lobby);
  const pieces: { from: number; to: number; y0: number; y1: number }[] = [];
  let from = 0;
  for (const d of [...w.doors].sort((p, q) => p.at - q.at)) {
    pieces.push({ from, to: d.at - d.width / 2, y0: 0, y1: w.height });
    pieces.push({ from: d.at - d.width / 2, to: d.at + d.width / 2, y0: d.height, y1: w.height });
    from = d.at + d.width / 2;
  }
  pieces.push({ from, to: length, y0: 0, y1: w.height });

  // An outer wall's inner face is the side its room is on.
  const own: -1 | 1 = (sides.lobby || -sides.hall || 1) as -1 | 1;
  const skins: { side: -1 | 1; room: "lobby" | "hall" }[] =
    sides.lobby && sides.hall
      ? [
          { side: sides.lobby as -1 | 1, room: "lobby" },
          { side: sides.hall as -1 | 1, room: "hall" },
        ]
      : [{ side: own, room: w.height === lobby.height ? "lobby" : "hall" }];
  const split = skins.length > 1;

  b.frame([w.a[0], 0, w.a[1]], -yaw, () => {
    for (const p of pieces) {
      const len = p.to - p.from;
      const cx = (p.from + p.to) / 2;
      for (const skin of skins) {
        const t = split ? WALL_T / 2 : WALL_T;
        const z = split ? (skin.side * WALL_T) / 4 : 0;
        const face = z + (skin.side * t) / 2;
        const lobbySkin = skin.room === "lobby";
        // Inside the lobby the shared wall shows only up to its ceiling.
        const top = lobbySkin ? Math.min(p.y1, lobby.height) : p.y1;
        if (top <= p.y0) continue;
        const dado = lobbySkin ? 1.0 : 1.2;
        const upper: MaterialKey = lobbySkin ? "wallLobby" : "wallHall";
        const lower: MaterialKey = lobbySkin ? "wood" : "wallLow";
        if (p.y0 < dado) {
          b.box(lower, [len, dado - p.y0, t], [cx, (p.y0 + dado) / 2, z]);
          b.box(upper, [len, top - dado, t], [cx, (dado + top) / 2, z]);
          // Skirting, and the rail that caps the wainscot.
          b.box("skirting", [len, 0.1, 0.02], [cx, 0.05, face + skin.side * 0.01]);
          b.box(lobbySkin ? "steel" : "skirting", [len, 0.03, 0.02], [cx, dado, face + skin.side * 0.01]);
        } else {
          b.box(upper, [len, top - p.y0, t], [cx, (p.y0 + top) / 2, z]);
        }
      }
    }
    for (const d of w.doors) {
      for (const s of [-1, 1]) b.box("steel", [0.08, d.height, WALL_T + 0.06], [d.at + (s * (d.width + 0.08)) / 2, d.height / 2, 0]);
      b.box("steel", [d.width + 0.16, 0.08, WALL_T + 0.06], [d.at, d.height + 0.04, 0]);
    }
  });
}

/** The lobby's entrance: a glazed double door in the back wall, shut. */
function entrance(c: Ctx, lobby: Room) {
  const { b } = c;
  const z = lobby.floor.max[1] - WALL_T / 2 - 0.01;
  b.frame([0, 0, z], Math.PI, () => {
    b.box("steel", [2.2, 0.08, 0.08], [0, 2.44, 0]);
    for (const x of [-1.06, 0, 1.06]) b.box("steel", [0.06, 2.4, 0.08], [x, 1.2, 0]);
    for (const x of [-0.53, 0.53]) {
      b.plane("glass", [1.0, 2.36], [x, 1.2, 0]);
      b.box("steelLight", [0.02, 0.3, 0.04], [x + (x < 0 ? 0.42 : -0.42), 1.05, 0.04]);
    }
    b.box("black", [2.1, 0.012, 0.6], [0, 0.006, 0.35]);
  });
}

function lobbyCeiling(c: Ctx, room: Room) {
  const { b } = c;
  const [x0, z0] = room.floor.min;
  const [x1, z1] = room.floor.max;
  b.plane("ceilingLobby", [x1 - x0, z1 - z0], [(x0 + x1) / 2, room.height, (z0 + z1) / 2], [Math.PI / 2, 0, 0]);
  for (const x of [-3.5, 0, 3.5]) {
    for (const z of [2.2, 6.2]) {
      b.box("steel", [1.28, 0.03, 1.28], [x, room.height - 0.015, z]);
      b.plane("lightWarm", [1.2, 1.2], [x, room.height - 0.032, z], [Math.PI / 2, 0, 0]);
    }
  }
}

/** Column lines along the hall's walls: between bays, and at the far end. */
function hallColumns(room: Room) {
  const [, z0] = room.floor.min;
  const zs: number[] = [];
  for (let z = -1; z > z0 + 1; z -= 6) zs.push(z);
  zs.push(z0 + 0.3);
  return zs;
}

function hallStructure(c: Ctx, room: Room) {
  const { b } = c;
  const [x0, z0] = room.floor.min;
  const [x1, z1] = room.floor.max;
  const h = room.height;
  const width = x1 - x0;
  const length = z1 - z0;
  b.plane("ceilingHall", [width, length], [(x0 + x1) / 2, h, (z0 + z1) / 2], [Math.PI / 2, 0, 0]);

  for (const z of hallColumns(room)) {
    for (const x of [x0 + 0.28, x1 - 0.28]) {
      b.box("steelLight", [0.35, h, 0.35], [x, h / 2, z]);
      // Hazard banding round the foot of each column.
      for (let i = 0; i < 6; i++) b.box(i % 2 ? "black" : "safety", [0.37, 0.2, 0.37], [x, 0.1 + i * 0.2, z]);
    }
    // A roof beam across, on the columns.
    b.box("beam", [width, 0.45, 0.22], [(x0 + x1) / 2, h - 0.25, z]);
  }
  // Purlins along the hall, on the beams.
  for (const x of [-5.6, -2.0, 2.0, 5.6]) b.box("beam", [0.12, 0.16, length], [x, h - 0.1, (z0 + z1) / 2]);

  // High-bay lights: over each line of bays and down the aisle, with the
  // glow round them that a bright lamp has against a dark roof.
  for (let z = -4; z > z0 + 1; z -= 6) {
    for (const x of [-4.75, 0, 4.75]) {
      const y = h - 1.5;
      b.cylinder("steel", 0.01, 1.2, [x, y + 0.7, z], { segments: 6 });
      b.cylinder("housing", 0.32, 0.26, [x, y + 0.08, z], { top: 0.14, segments: 20 });
      b.plane("lightCool", [0.5, 0.5], [x, y - 0.06, z], [Math.PI / 2, 0, 0]);
      b.plane("glow", [2.4, 2.4], [x, y - 0.08, z], [Math.PI / 2, 0, 0]);
    }
  }
}

/** A painted line on the floor. */
function floorLine(c: Ctx, key: MaterialKey, from: [number, number], to: [number, number], width: number) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const yaw = Math.atan2(to[1] - from[1], to[0] - from[0]);
  c.b.floorQuad(key, [length, width], [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2], -yaw);
}

function rectLines(c: Ctx, key: MaterialKey, rect: Rect, inset: number, width: number) {
  const [x0, z0] = [rect.min[0] + inset, rect.min[1] + inset];
  const [x1, z1] = [rect.max[0] - inset, rect.max[1] - inset];
  floorLine(c, key, [x0, z0], [x1, z0], width);
  floorLine(c, key, [x0, z1], [x1, z1], width);
  floorLine(c, key, [x0, z0], [x0, z1], width);
  floorLine(c, key, [x1, z0], [x1, z1], width);
}

/** Diagonal hazard hatching over a rectangle. */
function hatch(c: Ctx, rect: Rect, spacing = 0.3) {
  const [x0, z0] = rect.min;
  const [x1, z1] = rect.max;
  const w = x1 - x0;
  const d = z1 - z0;
  // 45° stripes, each cut where it leaves the rectangle.
  for (let s = -d; s < w; s += spacing) {
    const a: [number, number] = [x0 + Math.max(0, s), z0 + Math.max(0, -s)];
    const len = Math.min(w - Math.max(0, s), d - Math.max(0, -s));
    if (len <= 0.05) continue;
    floorLine(c, "safety", a, [a[0] + len, a[1] + len], 0.07);
  }
}

/** A bay: its outline and its sign on the wall behind it. An empty bay is
 *  hatched along its front — held for the next machine. */
function bay(c: Ctx, station: Station, hallHeight: number) {
  const [cx, cz] = station.position;
  const out = Math.sign(cx);
  rectLines(c, "safety", { min: [cx - 3, cz - 3], max: [cx + 3, cz + 3] }, 0.15, 0.1);
  const spec: SignSpec =
    station.kind === "machine"
      ? { kind: "label", lines: [station.label, "Machining bay"] }
      : { kind: "label", lines: [station.label, "Reserved for the next machine"] };
  sign(c, spec, 2.4, [cx + out * 2.86, Math.min(4.2, hallHeight - 1.4), cz], out < 0 ? Math.PI / 2 : -Math.PI / 2);
  if (station.kind === "bay") {
    const front = cx - out * 2.85;
    const back = cx - out * 2.15;
    hatch(c, { min: [Math.min(front, back), cz - 2.7], max: [Math.max(front, back), cz + 2.7] }, 0.42);
  }
}

/** A soft contact shadow: a feathered dark quad on the floor. */
function shade(c: Ctx, rect: Rect, grow: number) {
  const w = rect.max[0] - rect.min[0] + grow * 2;
  const d = rect.max[1] - rect.min[1] + grow * 2;
  c.b.floorQuad("shade", [w, d], [(rect.min[0] + rect.max[0]) / 2, (rect.min[1] + rect.max[1]) / 2], 0, 0.006);
}

function scenery(layout: WorldLayout) {
  const lobby = layout.rooms.find((r) => r.id === "lobby")!;
  const hall = layout.rooms.find((r) => r.id === "hall")!;
  const b = new StaticBuilder();
  const c: Ctx = { b, signs: new SignBook() };

  for (const w of layout.walls) wall(c, w, lobby);
  entrance(c, lobby);
  lobbyCeiling(c, lobby);
  hallStructure(c, hall);

  // Floor paint: the walkway, chevrons into the hall, the bays, the
  // keep-clear behind the door, the service area.
  const [ax0, az0] = layout.aisle.min;
  const [ax1, az1] = layout.aisle.max;
  floorLine(c, "walkway", [ax0, az0], [ax0, az1], 0.12);
  floorLine(c, "walkway", [ax1, az0], [ax1, az1], 0.12);
  for (let z = az1 - 2; z > az0 + 1; z -= 6) {
    for (const s of [-1, 1]) floorLine(c, "paint", [0, z - 0.3], [s * 0.35, z + 0.05], 0.09);
  }
  for (const s of layout.stations.filter((s) => s.kind === "machine" || s.kind === "bay")) bay(c, s, hall.height);
  hatch(c, { min: [-1.15, -1.0], max: [1.15, -0.2] }, 0.25);
  rectLines(c, "safety", layout.service, 0.25, 0.1);

  // Signs: over the door both ways, the shop's rules beside it on the hall
  // side, the briefing desk, the fire points.
  sign(c, { kind: "label", lines: ["Shop", "Machining bays"] }, 2.2, [0, 2.95, WALL_T / 2 + 0.02], 0);
  sign(c, { kind: "label", lines: ["Lobby", "Warehouse · Levels"] }, 2.2, [0, 3.1, -WALL_T / 2 - 0.02], Math.PI);
  const rules: SignSpec[] = [
    { kind: "mandatory", text: "Safety glasses\nmust be worn", icon: "eyes" },
    { kind: "mandatory", text: "Hearing protection\nin this area", icon: "ears" },
    { kind: "mandatory", text: "Safety footwear\nmust be worn", icon: "boots" },
  ];
  rules.forEach((spec, i) => sign(c, spec, 0.9, [-2.4 - i * 1.05, 1.75, -WALL_T / 2 - 0.02], Math.PI));
  sign(c, { kind: "warning", text: "Moving machinery\nKeep doors shut" }, 0.9, [2.6, 1.75, -WALL_T / 2 - 0.02], Math.PI);
  sign(c, { kind: "label", lines: ["Briefing", "Ask here before you start"] }, 1.6, [3.7, 2.05, WALL_T / 2 + 0.02], 0);
  for (const f of layout.furniture.filter((f) => f.kind === "extinguisher")) {
    sign(c, { kind: "fire", text: "Fire\nextinguisher" }, 0.6, [f.position[0], 1.62, f.position[1]], f.yaw);
  }

  buildFurniture(b, layout.furniture);

  // Contact shadows under whatever stands on a floor.
  for (const s of layout.stations) {
    if (s.kind === "machine" && s.footprint) shade(c, s.footprint, 0.45);
    if ((s.kind === "warehouse" || s.kind === "toolbox" || s.kind === "toolcart" || s.kind === "terminal") && s.footprint) shade(c, s.footprint, 0.3);
  }
  for (const f of layout.furniture.filter((f) => f.solid)) {
    const quarter = Math.round(f.yaw / (Math.PI / 2)) % 2 !== 0;
    const [w, d] = quarter ? [f.size[1], f.size[0]] : f.size;
    shade(c, { min: [f.position[0] - w / 2, f.position[1] - d / 2], max: [f.position[0] + w / 2, f.position[1] + d / 2] }, 0.2);
  }
  for (const z of hallColumns(hall)) {
    for (const x of [hall.floor.min[0] + 0.28, hall.floor.max[0] - 0.28]) {
      shade(c, { min: [x - 0.18, z - 0.18], max: [x + 0.18, z + 0.18] }, 0.3);
    }
  }

  return { meshes: b.build(), specs: c.signs.specs };
}

// ---------------------------------------------------------------- floors

function Floor({ room }: { room: Room }) {
  const [x0, z0] = room.floor.min;
  const [x1, z1] = room.floor.max;
  const [w, d] = [x1 - x0, z1 - z0];
  const lobby = room.id === "lobby";
  const material = useMemo(() => {
    const map = lobby ? lobbyFloorTexture() : hallFloorTexture();
    // Lobby: 600 mm tiles, four to a texture; hall: 3 m slabs, two to one.
    map.repeat.set(w / (lobby ? 2.4 : 6), d / (lobby ? 2.4 : 6));
    return new THREE.MeshStandardMaterial({ map, roughness: lobby ? 0.42 : 0.3, metalness: 0 });
  }, [lobby, w, d]);
  useEffect(
    () => () => {
      material.map?.dispose();
      material.dispose();
    },
    [material],
  );
  return (
    <mesh position={[(x0 + x1) / 2, 0, (z0 + z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} name={`Floor_${room.id}`} material={material}>
      <planeGeometry args={[w, d]} />
    </mesh>
  );
}

/** Everything that is not a station: the rooms and what is in and on them.
 *  With `onTeleport`, the floors are where a headset's teleport arc lands. */
export function Rooms({ layout, onTeleport }: { layout: WorldLayout; onTeleport?: (point: THREE.Vector3) => void }) {
  const built = useMemo(() => {
    const { meshes, specs } = scenery(layout);
    const atlas = signAtlas(specs);
    return { meshes, atlas, materials: createMaterials(atlas) };
  }, [layout]);

  // The signs were painted with whatever face had loaded; paint them again
  // with the real one.
  useEffect(() => {
    let live = true;
    void document.fonts?.ready.then(() => live && built.atlas.repaint());
    return () => {
      live = false;
      for (const m of built.meshes) m.geometry.dispose();
      disposeMaterials(built.materials);
    };
  }, [built]);

  const lobby = layout.rooms.find((r) => r.id === "lobby")!;
  return (
    <group>
      {layout.rooms.map((r) =>
        onTeleport ? (
          <TeleportTarget key={r.id} onTeleport={onTeleport}>
            <Floor room={r} />
          </TeleportTarget>
        ) : (
          <Floor key={r.id} room={r} />
        ),
      )}
      {built.meshes.map((m) => (
        <mesh
          key={m.key}
          geometry={m.geometry}
          material={built.materials[m.key]}
          renderOrder={RENDER_ORDER[m.key] ?? 0}
          raycast={noRaycast}
        />
      ))}
      <WallClock position={[5.0, 2.7, WALL_T / 2 + 0.03]} yaw={0} />
      <WallClock position={[-3.6, lobby.height + 0.9, -WALL_T / 2 - 0.03]} yaw={Math.PI} />
    </group>
  );
}
