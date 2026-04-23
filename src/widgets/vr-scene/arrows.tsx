"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import type { DeviceMode } from "@/entities/machine/machine-types";
import type { MachinePartId } from "@/entities/machine/machine-parts";
import { getPartPosition } from "./layout";

type GuideArrowsProps = {
  highlightedParts: MachinePartId[];
  mode: DeviceMode;
};

export function GuideArrows({ highlightedParts, mode }: GuideArrowsProps) {
  const animatedGroupRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    const group = animatedGroupRef.current;
    if (!group) {
      return;
    }

    const pulse = 1 + Math.sin(clock.elapsedTime * 4.4) * 0.07;
    group.scale.setScalar(pulse);
    group.position.y = Math.sin(clock.elapsedTime * 2.2) * 0.014;
  });

  return (
    <group ref={animatedGroupRef}>
      {highlightedParts.map((partId) => {
        const [x, y, z] = getPartPosition(partId, mode);

        return (
          <group key={partId} position={[x, y + 0.24, z]}>
            <mesh position={[0, 0.18, 0]}>
              <cylinderGeometry args={[0.013, 0.013, 0.28, 12]} />
              <meshStandardMaterial color="#d58b53" emissive="#5b331f" emissiveIntensity={0.25} />
            </mesh>

            <mesh position={[0, 0.01, 0]}>
              <coneGeometry args={[0.05, 0.11, 16]} />
              <meshStandardMaterial color="#d58b53" emissive="#5b331f" emissiveIntensity={0.25} />
            </mesh>

            <mesh position={[0, 0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.075, 0.009, 12, 24]} />
              <meshStandardMaterial color="#97a8b6" emissive="#293543" emissiveIntensity={0.2} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
