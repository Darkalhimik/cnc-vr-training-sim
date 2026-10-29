"use client";

import { useEffect, useMemo, useState } from "react";
import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { MACHINES, type MachineId } from "@/entities/catalog/machines";
import { loadoutTools, type LibraryTool } from "@/entities/part/tool-library";
import { CRIB } from "@/entities/tooling/catalog";
import { loadoutFor, useToolingStore } from "@/features/tooling/tooling-store";
import { createToolObject, disposeToolObject } from "@/widgets/vr-scene/tool-body";

/**
 * The tool crib in the lobby and a machine's tool cart in its bay. Tools
 * stand as they are stored: taper down in a rack, the flange on the rack's
 * face, the cutter up. Frames: metres, Y up, front towards +z, on the floor.
 */

const STEEL = { color: "#454c55", metalness: 0.3, roughness: 0.55 } as const;
const RACK = { color: "#2f4f78", metalness: 0, roughness: 0.6 } as const;
const SOCKET = { color: "#14181d", metalness: 0, roughness: 0.9 } as const;
/** The rack's face above its shelf: high enough for a taper and pull stud. */
const RACK_HEIGHT = 0.12;
const RACK_T = 0.02;

type Slot = { tool: LibraryTool; at: THREE.Vector3 };

/** What stands in a crib place whose tool is out in a machine: its outline,
 *  pale and see-through, so the empty place still says what belongs there. */
const GHOST = new THREE.MeshStandardMaterial({
  color: "#a9c4dd",
  metalness: 0,
  roughness: 0.6,
  transparent: true,
  opacity: 0.22,
  depthWrite: false,
});

/** One stored tool: picked by a click, lifted and named when hovered or
 *  chosen; a ghost of itself when it is out in a machine. */
function StoredTool({
  slot,
  selected,
  label,
  ghost = false,
  onSelect,
}: {
  slot: Slot;
  selected: boolean;
  label: string;
  ghost?: boolean;
  onSelect?: (assembly: string) => void;
}) {
  const object = useMemo(() => createToolObject(slot.tool, { pickable: true }), [slot.tool]);
  useEffect(() => () => disposeToolObject(object), [object]);
  useEffect(() => {
    object.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.userData.material ??= o.material;
      o.material = ghost ? GHOST : o.userData.material;
    });
  }, [object, ghost]);
  const [hovered, setHovered] = useState(false);
  const lift = selected ? 0.05 : hovered ? 0.015 : 0;
  const height = (slot.tool.length + 16) * 0.001;
  return (
    <group position={[slot.at.x, slot.at.y + lift, slot.at.z]}>
      {/* Upside down: tip up, taper into the rack. */}
      <primitive
        object={object}
        rotation={[Math.PI, 0, 0]}
        onClick={
          onSelect
            ? (e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                onSelect(slot.tool.assembly);
              }
            : undefined
        }
        onPointerOver={
          onSelect
            ? (e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                setHovered(true);
              }
            : undefined
        }
        onPointerOut={onSelect ? () => setHovered(false) : undefined}
      />
      {(hovered || selected) && (
        <Html position={[0, height + 0.02, 0]} center style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
          <div className="whitespace-nowrap rounded border bg-background/90 px-1.5 py-0.5 text-[10px] shadow-sm">{label}</div>
        </Html>
      )}
    </group>
  );
}

/** A rack: a blue plate on a shelf with a dark socket for each place. */
function Rack({ y, z, width, depth, sockets }: { y: number; z: number; width: number; depth: number; sockets: THREE.Vector3[] }) {
  return (
    <group>
      <mesh position={[0, y + RACK_HEIGHT - RACK_T / 2, z]}>
        <boxGeometry args={[width, RACK_T, depth]} />
        <meshStandardMaterial {...RACK} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * width) / 2 - side * 0.02, y + (RACK_HEIGHT - RACK_T) / 2, z]}>
          <boxGeometry args={[0.02, RACK_HEIGHT - RACK_T, depth]} />
          <meshStandardMaterial {...RACK} />
        </mesh>
      ))}
      {sockets.map((p, i) => (
        <mesh key={i} position={[p.x, y + RACK_HEIGHT + 0.0005, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.024, 24]} />
          <meshStandardMaterial {...SOCKET} />
        </mesh>
      ))}
    </group>
  );
}

// --------------------------------------------------------------- the crib

const CRIB_SIZE = { width: 1.36, depth: 0.46, height: 1.95 };
const CRIB_TIERS = [0.12, 0.52, 0.92, 1.32];
const CRIB_PER_TIER = 6;
const CRIB_PITCH = 0.2;

/** Where each tool of the crib stands, in the crib's frame. */
const cribSlots: Slot[] = loadoutTools(CRIB.map((t, i) => ({ number: i + 1, assembly: t.id }))).map((tool, i) => {
  const tier = Math.floor(i / CRIB_PER_TIER);
  const col = i % CRIB_PER_TIER;
  return {
    tool,
    at: new THREE.Vector3((col - (CRIB_PER_TIER - 1) / 2) * CRIB_PITCH, CRIB_TIERS[tier] + RACK_HEIGHT, 0.02),
  };
});

/** A crib tool's place, in the crib's frame: for the camera to come to. */
export const cribSlot = (assembly: string) => cribSlots.find((s) => s.tool.assembly === assembly)?.at ?? null;

/**
 * The shop's tool crib: a steel cabinet with four racks, a place for every
 * tool the trainer has. A tool loaded in a machine is out of its place and
 * shows there as a pale ghost; the rest stand in the rack. A click on either
 * picks it.
 */
export function ToolCrib({ selected, onSelect }: { selected: string | null; onSelect?: (assembly: string) => void }) {
  const { width, depth, height } = CRIB_SIZE;
  // Tools loaded in a machine are out of the crib: shown as ghosts, named
  // with the machine and tool number they are in.
  const loadouts = useToolingStore((s) => s.loadouts);
  const out = useMemo(() => {
    const where = new Map<string, string[]>();
    for (const m of MACHINES) {
      for (const slot of loadoutFor(m.id, loadouts)) where.set(slot.assembly, [...(where.get(slot.assembly) ?? []), `${m.name} T${slot.number}`]);
    }
    return where;
  }, [loadouts]);
  const inner = width - 0.06;
  const sockets = useMemo(
    () => Array.from({ length: CRIB_PER_TIER }, (_, col) => new THREE.Vector3((col - (CRIB_PER_TIER - 1) / 2) * CRIB_PITCH, 0, 0.02)),
    [],
  );
  return (
    <group>
      {/* Carcass: sides, back, top and plinth, none of them sharing a face. */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * (width - 0.03)) / 2, height / 2, 0]}>
          <boxGeometry args={[0.03, height, depth]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
      ))}
      {/* A light back panel: the crib has no lamps of its own (each would
          cost every pixel of the workshop), so the tools stand against it. */}
      <mesh position={[0, height / 2, -depth / 2 + 0.01]}>
        <boxGeometry args={[inner - 0.002, height - 0.04, 0.02]} />
        <meshStandardMaterial color="#8a929b" metalness={0.1} roughness={0.8} />
      </mesh>
      <mesh position={[0, height - 0.02, 0]}>
        <boxGeometry args={[width, 0.04, depth]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <mesh position={[0, 0.05, -0.012]}>
        <boxGeometry args={[inner - 0.002, 0.097, depth - 0.04]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      {CRIB_TIERS.map((y) => (
        <group key={y}>
          <mesh position={[0, y - 0.01, 0]}>
            <boxGeometry args={[inner - 0.002, 0.02, depth - 0.02]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
          <Rack y={y} z={0.02} width={inner - 0.04} depth={0.26} sockets={sockets} />
          {/* LED strip under the shelf above: a glow, not a light. */}
          <mesh position={[0, y + 0.37, depth / 2 - 0.03]}>
            <boxGeometry args={[inner - 0.04, 0.006, 0.012]} />
            <meshStandardMaterial color="#fff6e5" emissive="#fff1d6" emissiveIntensity={2.2} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {cribSlots.map((slot) => {
        const inMachine = out.get(slot.tool.assembly);
        return (
          <StoredTool
            key={slot.tool.assembly}
            slot={slot}
            selected={selected === slot.tool.assembly}
            label={inMachine ? `${slot.tool.name} · in ${inMachine.join(", ")}` : slot.tool.name}
            ghost={!!inMachine}
            onSelect={onSelect}
          />
        );
      })}
    </group>
  );
}

// --------------------------------------------------------------- the cart

const CART_SIZE = { width: 0.9, depth: 0.55 };
const CART_TRAYS = [{ y: 0.3, rows: 2 }, { y: 0.86, rows: 3 }];
const CART_COLS = 6;

/** A cart place: the top tray fills first, front row first. */
function cartPlace(index: number) {
  const top = CART_TRAYS[1];
  const onTop = index < top.rows * CART_COLS;
  const tray = onTop ? top : CART_TRAYS[0];
  const k = onTop ? index : index - top.rows * CART_COLS;
  const row = Math.floor(k / CART_COLS);
  const col = k % CART_COLS;
  const pitchZ = 0.15;
  return new THREE.Vector3((col - (CART_COLS - 1) / 2) * 0.135, tray.y + RACK_HEIGHT, ((tray.rows - 1) / 2 - row) * pitchZ);
}

/** Where a tool of a machine's loadout stands on its cart, in the cart's frame. */
export function cartSlot(machineId: MachineId, assembly: string) {
  const index = loadoutTools(loadoutFor(machineId)).findIndex((t) => t.assembly === assembly);
  return index >= 0 ? cartPlace(index) : null;
}

/**
 * A machine's tool cart: the tools set up for it, in tool-number order, the
 * way the setup sheet lists them. What is on the cart is what the changer is
 * loaded with in free play.
 */
export function ToolCart({
  machineId,
  selected,
  onSelect,
}: {
  machineId: MachineId;
  selected: string | null;
  onSelect?: (assembly: string) => void;
}) {
  const loadout = useToolingStore((s) => loadoutFor(machineId, s.loadouts));
  const slots = useMemo(() => loadoutTools(loadout).map((tool, i) => ({ tool, at: cartPlace(i) })), [loadout]);
  const { width, depth } = CART_SIZE;
  return (
    <group>
      {/* Four posts, two trays with lips, a push handle and casters. */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[(sx * (width - 0.03)) / 2, 0.5, (sz * (depth - 0.03)) / 2]}>
            <boxGeometry args={[0.025, 0.86, 0.025]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
        )),
      )}
      {CART_TRAYS.map((tray) => (
        <group key={tray.y}>
          <mesh position={[0, tray.y - 0.01, 0]}>
            <boxGeometry args={[width, 0.02, depth]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
          <Rack
            y={tray.y}
            z={0}
            width={width - 0.06}
            depth={tray.rows * 0.15}
            sockets={Array.from({ length: tray.rows * CART_COLS }, (_, i) => {
              const p = cartPlace(tray === CART_TRAYS[1] ? i : CART_TRAYS[1].rows * CART_COLS + i);
              return new THREE.Vector3(p.x, 0, p.z);
            })}
          />
        </group>
      ))}
      <mesh position={[-width / 2 - 0.08, 0.95, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, depth - 0.08, 12]} />
        <meshStandardMaterial color="#b9bfc6" metalness={0.8} roughness={0.3} />
      </mesh>
      {[-1, 1].map((sz) => (
        <mesh key={sz} position={[-width / 2 - 0.04, 0.95, (sz * (depth - 0.08)) / 2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.01, 0.01, 0.08, 8]} />
          <meshStandardMaterial color="#b9bfc6" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`w${sx}${sz}`} position={[(sx * (width - 0.08)) / 2, 0.04, (sz * (depth - 0.08)) / 2]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.04, 0.04, 0.03, 16]} />
            <meshStandardMaterial color="#1b1c1e" roughness={0.8} />
          </mesh>
        )),
      )}
      {slots.map((slot) => (
        <StoredTool
          key={`${slot.tool.number}-${slot.tool.assembly}`}
          slot={slot}
          selected={selected === slot.tool.assembly}
          label={`T${slot.tool.number} · ${slot.tool.name}`}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}
