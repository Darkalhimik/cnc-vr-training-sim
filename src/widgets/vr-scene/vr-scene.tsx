"use client";

import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls } from "@react-three/drei";
import { XR, createXRStore } from "@react-three/xr";
import type { DeviceMode, GameMode } from "@/entities/machine/machine-types";
import type { MachinePartId } from "@/entities/machine/machine-parts";
import { useMachineStore } from "@/entities/machine/machine-store";
import { cncTutorialSteps } from "@/features/cnc-tutorial/steps";
import { useInteraction } from "@/features/session/use-interaction";
import { useSessionStore } from "@/features/session/session-store";
import { useTutorialStore } from "@/features/tutorial/tutorial-store";
import { CncMachine } from "./cnc-machine";
import { GuideArrows } from "./arrows";
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
  const stepIndex = useTutorialStore((state) => state.stepIndex);
  const subStepIndex = useTutorialStore((state) => state.subStepIndex);
  const tutorialComplete = useTutorialStore((state) => state.isComplete);
  const previewCamera = getPreviewCamera(mode);
  const sceneGroupPosition = getSceneGroupPosition(mode);

  const tutorialHighlights = useMemo(() => {
    if (gameMode !== "tutorial" || tutorialComplete) {
      return [];
    }

    const currentStep = cncTutorialSteps[stepIndex];
    if (!currentStep) {
      return [];
    }

    return currentStep.subSteps?.[subStepIndex]?.highlight ?? currentStep.highlight;
  }, [gameMode, stepIndex, subStepIndex, tutorialComplete]);

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
        gl={{ antialias: true, alpha: mode === "ar" }}
      >
        <color attach="background" args={[mode === "ar" ? "#071019" : "#09111a"]} />
        <fog attach="fog" args={["#09111a", 10, 18]} />

        <XR store={xrStore}>
          <ambientLight intensity={0.6} />
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
          <Environment preset="warehouse" />

          <group position={sceneGroupPosition}>
            <CncMachine
              mode={mode}
              highlightedParts={highlightedParts}
              machine={machine}
              onPartInteract={interactWithPart}
              onHoverPart={setHoveredPart}
            />
            <GuideArrows highlightedParts={highlightedParts} mode={mode} />
          </group>

          <ContactShadows
            position={[0, -0.02, -1.4]}
            opacity={0.55}
            scale={16}
            blur={2.2}
            far={12}
          />

          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, -1.3]} receiveShadow>
            <planeGeometry args={[22, 22]} />
            <meshStandardMaterial color="#111b28" roughness={0.96} metalness={0.04} />
          </mesh>

          <gridHelper args={[22, 32, "#1d5b73", "#153244"]} position={[0, -0.01, -1.3]} />

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
