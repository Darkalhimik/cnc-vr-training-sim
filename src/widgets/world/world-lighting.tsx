"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * A workshop interior to reflect: dark walls, a dark floor, rows of bright
 * strip lights overhead and a warm wall at one end. Prefiltered once into
 * the scene's environment, it gives the machine's sheet metal and the
 * polished floor highlights that read as "lit from above", where a generic
 * studio room made everything glossy white.
 */
function workshopEnvironment() {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(30, 8, 30),
    new THREE.MeshBasicMaterial({ color: new THREE.Color("#3c4147"), side: THREE.BackSide }),
  );
  room.position.y = 3;
  scene.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ color: "#2b2e32" }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.9;
  scene.add(floor);
  const strip = new THREE.MeshBasicMaterial({ color: new THREE.Color("#f4f7ff").multiplyScalar(7) });
  for (const x of [-6, 0, 6]) {
    for (const z of [-8, 0, 8]) {
      const lamp = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), strip);
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(x, 6.9, z);
      scene.add(lamp);
    }
  }
  const warm = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 3),
    new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd9a8").multiplyScalar(1.6) }),
  );
  warm.position.set(0, 2.5, 14.9);
  warm.rotation.y = Math.PI;
  scene.add(warm);
  return scene;
}

/**
 * The workshop's light: a neutral tone curve that keeps light grey grey (the
 * filmic one bleached the machine to white), a sky-and-floor fill, one key
 * from high up like the roof lights, a cool fill from the far end, and a warm
 * light over the lobby so it feels like a different, quieter room.
 * No shadow maps — contact shadows are painted under things instead.
 */
export function WorldLighting() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const previous = { toneMapping: gl.toneMapping, exposure: gl.toneMappingExposure };
    gl.toneMapping = THREE.NeutralToneMapping;
    gl.toneMappingExposure = 1.0;
    const pmrem = new THREE.PMREMGenerator(gl);
    const source = workshopEnvironment();
    const env = pmrem.fromScene(source, 0.035).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.55;
    return () => {
      gl.toneMapping = previous.toneMapping;
      gl.toneMappingExposure = previous.exposure;
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
      source.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    };
  }, [gl, scene]);

  return (
    <>
      <hemisphereLight intensity={0.95} color="#eef2f7" groundColor="#5b5650" />
      <directionalLight position={[3, 14, 5]} intensity={1.3} color="#fff6ea" />
      {/* Low and across the hall, so walls and machine sides are lit too. */}
      <directionalLight position={[10, 4, -6]} intensity={0.45} color="#e3ebf5" />
      <directionalLight position={[-6, 8, -14]} intensity={0.35} color="#cddbf0" />
      <pointLight position={[0, 2.2, 4.6]} color="#ffd29a" intensity={6} distance={11} decay={2} />
    </>
  );
}
