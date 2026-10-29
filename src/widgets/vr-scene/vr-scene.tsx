"use client";

import { useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { XR, useXR, type createXRStore } from "@react-three/xr";
import type { DeviceMode, GameMode } from "@/entities/machine/machine-types";
import type { MachinePartId } from "@/entities/machine/machine-parts";
import { useInteraction } from "@/features/session/use-interaction";
import { useSessionStore } from "@/features/session/session-store";
import { useTutorialHighlights } from "@/features/tutorial/tutorial-store";
import { CncMachine } from "./cnc-machine";
import { CameraFocus } from "./camera-focus";
import { TutorialTracker3D } from "./tutorial-tracker-3d";
import { StatusBoard3D } from "./status-board-3d";
import { SizePanel3D } from "./size-panel-3d";
import { WarningBoard3D } from "./warning-board-3d";
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
/** Aims the preview camera once; see getPreviewCamera. */
function AimCamera({ target }: { target: [number, number, number] }) {
  const camera = useThree((state) => state.camera);
  const [x, y, z] = target;
  useEffect(() => {
    camera.lookAt(x, y, z);
  }, [camera, x, y, z]);
  return null;
}

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

/** With hints on and nothing under the pointer, free play marks the controls
 *  a startup touches. */
const FREEPLAY_HINTS: MachinePartId[] = [
  "air_valve",
  "main_switch",
  "power_on",
  "estop",
  "reset",
  "power_up",
  "door",
  "hand_jog",
  "handwheel",
  "cycle_start",
];

export function VrScene({ mode, gameMode, xrStore, onSessionInfo }: VrSceneProps) {
  const interactWithPart = useInteraction();
  const hoveredPart = useSessionStore((state) => state.hoveredPart);
  const hintsEnabled = useSessionStore((state) => state.hintsEnabled);
  const setHoveredPart = useSessionStore((state) => state.setHoveredPart);
  const tutorialHighlights = useTutorialHighlights();
  const previewCamera = getPreviewCamera(mode);
  const sceneGroupPosition = getSceneGroupPosition(mode);
  const machineScale = useSessionStore((state) => state.machineScale);
  const machineYaw = useSessionStore((state) => state.machineYaw);
  const setMachineScale = useSessionStore((state) => state.setMachineScale);
  const turnMachine = useSessionStore((state) => state.turnMachine);

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
          {mode !== "desktop" && <AimCamera target={previewCamera.target} />}
          {/* Low ambient and a key from the front right, so the light grey
              sheet metal keeps its edges instead of washing out to white. */}
          <ambientLight intensity={0.35} />
          <hemisphereLight intensity={0.7} groundColor="#15202c" />
          <directionalLight position={[4, 6, 5]} intensity={1.9} />
          <directionalLight position={[-5, 3.5, -2]} intensity={0.55} />
          <directionalLight position={[0, 4, -6]} intensity={0.45} />

          <group position={sceneGroupPosition} scale={machineScale}>
            {/* Only the machine turns: the boards stay where the user is. */}
            <group rotation={[0, machineYaw, 0]}>
              <CncMachine
                highlightedParts={highlightedParts}
                hoveredPart={hoveredPart}
                onPartInteract={interactWithPart}
                onHoverPart={setHoveredPart}
              />
            </group>
            {/* In immersive modes the DOM HUD is invisible — mirror the
                tutorial tracker, status board, and size panel as 3D boards
                either side of the machine's front. */}
            {(mode === "vr" || mode === "ar") && (
              <>
                {gameMode === "tutorial" && (
                  <group position={[-2.2, 1.55, 1.5]} rotation={[0, Math.PI / 6, 0]}>
                    <TutorialTracker3D />
                  </group>
                )}
                <group position={[2.2, 1.45, 1.5]} rotation={[0, -Math.PI / 6, 0]}>
                  <StatusBoard3D />
                </group>
                <group position={[-2.2, 0.42, 1.5]} rotation={[0, Math.PI / 6, 0]}>
                  <SizePanel3D
                    value={machineScale}
                    onChange={setMachineScale}
                    onTurn={turnMachine}
                  />
                </group>
              </>
            )}
          </group>

          {/* Outside the scaled group on purpose: a safety warning that shrinks
              with the machine stops being a warning. */}
          {(mode === "vr" || mode === "ar") && (
            <group position={sceneGroupPosition}>
              <group position={[0, 2.35, 1.7]}>
                <WarningBoard3D />
              </group>
            </group>
          )}

          {mode === "desktop" && (
            // Close enough to read and press the pendant keys; zooming
            // follows the cursor so the user can dive straight at them.
            <OrbitControls
              makeDefault
              enablePan
              enableRotate
              enableZoom
              zoomToCursor
              minDistance={0.35}
              maxDistance={9}
              maxPolarAngle={Math.PI * 0.55}
              target={previewCamera.target}
            />
          )}
          {mode === "desktop" && <CameraFocus />}
        </XR>
      </Canvas>
    </div>
  );
}
