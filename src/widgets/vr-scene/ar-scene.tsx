"use client";

import { useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { XR, useXR, type createXRStore } from "@react-three/xr";
import type { DeviceMode, GameMode } from "@/entities/machine/machine-types";
import { HapticsBridge } from "@/features/xr/haptics";
import { GlassesPlacement } from "./ar-placement";
import { getPreviewCamera, getSceneGroupPosition } from "./layout";
import { MachineStation } from "./machine-station";

type ArSceneProps = {
  mode: Extract<DeviceMode, "glasses" | "phone">;
  gameMode: GameMode;
  xrStore: ReturnType<typeof createXRStore>;
  onSessionInfo: (info: string | null) => void;
};

/** Aims the preview camera once; see getPreviewCamera. */
function AimCamera({ target }: { target: [number, number, number] }) {
  const camera = useThree((state) => state.camera);
  const [x, y, z] = target;
  useEffect(() => {
    camera.lookAt(x, y, z);
  }, [camera, x, y, z]);
  return null;
}

// In an immersive-ar session the compositor blends our rendered frame on
// top of the camera passthrough. If the renderer's clear color stays opaque
// or scene.background is set, the canvas paints solid black over the feed —
// the user sees a "black room" instead of their environment. Force a fully
// transparent clear and null background regardless of session.
function ArPassthrough({ onSessionInfo }: { onSessionInfo: (info: string | null) => void }) {
  const sessionMode = useXR((state) => state.mode);
  const session = useXR((state) => state.session);
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    scene.background = null;
    gl.setClearColor(0x000000, 0);
  }, [gl, scene, sessionMode]);

  useEffect(() => {
    if (!session) {
      onSessionInfo(null);
      return;
    }
    const blend =
      (gl.xr as { getEnvironmentBlendMode?: () => string | undefined }).getEnvironmentBlendMode?.() ?? "unknown";
    onSessionInfo(`mode=${sessionMode ?? "?"} blend=${blend}`);
  }, [session, sessionMode, gl, onSessionInfo]);

  return null;
}

/**
 * Augmented reality: the machine alone, in the trainee's own room — AR
 * glasses or a phone. No workshop around it: the room they are standing in is
 * the backdrop. Everything the side panel holds stands beside it as boards.
 * Glasses put the machine down on their floor where the trainee points; a
 * phone shows it where it always has.
 */
export function ArScene({ mode, gameMode, xrStore, onSessionInfo }: ArSceneProps) {
  const previewCamera = getPreviewCamera(mode);
  const placement = getSceneGroupPosition(mode);

  return (
    <div className="relative h-full w-full">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: previewCamera.position, fov: previewCamera.fov }}
        gl={{ antialias: true, alpha: true }}
      >
        <XR store={xrStore}>
          <ArPassthrough onSessionInfo={onSessionInfo} />
          <AimCamera target={previewCamera.target} />
          {/* Low ambient and a key from the front right, so the light grey
              sheet metal keeps its edges instead of washing out to white. */}
          <ambientLight intensity={0.35} />
          <hemisphereLight intensity={0.7} groundColor="#15202c" />
          <directionalLight position={[4, 6, 5]} intensity={1.9} />
          <directionalLight position={[-5, 3.5, -2]} intensity={0.55} />
          <directionalLight position={[0, 4, -6]} intensity={0.45} />

          <HapticsBridge />
          {mode === "glasses" ? (
            <GlassesPlacement preview={placement}>
              {(placing) => (
                <MachineStation gameMode={gameMode} boards={!placing} adjustable interactive={!placing} focusPanel={false} />
              )}
            </GlassesPlacement>
          ) : (
            <group position={placement}>
              <MachineStation gameMode={gameMode} boards adjustable interactive focusPanel={false} />
            </group>
          )}
        </XR>
      </Canvas>
    </div>
  );
}
