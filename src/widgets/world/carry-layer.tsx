"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { useMachineStore } from "@/entities/machine/machine-store";
import { spindleRpm, type StockOnMachine } from "@/entities/machine/machine-types";
import { MAX_PARTS_PER_USER } from "@/entities/part/warehouse-limits";
import { savePart, useWarehouseStore } from "@/features/warehouse/warehouse-api";
import { previewField, type PartField } from "@/features/warehouse/part-field";
import { meshField, partMaterial } from "@/features/warehouse/part-mesh";
import { useLevelSession } from "@/features/levels/level-session";
import { useJobStore } from "@/features/part-development/job-store";
import { createStockRemoval, type StockRemoval } from "@/features/part-development/removal";
import { useStockRegistry } from "@/features/part-development/stock-registry";
import { WORLD } from "@/features/world/world-store";
import { capture, grabPose, isGrab, partInHand } from "@/features/xr/grab";
import { pulse, pulseFrom } from "@/features/xr/haptics";
import { showToast } from "@/shared/lib/notifications";
import { slotPosition, shelfScale } from "@/widgets/warehouse-scene/warehouse-scene";
import { useRigRegistry } from "@/widgets/vr-scene/rig-registry";

/**
 * Carrying the part from the vise to the cabinet, in a VR headset: squeeze
 * (or pinch) the stock to lift it out, walk or teleport to the lobby, and let
 * go over the cabinet's next free place to keep it. Let go anywhere else and
 * it goes back into the vise.
 *
 * Lifting the part does not unclamp it: the live stock is only hidden while
 * it is in the hand, so putting it back loses nothing. It is unclamped once
 * it is safely on a shelf. A desktop never mounts this — it clicks Save.
 */
const AMBER = "#ffb020";
const MUTED = "#8a9097";
/** How close to the free place a part has to be let go, metres. */
const LANDING_M = 0.35;
const RETURN_S = 0.35;
const noRaycast = () => {};

type Carried = {
  stock: StockOnMachine;
  field: PartField & { volumeMm3?: number };
  preview: THREE.BufferGeometry;
  full: StockRemoval | null;
};

/** The stock frame (mm, Z up, bottom-face centre) in the world, as the
 *  machine draws it under its stock mount. */
const STOCK_FRAME = new THREE.Matrix4()
  .makeRotationX(-Math.PI / 2)
  .multiply(new THREE.Matrix4().makeScale(0.001, 0.001, 0.001));

/** Why the part cannot be lifted out now, if it cannot. */
function blocked(): string | null {
  const m = useMachineStore.getState().machine;
  if (!m.stock) return "There is no part in the vise.";
  if (!m.doorOpen) return "Open the door to reach the vise.";
  if (m.program !== "idle") return "Stop the program before reaching into the machine.";
  if (spindleRpm(m) > 0) return "Wait for the spindle to stop.";
  return null;
}

const WAREHOUSE = WORLD.stations.find((s) => s.kind === "warehouse") ?? null;

/** The next free place on the warehouse's cabinet, in the world. */
function freePlace(index: number) {
  const station = WAREHOUSE;
  if (!station) return null;
  const local = slotPosition(index);
  return local
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), station.yaw)
    .add(new THREE.Vector3(station.position[0], 0, station.position[1]));
}

export function CarryLayer() {
  const rig = useRigRegistry((s) => s.rig);
  const removal = useStockRegistry((s) => s.removal);
  const stock = useMachineStore((s) => s.machine.stock);
  const parts = useWarehouseStore((s) => s.parts);
  const [carried, setCarried] = useState<Carried | null>(null);
  const [hovered, setHovered] = useState(false);
  const [landing, setLanding] = useState(false);
  const handle = useRef<THREE.Group>(null);
  const grab = useRef<{ pointerId: number; offset: THREE.Matrix4 } | null>(null);
  const returning = useRef<{ from: THREE.Matrix4; t: number } | null>(null);
  const material = useMemo(() => partMaterial(stock?.material ?? "aluminium"), [stock?.material]);
  const free = parts.length < MAX_PARTS_PER_USER ? freePlace(parts.length) : null;

  useEffect(() => () => material.dispose(), [material]);
  // Leaving the workshop with a part in hand leaves nothing in the hand.
  useEffect(
    () => () => {
      partInHand.current = false;
    },
    [],
  );

  /** Where the stock is drawn in the vise, in the world. */
  const stockPose = (target: THREE.Matrix4) => {
    const mount = rig?.nodes.stockMount;
    if (!mount) return false;
    mount.updateWorldMatrix(true, false);
    target.multiplyMatrices(mount.matrixWorld, STOCK_FRAME);
    return true;
  };

  /** Let the hand go: the live stock shows again, the hand's copy is freed. */
  const finish = (c: Carried | null) => {
    partInHand.current = false;
    if (removal) removal.group.visible = true;
    c?.preview.dispose();
    c?.full?.dispose();
    setCarried(null);
    setLanding(false);
  };

  const lift = async (event: ThreeEvent<PointerEvent>) => {
    const reason = blocked();
    if (reason || !removal || !stock) {
      showToast(reason ?? "The part is not ready yet.", "warning");
      pulseFrom(event, "tap");
      return;
    }
    const pointer = grabPose(event);
    if (!pointer) return;
    capture(event, event.pointerId);
    const now = new THREE.Matrix4();
    stockPose(now);
    grab.current = { pointerId: event.pointerId, offset: pointer.invert().multiply(now) };
    pulseFrom(event, "detent");

    // The hand gets a coarse copy at once and the full one when it is meshed.
    const field = await removal.exportField();
    // Let go before the copy arrived: nothing was lifted.
    if (grab.current?.pointerId !== event.pointerId) return;
    const preview = meshField(previewField(field, stock.size));
    const next: Carried = { stock, field, preview, full: null };
    removal.group.visible = false;
    partInHand.current = true;
    setCarried(next);
    const full = createStockRemoval(material);
    full
      .load(field)
      .then(() => setCarried((c) => (c === next ? { ...c, full } : (full.dispose(), c))))
      .catch(() => full.dispose());
  };

  const follow = (event: ThreeEvent<PointerEvent>) => {
    const g = grab.current;
    const h = handle.current;
    const pointer = grabPose(event);
    if (!g || g.pointerId !== event.pointerId || !h || !pointer) return;
    h.matrix.multiplyMatrices(pointer, g.offset);
    if (free) {
      const centre = new THREE.Vector3().setFromMatrixPosition(h.matrix);
      const near = centre.distanceTo(free) < LANDING_M;
      if (near !== landing) {
        setLanding(near);
        if (near) pulseFrom(event, "tap");
      }
    }
  };

  const letGo = async (event: ThreeEvent<PointerEvent>) => {
    const g = grab.current;
    if (!g || g.pointerId !== event.pointerId) return;
    grab.current = null;
    const c = carried;
    if (!c) return finish(null);
    if (!landing || !free) {
      returning.current = { from: handle.current!.matrix.clone(), t: 0 };
      return;
    }
    // On the shelf: keep it, then take it out of the machine.
    pulseFrom(event, "detent");
    const { design, program } = useJobStore.getState();
    const { level, result } = useLevelSession.getState();
    const saved = await savePart({
      machineId: "umc500",
      name: design.name,
      material: c.stock.material,
      stock: c.stock.size,
      program,
      design,
      levelId: level?.kind === "task" ? level.id : null,
      score: level?.kind === "task" ? (result?.score ?? null) : null,
      field: c.field,
    });
    if ("error" in saved) {
      showToast(saved.error, "warning");
      returning.current = { from: handle.current!.matrix.clone(), t: 0 };
      return;
    }
    const { rejected } = useMachineStore.getState().setStock(null);
    if (rejected) showToast(`On the shelf — the vise still holds a blank: ${rejected}`, "info");
    else showToast(`"${saved.part.name}" is on a shelf in the warehouse.`, "success");
    finish(c);
  };

  useFrame((_, dt) => {
    const h = handle.current;
    if (!h) return;
    const pose = new THREE.Matrix4();
    if (!stockPose(pose)) return;
    const back = returning.current;
    if (back) {
      // Back into the vise along a short ease, then the live stock takes over.
      back.t = Math.min(1, back.t + dt / RETURN_S);
      const [p0, q0, s0] = [new THREE.Vector3(), new THREE.Quaternion(), new THREE.Vector3()];
      const [p1, q1, s1] = [new THREE.Vector3(), new THREE.Quaternion(), new THREE.Vector3()];
      back.from.decompose(p0, q0, s0);
      pose.decompose(p1, q1, s1);
      h.matrix.compose(p0.lerp(p1, back.t), q0.slerp(q1, back.t), s0.lerp(s1, back.t));
      if (back.t >= 1) {
        returning.current = null;
        pulse("detent");
        finish(carried);
      }
      return;
    }
    // Resting in the vise, the handle sits on the stock.
    if (!grab.current) h.matrix.copy(pose);
  });

  if (!stock && !carried) return null;
  const [sx, sy, sz] = (carried?.stock ?? stock)!.size;
  const ready = !blocked();

  return (
    <>
      <group ref={handle} matrixAutoUpdate={false}>
        {/* What the hand closes on: the stock's box, a little proud of it.
            Only grabs see it — a ray or a fingertip passes through to the
            vise and the machine behind. */}
        <mesh
          position={[0, 0, sz / 2]}
          pointerEventsType={{ allow: "grab" }}
          // In the preview a mouse reaches it too; only a grab lifts.
          onPointerOver={(e) => isGrab(e) && setHovered(true)}
          onPointerOut={(e) => isGrab(e) && setHovered(false)}
          onPointerDown={(e) => {
            if (!isGrab(e)) return;
            e.stopPropagation();
            void lift(e);
          }}
          onPointerMove={follow}
          onPointerUp={(e) => {
            if (!isGrab(e)) return;
            e.stopPropagation();
            void letGo(e);
          }}
        >
          <boxGeometry args={[sx + 12, sy + 12, sz + 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {/* In reach: an outline, amber when it can be lifted out. */}
        {hovered && !carried && (
          <lineSegments position={[0, 0, sz / 2]} raycast={noRaycast}>
            <edgesGeometry args={[new THREE.BoxGeometry(sx + 8, sy + 8, sz + 8)]} />
            <lineBasicMaterial color={ready ? AMBER : MUTED} toneMapped={false} />
          </lineSegments>
        )}
        {carried &&
          (carried.full ? (
            <primitive object={carried.full.group} />
          ) : (
            <mesh geometry={carried.preview} material={material} raycast={noRaycast} />
          ))}
      </group>

      {/* While carrying: where on the shelf it would go. */}
      {carried && free && (
        <group position={free} rotation={[0, WAREHOUSE?.yaw ?? 0, 0]} scale={shelfScale(carried.stock.size)}>
          <mesh position={[0, sz / 2000, 0]} raycast={noRaycast}>
            <boxGeometry args={[sx / 1000, sz / 1000, sy / 1000]} />
            <meshBasicMaterial color={AMBER} transparent opacity={landing ? 0.35 : 0.12} depthWrite={false} toneMapped={false} />
          </mesh>
          <lineSegments position={[0, sz / 2000, 0]} raycast={noRaycast}>
            <edgesGeometry args={[new THREE.BoxGeometry(sx / 1000, sz / 1000, sy / 1000)]} />
            <lineBasicMaterial color={AMBER} toneMapped={false} />
          </lineSegments>
        </group>
      )}
    </>
  );
}
