"use client";

import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { XR, createXRStore } from "@react-three/xr";
import type { DeviceMode, GameMode } from "@/entities/machine/machine-types";
import type { MachinePartId } from "@/entities/machine/machine-parts";
import { useMachineStore } from "@/entities/machine/machine-store";
import { useInteraction } from "@/features/session/use-interaction";
import { useSessionStore } from "@/features/session/session-store";
import { useTutorialHighlights } from "@/features/tutorial/tutorial-store";
import { CncMachine } from "./cnc-machine";
import { GuideArrows } from "./arrows";
import { TutorialTracker3D } from "./tutorial-tracker-3d";
import { getPreviewCamera, getSceneGroupPosition } from "./layout";

type VrSceneProps = {
  mode: DeviceMode;
  gameMode: GameMode;
};

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

export function VrScene({ mode, gameMode }: VrSceneProps) {
  const xrStore = useMemo(() => createXRStore(), []);
  const [xrError, setXrError] = useState<string | null>(null);
  const machine = useMachineStore((state) => state.machine);
  const interactWithPart = useInteraction();
  const hoveredPart = useSessionStore((state) => state.hoveredPart);
  const hintsEnabled = useSessionStore((state) => state.hintsEnabled);
  const setHoveredPart = useSessionStore((state) => state.setHoveredPart);
  const tutorialHighlights = useTutorialHighlights();
  const previewCamera = getPreviewCamera(mode);
  const sceneGroupPosition = getSceneGroupPosition(mode);
  const [machineScale, setMachineScale] = useState(1.0);

  const highlightedParts = useMemo(() => {
    if (gameMode === "tutorial") {
      return tutorialHighlights;
    }

    if (!hintsEnabled) {
      return [];
    }

    return hoveredPart ? [hoveredPart] : FREEPLAY_HINTS;
  }, [gameMode, hintsEnabled, hoveredPart, tutorialHighlights]);

  const startImmersiveMode = async () => {
    try {
      setXrError(null);
      if (mode === "vr") {
        await xrStore.enterVR();
      } else if (mode === "ar") {
        await xrStore.enterAR();
      }
    } catch {
      setXrError("WebXR session could not start on this device.");
    }
  };

  return (
    <div className="relative h-full w-full">
      {/* Machine scale slider — DOM-only, so it's only practical in desktop;
          in immersive modes the user can't see it but the value persists. */}
      <div className="pointer-events-none absolute left-4 top-4 z-20">
        <label className="pointer-events-auto flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-bg-glass px-3 py-2 text-xs text-text-secondary backdrop-blur-xl">
          <span className="font-mono tabular-nums">
            Size {machineScale.toFixed(2)}×
          </span>
          <input
            type="range"
            min={0.1}
            max={2.0}
            step={0.05}
            value={machineScale}
            onChange={(e) => setMachineScale(parseFloat(e.target.value))}
            className="w-40 accent-cyan"
          />
        </label>
      </div>

      {(mode === "vr" || mode === "ar") && (
        <div className="pointer-events-none absolute right-4 top-4 z-20 flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={startImmersiveMode}
            className="pointer-events-auto rounded-[var(--radius-md)] border border-cyan/40 bg-cyan/10 px-4 py-2 text-sm font-semibold text-cyan backdrop-blur-xl transition hover:bg-cyan/15"
          >
            {mode === "vr" ? "Enter VR" : "Enter AR"}
          </button>
          {xrError ? (
            <div className="max-w-xs rounded-[var(--radius-md)] border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger backdrop-blur-xl">
              {xrError}
            </div>
          ) : (
            <div className="max-w-xs rounded-[var(--radius-md)] border border-border bg-bg-glass px-3 py-2 text-xs text-text-secondary backdrop-blur-xl">
              {mode === "vr"
                ? "Preview mode is active. Use Enter VR on a WebXR-capable headset."
                : "Preview mode is active. Use Enter AR on a supported mobile device."}
            </div>
          )}
        </div>
      )}

      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: previewCamera.position, fov: previewCamera.fov }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* Transparent canvas in every mode — AR needs it for passthrough,
            desktop/VR pick up whatever DOM background sits behind the canvas. */}

        <XR store={xrStore}>
          <ambientLight intensity={1.4} />
          <hemisphereLight intensity={0.8} groundColor="#15202c" />
          <directionalLight
            castShadow
            position={[4.5, 6.8, 3.2]}
            intensity={1.8}
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <spotLight
            castShadow
            position={[-3.2, 5.5, 4.5]}
            intensity={1.35}
            angle={0.34}
            penumbra={0.45}
          />
          {mode === "desktop" && <Environment preset="warehouse" />}

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
                tutorial tracker as a 3D panel beside the machine. */}
            {gameMode === "tutorial" && (mode === "vr" || mode === "ar") && (
              <group position={[-1.85, 1.55, 0.6]} rotation={[0, Math.PI / 6, 0]}>
                <TutorialTracker3D />
              </group>
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
