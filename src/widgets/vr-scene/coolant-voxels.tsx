"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Object3D } from "three";

const dummy = new Object3D();

type CoolantVoxelsProps = {
  active: boolean;
};

export function CoolantVoxels({ active }: CoolantVoxelsProps) {
  const meshRef = useRef<InstancedMesh>(null);

  const seeds = useMemo(
    () =>
      Array.from({ length: 144 }, (_, index) => {
        const nozzleIndex = index % 2;
        return {
          nozzleIndex,
          phase: (index % 24) / 24,
          radius: 0.05 + ((index * 17) % 11) * 0.008,
          swirl: (index % 9) * 0.6,
        };
      }),
    [],
  );

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }

    const t = clock.elapsedTime;

    seeds.forEach((seed, index) => {
      if (!active) {
        dummy.position.set(0, -10, 0);
        dummy.scale.setScalar(0.0001);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        return;
      }

      const progress = (t * 0.95 + seed.phase) % 1;
      const splash = Math.max(0, progress - 0.72) / 0.28;
      const nozzleX = seed.nozzleIndex === 0 ? -0.22 : 0.16;
      const nozzleZ = seed.nozzleIndex === 0 ? 0.18 : -0.04;
      const drift = Math.sin(t * 4 + index * 0.37) * 0.015;
      const spiral = seed.radius * (0.35 + progress * 0.65);

      dummy.position.set(
        nozzleX + Math.cos(seed.swirl + t * 2.4) * spiral + drift,
        1.54 - progress * 0.92 + Math.sin(t * 8 + index) * 0.015 - splash * 0.06,
        nozzleZ + Math.sin(seed.swirl + t * 2.9) * spiral,
      );
      dummy.scale.setScalar(0.012 - splash * 0.003);
      dummy.rotation.set(seed.swirl, progress * Math.PI * 2, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, seeds.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color="#78dbff"
        emissive="#1c7dd8"
        emissiveIntensity={0.35}
        transparent
        opacity={0.58}
        roughness={0.16}
        metalness={0.04}
      />
    </instancedMesh>
  );
}
