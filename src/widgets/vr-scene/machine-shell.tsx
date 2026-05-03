"use client";

import { useEffect, useMemo } from "react";
import { Center, useGLTF } from "@react-three/drei";
import * as THREE from "three";

const MODEL_URL = "/models/haas-umc500.glb";
const TARGET_FOOTPRINT_METERS = 2.55;

export function MachineShell() {
  const { scene } = useGLTF(MODEL_URL);

  const fitScale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const maxFootprint = Math.max(size.x, size.z);
    return maxFootprint > 0 ? TARGET_FOOTPRINT_METERS / maxFootprint : 1;
  }, [scene]);

  useEffect(() => {
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) {
        return;
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Procedural overlays (buttons, valves, door) own click interaction.
      mesh.raycast = () => {};
    });
  }, [scene]);

  return (
    <Center bottom>
      <group scale={fitScale}>
        <primitive object={scene} />
      </group>
    </Center>
  );
}

useGLTF.preload(MODEL_URL);
