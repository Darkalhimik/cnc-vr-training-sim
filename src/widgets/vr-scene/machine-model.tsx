"use client";

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { createPortal, useFrame, type ThreeEvent } from "@react-three/fiber";
import { useMachineStore } from "@/entities/machine/machine-store";
import { DRACO_DECODER } from "@/shared/lib/draco";
import type { MachinePartId } from "@/entities/machine/machine-parts";
import { CoolantStream } from "./coolant-voxels";
import { GuideArrows } from "./arrows";
import { useRigRegistry } from "./rig-registry";
import { MachineRuntime } from "./machine-runtime";
import {
  MODEL_URL,
  animateRig,
  bindRig,
  handwheelSign,
  partOf,
  pressRig,
  type MachineRig,
} from "./machine-rig";

type Props = {
  /** Off: pointer events pass through to whatever holds the machine. */
  interactive: boolean;
  highlightedParts: MachinePartId[];
  hoveredPart: MachinePartId | null;
  onPartInteract: (partId: MachinePartId, sign?: 1 | -1) => void;
  onHoverPart: (partId: MachinePartId | null) => void;
};

/**
 * The HAAS UMC-500, at real scale: 1 unit is 1 m, floor at y = 0, the
 * footprint centred on the origin, the operator's side towards +z.
 *
 * Machine state is read every frame rather than subscribed to, so axis moves,
 * the door and the gauge animate without re-rendering React.
 */
export function MachineModel({ interactive, highlightedParts, hoveredPart, onPartInteract, onHoverPart }: Props) {
  const { scene } = useGLTF(MODEL_URL, DRACO_DECODER);
  // useGLTF caches the scene, so bind it once for the life of the page — a
  // second bind would clone every material again.
  const rig: MachineRig = useMemo(
    () => (scene.userData.rig ??= bindRig(scene, useMachineStore.getState().machine)),
    [scene],
  );
  const highlighted = useMemo(() => new Set(highlightedParts), [highlightedParts]);
  const setRig = useRigRegistry((s) => s.setRig);
  useEffect(() => {
    setRig(rig);
    return () => setRig(null);
  }, [rig, setRig]);

  useFrame(({ clock }, dt) => {
    const { machine, message } = useMachineStore.getState();
    animateRig(rig, machine, message, Math.min(dt, 0.1), clock.elapsedTime, highlighted, hoveredPart);
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    const part = partOf(event.object);
    if (!part) return;
    event.stopPropagation();
    const sign = part === "handwheel" ? handwheelSign(rig, event.point) : undefined;
    pressRig(rig, part, sign);
    onPartInteract(part, sign);
  };

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    const part = partOf(event.object);
    if (!part) return;
    event.stopPropagation();
    onHoverPart(part);
  };

  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    if (!partOf(event.object)) return;
    event.stopPropagation();
    onHoverPart(null);
  };

  return (
    <>
      <primitive
        object={scene}
        onClick={interactive ? handleClick : undefined}
        onPointerOver={interactive ? handlePointerOver : undefined}
        onPointerOut={interactive ? handlePointerOut : undefined}
      />
      <GuideArrows anchors={rig.anchors} highlightedParts={highlightedParts} />
      {createPortal(<CoolantStream rig={rig} />, rig.nodes.coolantNozzle)}
      {createPortal(<MachineRuntime rig={rig} />, rig.nodes.stockMount)}
    </>
  );
}

useGLTF.preload(MODEL_URL, DRACO_DECODER);
