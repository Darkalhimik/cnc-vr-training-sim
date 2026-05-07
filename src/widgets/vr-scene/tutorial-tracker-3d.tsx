"use client";

import { useMemo } from "react";
import { RoundedBox, Text } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import {
  useCurrentPhase,
  useCurrentStep,
  useTutorialStore,
} from "@/features/tutorial/tutorial-store";
import { cncTutorialSteps } from "@/features/cnc-tutorial/steps";

const PANEL_W = 1.6;
const PANEL_H = 1.05;
const PANEL_DEPTH = 0.04;

const COLOR_PANEL = "#0d1218";
const COLOR_BORDER = "#1d3344";
const COLOR_DONE = "#6f9d78";
const COLOR_ACTIVE = "#7fc4d6";
const COLOR_PENDING = "#3a4654";
const COLOR_TEXT_PRIMARY = "#eef2f7";
const COLOR_TEXT_SECONDARY = "#aab6c2";

const noopRaycast: NonNullable<ThreeEvent<MouseEvent>>["object"]["raycast"] = () => {};

export function TutorialTracker3D() {
  const stepIndex = useTutorialStore((s) => s.stepIndex);
  const phaseIndex = useTutorialStore((s) => s.phaseIndex);
  const status = useTutorialStore((s) => s.status);
  const celebrationDismissed = useTutorialStore((s) => s.celebrationDismissed);

  const currentStep = useCurrentStep();
  const currentPhase = useCurrentPhase();

  const dots = useMemo(
    () =>
      cncTutorialSteps.map((step, i) => ({
        id: step.id,
        label: step.shortLabel,
        color: i < stepIndex ? COLOR_DONE : i === stepIndex ? COLOR_ACTIVE : COLOR_PENDING,
        isActive: i === stepIndex,
      })),
    [stepIndex],
  );

  if (status === "complete" && !celebrationDismissed) {
    return (
      <PanelFrame>
        <Text
          position={[0, 0.30, PANEL_DEPTH / 2 + 0.001]}
          fontSize={0.10}
          color={COLOR_DONE}
          anchorX="center"
          anchorY="middle"
          maxWidth={PANEL_W - 0.2}
        >
          Machine Ready!
        </Text>
        <Text
          position={[0, 0, PANEL_DEPTH / 2 + 0.001]}
          fontSize={0.05}
          color={COLOR_TEXT_SECONDARY}
          anchorX="center"
          anchorY="middle"
          maxWidth={PANEL_W - 0.2}
          textAlign="center"
        >
          Startup sequence complete.{"\n"}HAAS UMC-500 is ready for use.
        </Text>
      </PanelFrame>
    );
  }

  if (status === "complete") return null;
  if (!currentStep || !currentPhase) return null;

  const dotSpacing = 0.18;
  const dotRowWidth = (cncTutorialSteps.length - 1) * dotSpacing;
  const dotStartX = -dotRowWidth / 2;
  const totalPhases = currentStep.phases.length;

  return (
    <PanelFrame>
      {dots.map((dot, i) => {
        const x = dotStartX + i * dotSpacing;
        return (
          <group key={dot.id} position={[x, 0.38, PANEL_DEPTH / 2 + 0.001]}>
            <mesh raycast={noopRaycast}>
              <circleGeometry args={[dot.isActive ? 0.05 : 0.04, 24]} />
              <meshBasicMaterial color={dot.color} />
            </mesh>
            <Text
              position={[0, -0.10, 0]}
              fontSize={0.030}
              color={dot.color}
              anchorX="center"
              anchorY="middle"
            >
              {dot.label}
            </Text>
          </group>
        );
      })}

      <Text
        position={[-PANEL_W / 2 + 0.10, 0.10, PANEL_DEPTH / 2 + 0.001]}
        fontSize={0.07}
        color={COLOR_TEXT_PRIMARY}
        anchorX="left"
        anchorY="middle"
        maxWidth={PANEL_W - 0.2}
      >
        {totalPhases > 1
          ? `Step ${stepIndex + 1}: ${currentStep.title} (${phaseIndex + 1}/${totalPhases})`
          : `Step ${stepIndex + 1}: ${currentStep.title}`}
      </Text>

      <Text
        position={[-PANEL_W / 2 + 0.10, -0.05, PANEL_DEPTH / 2 + 0.001]}
        fontSize={0.045}
        color={COLOR_TEXT_SECONDARY}
        anchorX="left"
        anchorY="top"
        maxWidth={PANEL_W - 0.2}
        lineHeight={1.3}
      >
        {currentPhase.instruction}
      </Text>
    </PanelFrame>
  );
}

function PanelFrame({ children }: { children: React.ReactNode }) {
  return (
    <group>
      <RoundedBox args={[PANEL_W, PANEL_H, PANEL_DEPTH]} radius={0.04}>
        <meshStandardMaterial color={COLOR_PANEL} roughness={0.65} metalness={0.05} />
      </RoundedBox>
      <RoundedBox
        args={[PANEL_W + 0.01, PANEL_H + 0.01, PANEL_DEPTH * 0.95]}
        radius={0.04}
      >
        <meshBasicMaterial color={COLOR_BORDER} wireframe />
      </RoundedBox>
      {children}
    </group>
  );
}
