"use client";

import { useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { XR, useXR, type createXRStore } from "@react-three/xr";
import type { DeviceMode, GameMode } from "@/entities/machine/machine-types";
import type { MachinePartId } from "@/entities/machine/machine-parts";
import { useMachineStore } from "@/entities/machine/machine-store";
import { useInteraction } from "@/features/session/use-interaction";
import { useSessionStore } from "@/features/session/session-store";
import { useTutorialHighlights } from "@/features/tutorial/tutorial-store";
import { CncMachine } from "./cnc-machine";
import { GuideArrows } from "./arrows";
import { TutorialTracker3D } from "./tutorial-tracker-3d";
import { StatusBoard3D } from "./status-board-3d";
import { SizePanel3D } from "./size-panel-3d";
import { getPreviewCamera, getSceneGroupPosition } from "./layout";

type VrSceneProps = {
  mode: DeviceMode;
  gameMode: GameMode;
  xrStore: ReturnType<typeof createXRStore>;
  onSessionInfo: (info: string | null) => void;
};

// In an immersive-ar session the compositor blends our rendered frame on
// top of the camera passthrough. If the renderer's clear color stays opaque
// or scene.background is set, the canvas paints solid black over the feed —
// the user sees a "black room" instead of their environment. Force a fully
// transparent clear and null background regardless of session.
function ArPassthrough({
  onSessionInfo,
}: {
  onSessionInfo: (info: string | null) => void;
}) {
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
      (gl.xr as { getEnvironmentBlendMode?: () => string | undefined })
        .getEnvironmentBlendMode?.() ?? "unknown";
    onSessionInfo(`mode=${sessionMode ?? "?"} blend=${blend}`);
  }, [session, sessionMode, gl, onSessionInfo]);

  return null;
}

const FREEPLAY_HINTS: MachinePartId[] = [
  "door",
  "air_valve",
  "power_button",
  "power_off",
  "emergency_button",
  "handle_jog",
  "diagnostics_panel",
  "coolant_toggle",
];

export function VrScene({ mode, gameMode, xrStore, onSessionInfo }: VrSceneProps) {
  const machine = useMachineStore((state) => state.machine);
  const interactWithPart = useInteraction();
  const hoveredPart = useSessionStore((state) => state.hoveredPart);
  const hintsEnabled = useSessionStore((state) => state.hintsEnabled);
  const setHoveredPart = useSessionStore((state) => state.setHoveredPart);
  const tutorialHighlights = useTutorialHighlights();
  const previewCamera = getPreviewCamera(mode);
  const sceneGroupPosition = getSceneGroupPosition(mode);
  const machineScale = useSessionStore((state) => state.machineScale);
  const setMachineScale = useSessionStore((state) => state.setMachineScale);

  const highlightedParts = useMemo(() => {
    if (gameMode === "tutorial") {
      return tutorialHighlights;
    }

    if (!hintsEnabled) {
      return [];
    }

    return hoveredPart ? [hoveredPart] : FREEPLAY_HINTS;
  }, [gameMode, hintsEnabled, hoveredPart, tutorialHighlights]);

  return (
    <div className="relative h-full w-full">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: previewCamera.position, fov: previewCamera.fov }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* Transparent canvas in every mode — AR needs it for passthrough,
            desktop/VR pick up whatever DOM background sits behind the canvas. */}

        <XR store={xrStore}>
          <ArPassthrough onSessionInfo={onSessionInfo} />
          <ambientLight intensity={1.4} />
          <hemisphereLight intensity={0.8} groundColor="#15202c" />
          <directionalLight position={[4.5, 6.8, 3.2]} intensity={1.8} />
          <spotLight
            position={[-3.2, 5.5, 4.5]}
            intensity={1.35}
            angle={0.34}
            penumbra={0.45}
          />

          <group position={sceneGroupPosition} scale={machineScale}>
            <CncMachine
              mode={mode}
              highlightedParts={highlightedParts}
              machine={machine}
              onPartInteract={interactWithPart}
              onHoverPart={setHoveredPart}
            />
            <GuideArrows highlightedParts={highlightedParts} mode={mode} />
            {/* In immersive modes the DOM HUD is invisible — mirror the
                tutorial tracker, status board, and size panel as 3D boards
                beside the machine. */}
            {(mode === "vr" || mode === "ar") && (
              <>
                {gameMode === "tutorial" && (
                  <group position={[-1.85, 1.55, 0.6]} rotation={[0, Math.PI / 6, 0]}>
                    <TutorialTracker3D />
                  </group>
                )}
                <group position={[1.85, 1.55, 0.6]} rotation={[0, -Math.PI / 6, 0]}>
                  <StatusBoard3D />
                </group>
                <group position={[-1.85, 0.55, 0.6]} rotation={[0, Math.PI / 6, 0]}>
                  <SizePanel3D value={machineScale} onChange={setMachineScale} />
                </group>
              </>
            )}
          </group>

          {mode === "desktop" && (
            <OrbitControls
              enablePan
              enableRotate
              enableZoom
              minDistance={4.5}
              maxDistance={10}
              target={[0.65, 1.1, -0.4]}
            />
          )}
        </XR>
      </Canvas>
    </div>
  );
}
