"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls, useGLTF } from "@react-three/drei";
import { DRACO_DECODER } from "@/shared/lib/draco";

/**
 * The machine on a slow turntable. A clone of the cached GLB, so the
 * simulator's rig — which binds and recolours the cached scene — is never
 * touched from here, whichever page loads first.
 */
function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url, DRACO_DECODER);
  const model = useMemo(() => {
    const copy = scene.clone(true);
    // The CAD's stand-in tool hangs in the spindle; the simulator draws its own.
    const tool = copy.getObjectByName("Tool");
    if (tool) tool.visible = false;
    return copy;
  }, [scene]);
  return <primitive object={model} />;
}

/** Drag to turn it by hand; it carries on turning when let go. */
export function MachineShowcase({ url }: { url: string }) {
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [4.4, 2.6, 5.2], fov: 38 }} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.35} />
      <hemisphereLight intensity={0.7} groundColor="#15202c" />
      <directionalLight position={[4, 6, 5]} intensity={1.9} />
      <directionalLight position={[-5, 3.5, -2]} intensity={0.55} />
      <directionalLight position={[0, 4, -6]} intensity={0.45} />
      <Suspense fallback={null}>
        <Model url={url} />
        <ContactShadows position={[0, 0.001, 0]} scale={6} blur={2.4} opacity={0.55} far={2} />
      </Suspense>
      <OrbitControls
        makeDefault
        target={[0, 1.15, 0]}
        enablePan={false}
        enableZoom={false}
        autoRotate
        autoRotateSpeed={0.6}
        minPolarAngle={Math.PI * 0.28}
        maxPolarAngle={Math.PI * 0.48}
      />
    </Canvas>
  );
}
