"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { CameraControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { getPartField, type PartSummary } from "@/features/warehouse/warehouse-api";
import { meshField, partMaterial } from "@/features/warehouse/part-mesh";
import { MAX_PARTS_PER_USER } from "@/entities/part/warehouse-limits";
import { createStockRemoval, type StockRemoval } from "@/features/part-development/removal";
import { WORLD } from "@/features/world/world-store";
import { Rooms } from "@/widgets/world/rooms";
import { WorldLighting } from "@/widgets/world/world-lighting";
import { capture, grabPose, isGrab } from "@/features/xr/grab";
import { pulseFrom } from "@/features/xr/haptics";

/**
 * The warehouse's cabinet: a steel display case with lit shelves, one place per part a
 * trainee may keep. A click brings the camera to the part and swaps its shelf
 * preview for the full-resolution one.
 *
 * Metres, Y up, the cabinet's front at +Z, standing on the floor at y = 0.
 */
const COLS = 6;
const ROWS = Math.ceil(MAX_PARTS_PER_USER / COLS);
const INNER_W = 1.02;
const DEPTH = 0.42;
const PITCH_X = INNER_W / COLS;
const PITCH_Y = 0.3;
const PLINTH = 0.22;
const SHELF_T = 0.018;
const SIDE_T = 0.03;
const HEIGHT = PLINTH + ROWS * PITCH_Y + 0.08;
/** What a part's longest side is shown at, metres. A training blank is 80 mm
 *  — a sliver across a metre-wide cabinet — so parts are shown up to 1.6×
 *  real size, and the biggest blanks smaller, to read as a collection. */
const SLOT_SIZE = 0.13;
const MAX_SHELF_SCALE = 1.6;

/** The scale a blank of `stock` mm is shown at on a shelf. */
export const shelfScale = (stock: readonly number[]) => Math.min(MAX_SHELF_SCALE, SLOT_SIZE / (Math.max(...stock) / 1000));

const STEEL = "#454c55";
const STEEL_LIGHT = "#525a64";
const SHELF = "#8d939a";
const MAT = "#23272c";

const noRaycast = () => {};

/** Top surface of row `r` (0 = top shelf). */
const shelfTop = (r: number) => PLINTH + (ROWS - 1 - r) * PITCH_Y + SHELF_T;

export function slotPosition(index: number): THREE.Vector3 {
  const row = Math.floor(index / COLS);
  const col = index % COLS;
  return new THREE.Vector3(-INNER_W / 2 + PITCH_X * (col + 0.5), shelfTop(row), 0.03);
}

/** Top cap thickness; the sides and back stop under it. */
const TOP_T = 0.04;
/** The plinth is a toe kick: set back from the front, and a hair below the
 *  bottom shelf. */
const KICK = 0.03;

function Cabinet() {
  const shelves = Array.from({ length: ROWS }, (_, r) => r);
  const body = HEIGHT - TOP_T;
  // No two visible faces share a plane: where they did — the plinth's front
  // with the sides', its top with the bottom shelf, the cap with the sides'
  // tops — the depth buffer could not tell them apart and they flickered
  // through each other as the camera moved.
  return (
    <group>
      {/* Carcass. */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (INNER_W / 2 + SIDE_T / 2), body / 2, 0]} raycast={noRaycast}>
          <boxGeometry args={[SIDE_T, body, DEPTH]} />
          <meshStandardMaterial color={STEEL} metalness={0.3} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, HEIGHT - TOP_T / 2, 0]} raycast={noRaycast}>
        <boxGeometry args={[INNER_W + SIDE_T * 2 + 0.02, TOP_T, DEPTH + 0.02]} />
        <meshStandardMaterial color={STEEL} metalness={0.3} roughness={0.5} />
      </mesh>
      {/* Between the sides and in front of the back panel, so it shares no
          face with either. */}
      <mesh position={[0, (PLINTH - 0.003) / 2, (0.01 - KICK) / 2]} raycast={noRaycast}>
        <boxGeometry args={[INNER_W - 0.002, PLINTH - 0.003, DEPTH - 0.01 - KICK]} />
        <meshStandardMaterial color={STEEL_LIGHT} metalness={0.3} roughness={0.55} />
      </mesh>
      <mesh position={[0, body / 2, -DEPTH / 2 + 0.005]} raycast={noRaycast}>
        <boxGeometry args={[INNER_W, body, 0.01]} />
        <meshStandardMaterial color="#2a2f35" metalness={0.2} roughness={0.8} />
      </mesh>

      {shelves.map((r) => {
        const y = shelfTop(r) - SHELF_T / 2;
        return (
          <group key={r}>
            <mesh position={[0, y, 0]} raycast={noRaycast}>
              <boxGeometry args={[INNER_W, SHELF_T, DEPTH - 0.02]} />
              <meshStandardMaterial color={SHELF} metalness={0.5} roughness={0.35} />
            </mesh>
            {/* A mat per place, so an empty shelf still reads as places to fill. */}
            {Array.from({ length: COLS }, (_, c) => (
              <mesh
                key={c}
                position={[-INNER_W / 2 + PITCH_X * (c + 0.5), y + SHELF_T / 2 + 0.001, 0.03]}
                rotation={[-Math.PI / 2, 0, 0]}
                raycast={noRaycast}
              >
                <planeGeometry args={[PITCH_X - 0.02, 0.2]} />
                <meshStandardMaterial color={MAT} roughness={0.9} />
              </mesh>
            ))}
            {/* LED strip under the shelf above, lighting this one. */}
            <mesh position={[0, y + PITCH_Y - SHELF_T - 0.004, DEPTH / 2 - 0.03]} raycast={noRaycast}>
              <boxGeometry args={[INNER_W - 0.04, 0.006, 0.012]} />
              <meshStandardMaterial color="#fff6e5" emissive="#fff1d6" emissiveIntensity={2.2} toneMapped={false} />
            </mesh>
            <pointLight position={[0, y + PITCH_Y - 0.04, DEPTH / 2 - 0.06]} intensity={0.35} distance={0.6} decay={1.6} />
          </group>
        );
      })}

    </group>
  );
}

const IDENTITY_Q = new THREE.Quaternion();
const RETURN_RATE = 10;

/**
 * A part on its place: the coarse preview, or the full field when selected
 * or held. In a headset it can be lifted off the shelf with a squeeze or a
 * pinch and turned in the hand; let go, it goes back to its place.
 */
function ShelfPart({
  part,
  index,
  selected,
  hovered,
  onHover,
  onSelect,
}: {
  part: PartSummary;
  index: number;
  selected: boolean;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const material = useMemo(() => partMaterial(part.material), [part.material]);
  const [preview, setPreview] = useState<THREE.BufferGeometry | null>(null);
  const [full, setFull] = useState<StockRemoval | null>(null);
  const [holding, setHolding] = useState(false);
  const spin = useRef<THREE.Group>(null);
  const hold = useRef<THREE.Group>(null);
  const grab = useRef<{ pointerId: number; offset: THREE.Matrix4 } | null>(null);
  const fullRes = selected || holding;

  useEffect(() => {
    let cancelled = false;
    let made: THREE.BufferGeometry | null = null;
    getPartField(part.id, "preview")
      .then((field) => {
        if (cancelled) return;
        made = meshField(field);
        setPreview(made);
      })
      .catch((error: unknown) => console.warn("[warehouse] preview failed:", error));
    return () => {
      cancelled = true;
      made?.dispose();
    };
  }, [part.id]);

  // Full resolution only while it is being looked at or held.
  useEffect(() => {
    if (!fullRes) return;
    let cancelled = false;
    // Pickable, so a click on the part is not a click on empty space.
    const removal = createStockRemoval(material, { raycast: true });
    getPartField(part.id, "full")
      .then((field) => removal.load(field))
      .then(() => {
        if (!cancelled) setFull(removal);
      })
      .catch((error: unknown) => console.warn("[warehouse] part failed:", error));
    return () => {
      cancelled = true;
      setFull(null);
      removal.dispose();
    };
  }, [fullRes, part.id, material]);

  useEffect(() => {
    material.emissive.set(hovered && !selected ? "#ffffff" : "#000000");
    material.emissiveIntensity = hovered && !selected ? 0.08 : 0;
  }, [hovered, selected, material]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, dt) => {
    // Let go: back to its place on the shelf.
    const h = hold.current;
    if (h && !grab.current && (h.position.lengthSq() > 1e-8 || h.quaternion.angleTo(IDENTITY_Q) > 1e-4)) {
      const k = Math.min(1, dt * RETURN_RATE);
      h.position.lerp(new THREE.Vector3(), k);
      h.quaternion.slerp(IDENTITY_Q, k);
    }
    const g = spin.current;
    if (!g) return;
    // The part turns slowly while inspected, and settles back square on the shelf.
    if (selected) g.rotation.y += dt * 0.35;
    else g.rotation.y += (0 - g.rotation.y) * Math.min(1, dt * 6);
    g.position.y += ((selected ? 0.025 : 0) - g.position.y) * Math.min(1, dt * 6);
  });

  const at = slotPosition(index);
  const scale = shelfScale(part.stock);

  const handlers = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHover(part.id);
    },
    onPointerOut: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHover(null);
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      // A squeeze that lifted it is not a request to inspect it.
      if (isGrab(e)) return;
      onSelect(part.id);
    },
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      const h = hold.current;
      const pointer = grabPose(e);
      if (!pointer || !h) return;
      e.stopPropagation();
      capture(e, e.pointerId);
      h.updateWorldMatrix(true, false);
      grab.current = { pointerId: e.pointerId, offset: pointer.invert().multiply(h.matrixWorld) };
      setHolding(true);
      pulseFrom(e, "detent");
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      const g = grab.current;
      const h = hold.current;
      const pointer = grabPose(e);
      if (!g || g.pointerId !== e.pointerId || !h?.parent || !pointer) return;
      const world = pointer.multiply(g.offset);
      h.parent.updateWorldMatrix(true, false);
      const local = h.parent.matrixWorld.clone().invert().multiply(world);
      local.decompose(h.position, h.quaternion, new THREE.Vector3());
    },
    onPointerUp: (e: ThreeEvent<PointerEvent>) => {
      if (grab.current?.pointerId !== e.pointerId) return;
      e.stopPropagation();
      grab.current = null;
      setHolding(false);
      pulseFrom(e, "tap");
    },
  };

  return (
    <group position={at} scale={scale}>
      <group ref={hold}>
        <group ref={spin}>
          {/* Stock frame: millimetres, Z up, origin at the bottom-face centre. */}
          <group rotation={[-Math.PI / 2, 0, 0]} scale={0.001} {...handlers}>
            {full ? (
              <primitive object={full.group} />
            ) : (
              preview && <mesh geometry={preview} material={material} />
            )}
          </group>
        </group>
      </group>
      {hovered && !selected && (
        <Html position={[0, part.stock[2] / 1000 + 0.04, 0]} center distanceFactor={1.2} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded-md border bg-background/90 px-2 py-1 text-xs text-foreground shadow-sm backdrop-blur">
            {part.name}
          </div>
        </Html>
      )}
    </group>
  );
}

/** The camera's resting pose, in the cabinet's frame. */
const OVERVIEW = { position: new THREE.Vector3(0.35, 1.35, 3.2), target: new THREE.Vector3(0, 0.95, 0) };

/** Where the cabinet stands in the workshop: the /warehouse page shows it there,
 *  in the lobby, rather than on an empty background. */
const STATION = WORLD.stations.find((s) => s.kind === "warehouse")!;
const UP = new THREE.Vector3(0, 1, 0);
const inLobby = (local: THREE.Vector3) =>
  local.clone().applyAxisAngle(UP, STATION.yaw).add(new THREE.Vector3(STATION.position[0], 0, STATION.position[1]));

/** Flies the camera to the selected part, or back out to the whole cabinet. */
function CameraRig({ focus }: { focus: THREE.Vector3 | null }) {
  const controls = useRef<CameraControls>(null);
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const [from, to] = focus
      ? // From a little above, so the machined top face is in view.
        [inLobby(focus.clone().add(new THREE.Vector3(0.06, 0.17, 0.36))), inLobby(focus.clone().add(new THREE.Vector3(0, 0.03, 0)))]
      : [inLobby(OVERVIEW.position), inLobby(OVERVIEW.target)];
    void c.setLookAt(from.x, from.y, from.z, to.x, to.y, to.z, true);
    c.minDistance = focus ? 0.12 : 0.6;
  }, [focus]);
  return (
    <CameraControls
      ref={controls}
      makeDefault
      maxDistance={4.5}
      minPolarAngle={Math.PI * 0.2}
      // Never below the floor: at 4.5 m out, a little under level.
      maxPolarAngle={Math.PI * 0.53}
      // Stay in front of the cabinet: behind it is the lobby wall.
      minAzimuthAngle={STATION.yaw - Math.PI / 3}
      maxAzimuthAngle={STATION.yaw + Math.PI / 3}
      smoothTime={0.45}
    />
  );
}

/**
 * The cabinet and the parts on it, in the cabinet's own frame (standing on
 * the floor, front towards +z) — the /warehouse page puts a camera in front of
 * it, the workshop stands it in the lobby.
 */
export function CabinetDisplay({
  parts,
  selected,
  onSelect,
}: {
  parts: PartSummary[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  // Oldest first, so a part keeps its place as new ones arrive.
  const placed = useMemo(() => [...parts].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [parts]);

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);

  return (
    <group>
      <Cabinet />
      {placed.map((part, i) => (
        <ShelfPart
          key={part.id}
          part={part}
          index={i}
          selected={part.id === selected}
          hovered={part.id === hovered}
          onHover={setHovered}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

/** Where a part sits in the cabinet frame, by its place among `parts`. */
export function partSlot(parts: PartSummary[], id: string): THREE.Vector3 | null {
  const placed = [...parts].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const index = placed.findIndex((p) => p.id === id);
  return index >= 0 ? slotPosition(index) : null;
}

export function WarehouseScene({
  parts,
  selected,
  onSelect,
}: {
  parts: PartSummary[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const focus = useMemo(() => (selected ? partSlot(parts, selected) : null), [parts, selected]);
  const start = inLobby(OVERVIEW.position);

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [start.x, start.y, start.z], fov: 40, near: 0.05, far: 120 }}
      gl={{ antialias: true }}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={["#14161a"]} />
      <WorldLighting />
      <Suspense fallback={null}>
        <Rooms layout={WORLD} />
        <group position={[STATION.position[0], 0, STATION.position[1]]} rotation={[0, STATION.yaw, 0]}>
          <CabinetDisplay parts={parts} selected={selected} onSelect={onSelect} />
        </group>
      </Suspense>
      <CameraRig focus={focus} />
    </Canvas>
  );
}
