"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Object3D, Vector3 } from "three";
import { useMachineStore } from "@/entities/machine/machine-store";
import type { MachineRig } from "./machine-rig";

const dummy = new Object3D();
const COUNT = 120;

/**
 * Flood coolant from the nozzle on the spindle head, aimed at the tool tip.
 * Rendered inside the nozzle node, so it rides along with the head on every
 * axis move.
 */
export function CoolantStream({ rig }: { rig: MachineRig }) {
  const meshRef = useRef<InstancedMesh>(null);

  // Both nodes hang off the Z axis without rotation, so the offset between
  // them is the jet's direction in nozzle space.
  const jet = useMemo(
    () => rig.nodes.toolTip.position.clone().sub(rig.nodes.coolantNozzle.position),
    [rig],
  );
  const seeds = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        phase: (i * 0.61803) % 1,
        spread: new Vector3(
          Math.sin(i * 12.9898) * 0.5,
          Math.sin(i * 78.233) * 0.5,
          Math.sin(i * 39.425) * 0.5,
        ),
      })),
    [],
  );

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const active = useMachineStore.getState().machine.coolantOn;
    mesh.visible = active;
    if (!active) return;

    const t = clock.elapsedTime;
    seeds.forEach((seed, i) => {
      const k = (t * 1.6 + seed.phase) % 1;
      // Past the tip the stream splashes outwards and falls.
      const splash = Math.max(0, k - 0.75) / 0.25;
      dummy.position
        .copy(jet)
        .multiplyScalar(k)
        .addScaledVector(seed.spread, 0.004 + 0.04 * splash);
      dummy.position.y -= 0.12 * splash * splash;
      dummy.scale.setScalar(0.004 * (1 - 0.5 * splash));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]} raycast={() => {}}>
      <sphereGeometry args={[1, 6, 4]} />
      <meshStandardMaterial
        color="#9fdcf5"
        emissive="#1c7dd8"
        emissiveIntensity={0.25}
        transparent
        opacity={0.6}
        roughness={0.1}
      />
    </instancedMesh>
  );
}
