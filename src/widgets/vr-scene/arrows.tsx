"use client";

import { Fragment, useRef } from "react";
import { createPortal, useFrame, type ThreeEvent } from "@react-three/fiber";
import type { Group } from "three";
import type { MachinePartId } from "@/entities/machine/machine-parts";
import type { Anchor } from "./machine-rig";

const noopRaycast: NonNullable<ThreeEvent<MouseEvent>>["object"]["raycast"] = () => {};

/** An arrow along local -Y: the anchor's +Y points out of the surface, so
 *  this points at the control from in front of it. */
function Arrow({ scale }: { scale: number }) {
  const ref = useRef<Group>(null);

  useFrame(({ clock }) => {
    const group = ref.current;
    if (!group) return;
    group.position.y = (0.03 + Math.sin(clock.elapsedTime * 4.4) * 0.012) * scale;
  });

  return (
    <group scale={scale}>
      <group ref={ref}>
        <mesh position={[0, 0.055, 0]} rotation={[Math.PI, 0, 0]} raycast={noopRaycast}>
          <coneGeometry args={[0.035, 0.08, 16]} />
          <meshStandardMaterial color="#ffb020" emissive="#7a4a00" emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[0, 0.17, 0]} raycast={noopRaycast}>
          <cylinderGeometry args={[0.011, 0.011, 0.16, 12]} />
          <meshStandardMaterial color="#ffb020" emissive="#7a4a00" emissiveIntensity={0.6} />
        </mesh>
      </group>
    </group>
  );
}

type GuideArrowsProps = {
  anchors: ReadonlyMap<MachinePartId, Anchor>;
  highlightedParts: MachinePartId[];
};

/**
 * Arrows at the parts the trainee should look at next, rendered inside the
 * model's own anchor nodes — so an arrow on the door rides along with it, and
 * one on the rear panel faces out of the rear panel.
 */
export function GuideArrows({ anchors, highlightedParts }: GuideArrowsProps) {
  return (
    <>
      {highlightedParts.map((part) => {
        const anchor = anchors.get(part);
        return anchor ? (
          <Fragment key={part}>{createPortal(<Arrow scale={anchor.scale} />, anchor.node)}</Fragment>
        ) : null;
      })}
    </>
  );
}
