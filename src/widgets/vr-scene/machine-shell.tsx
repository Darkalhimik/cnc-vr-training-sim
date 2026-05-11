"use client";

import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { MachineState } from "@/entities/machine/machine-types";

// `Object3D` lives in two slightly different paths in @types/three; events from
// react-three-fiber and `useGLTF` resolve them to incompatible nominal types.
// Use a structural alias for everything we walk/mutate ourselves.
type Obj3DLike = {
  name: string;
  parent: Obj3DLike | null;
  position: { x: number; y: number };
  rotation: { z: number };
};
import type { MachinePartId } from "@/entities/machine/machine-parts";

const MODEL_URL = "/models/haas-umc500-v2.glb?v=10";
const TARGET_FOOTPRINT_METERS = 2.55;
const DOOR_SLIDE_OPEN_DELTA = -0.74;
const DOOR_SLIDE_LERP_RATE = 6;

const NODE_TO_PART_ID: Record<string, MachinePartId> = {
  Door_Mesh: "door",
  Panel_Housing: "panel",
  Btn_PowerOn: "power_button",
  Btn_PowerOff: "power_off",
  Btn_EmergencyStop: "emergency_button",
  Btn_HandleJog: "handle_jog",
  Btn_CycleStart: "cycle_start",
  Btn_FeedHold: "feed_hold",
  Btn_Memory: "mode_selector",
  Screen_Diagnostics: "diagnostics_panel",
};

type Props = {
  machine: MachineState;
  highlightedParts: MachinePartId[];
  onPartInteract: (partId: MachinePartId) => void;
  onHoverPart: (partId: MachinePartId | null) => void;
};

function findPartIdForObject(start: Obj3DLike | null): MachinePartId | null {
  let cursor: Obj3DLike | null = start;
  while (cursor) {
    const id = NODE_TO_PART_ID[cursor.name];
    if (id) return id;
    cursor = cursor.parent;
  }
  return null;
}

export function MachineShell({
  machine,
  highlightedParts,
  onPartInteract,
  onHoverPart,
}: Props) {
  const { scene } = useGLTF(MODEL_URL);

  // Compute scale + center/ground translation explicitly so we own where the
  // model lands. drei's <Center bottom> is opaque about how it interacts with
  // a nested scale, and the parent <group> in vr-scene.tsx applies a Y offset
  // that we need to cancel out so the bottom of the model sits on the floor.
  const fit = useMemo(() => {
    const bbox = new THREE.Box3().setFromObject(scene);
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());
    const max = Math.max(size.x, size.z);
    const scale = max > 0 ? TARGET_FOOTPRINT_METERS / max : 1;
    // Translation to apply BEFORE scale: brings X-Z center to origin, and
    // brings the bottom (min Y) to Y=0.
    return {
      scale,
      tx: -center.x,
      ty: -bbox.min.y,
      tz: -center.z,
    };
  }, [scene]);

  const doorRef = useRef<Obj3DLike | null>(null);
  const doorBaseX = useRef<number | null>(null);
  const emergencyRef = useRef<Obj3DLike | null>(null);
  const emergencyBaseY = useRef<number | null>(null);

  useEffect(() => {
    doorRef.current = scene.getObjectByName("Door") ?? null;
    if (doorRef.current && doorBaseX.current === null) {
      doorBaseX.current = doorRef.current.position.x;
    }
    emergencyRef.current = scene.getObjectByName("Btn_EmergencyStop") ?? null;
    if (emergencyRef.current && emergencyBaseY.current === null) {
      emergencyBaseY.current = emergencyRef.current.position.y;
    }
  }, [scene]);

  // Smoothly slide door + lift E-stop based on machine state
  useFrame((_, dt) => {
    const door = doorRef.current;
    if (door && doorBaseX.current !== null) {
      const target = doorBaseX.current + (machine.doorOpen ? DOOR_SLIDE_OPEN_DELTA : 0);
      const lerp = 1 - Math.exp(-dt * DOOR_SLIDE_LERP_RATE);
      door.position.x += (target - door.position.x) * lerp;
    }
    const estop = emergencyRef.current;
    if (estop && emergencyBaseY.current !== null) {
      const lifted = machine.estop === "extended" || machine.estop === "released";
      const target = emergencyBaseY.current + (lifted ? 0.012 : 0);
      const lerp = 1 - Math.exp(-dt * 8);
      estop.position.y += (target - estop.position.y) * lerp;
      estop.rotation.z = machine.estop === "released" ? Math.PI / 4 : 0;
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    const partId = findPartIdForObject(event.object);
    if (partId) {
      event.stopPropagation();
      onPartInteract(partId);
    }
  };

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    const partId = findPartIdForObject(event.object);
    if (partId) {
      event.stopPropagation();
      onHoverPart(partId);
    }
  };

  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    const partId = findPartIdForObject(event.object);
    if (partId) {
      event.stopPropagation();
      onHoverPart(null);
    }
  };

  // Highlight (tutorial pointer) + active-state visual feedback. Each part
  // gets a per-mesh material clone the first time it's touched so emissive
  // changes don't bleed into other buttons that share the same source material.
  useEffect(() => {
    const isPartActive = (id: MachinePartId): boolean => {
      switch (id) {
        case "power_button":      return machine.powerOn;
        case "power_off":         return !machine.powerOn;
        case "emergency_button":  return machine.estop !== "engaged";
        case "diagnostics_panel": return machine.diagnosticsOpen;
        case "handle_jog":        return machine.handleJogActive;
        case "door":              return machine.doorOpen;
        default:                  return false;
      }
    };

    const highlighted = new Set(highlightedParts);

    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const partId = NODE_TO_PART_ID[o.name];
      if (!partId) return;

      let mat = o.material;
      if (!(mat instanceof THREE.MeshStandardMaterial)) return;

      // Clone per mesh once so emissive on this button doesn't tint others
      if (!o.userData.matCloned) {
        mat = mat.clone();
        o.material = mat;
        o.userData.matCloned = true;
        o.userData.baseColor = mat.color.clone();
      }

      const isHighlighted = highlighted.has(partId);
      const isActive = isPartActive(partId);

      if (isHighlighted) {
        mat.emissive.copy(mat.color);
        mat.emissiveIntensity = 0.65;
      } else if (isActive) {
        mat.emissive.copy(mat.color);
        mat.emissiveIntensity = 0.40;
      } else {
        mat.emissive.setRGB(0, 0, 0);
        mat.emissiveIntensity = 0;
      }
    });
  }, [highlightedParts, scene, machine]);

  // Single group: scale + translate so model is centered horizontally and
  // bottom-aligned at local Y=0. The parent <group position={sceneGroupPosition}>
  // in vr-scene.tsx places the whole rig in world space.
  return (
    <group scale={fit.scale} position={[fit.tx * fit.scale, fit.ty * fit.scale, fit.tz * fit.scale]}>
      <primitive
        object={scene}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      />
    </group>
  );
}

useGLTF.preload(MODEL_URL);
