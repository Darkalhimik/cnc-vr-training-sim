"use client";

import { useState } from "react";
import { RoundedBox, Text } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useMachineStore } from "@/entities/machine/machine-store";
import { useJobStore } from "@/features/part-development/job-store";
import { programName, setupSteps } from "@/features/part-development/setup";
import { showToast } from "@/shared/ui/toast";
import { PANEL, toneOf } from "./panel-theme";

const PANEL_W = 1.6;
const PANEL_DEPTH = 0.04;
const ROW_H = 0.11;

const noopRaycast: NonNullable<ThreeEvent<MouseEvent>>["object"]["raycast"] = () => {};

function ActionButton({ label, onPress, position }: { label: string; onPress: () => void; position: [number, number, number] }) {
  const [hovered, setHovered] = useState(false);
  return (
    <group position={position}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onPress();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[0.32, 0.08, 0.03]} />
        <meshStandardMaterial color={hovered ? PANEL.controlHover : PANEL.control} roughness={0.5} />
      </mesh>
      <Text position={[0, 0, 0.017]} fontSize={0.036} color={PANEL.text} anchorX="center" anchorY="middle">
        {label}
      </Text>
    </group>
  );
}

/**
 * The job's setup checklist in the scene, for VR and AR where the side panel
 * is not visible: the same steps, read off the machine, with the shortcut for
 * the next one.
 */
export function JobBoard3D() {
  const machine = useMachineStore((s) => s.machine);
  const design = useJobStore((s) => s.design);
  const program = useJobStore((s) => s.program);
  const steps = setupSteps(machine, design, program);
  const next = steps.find((s) => !s.done);
  const height = 0.3 + steps.length * ROW_H + (next ? 0.22 : 0.08);
  const surfaceZ = PANEL_DEPTH / 2 + 0.001;
  const top = height / 2;

  return (
    <group>
      <RoundedBox args={[PANEL_W, height, PANEL_DEPTH]} radius={0.04} raycast={noopRaycast}>
        <meshStandardMaterial color={PANEL.surface} roughness={0.65} metalness={0.05} />
      </RoundedBox>
      <Text position={[-PANEL_W / 2 + 0.1, top - 0.1, surfaceZ]} fontSize={0.055} color={PANEL.text} anchorX="left" anchorY="middle">
        {`${design.name} · ${programName(design)}`}
      </Text>
      {steps.map((step, i) => {
        const state = step.done ? "done" : step === next ? "active" : "pending";
        const y = top - 0.24 - i * ROW_H;
        return (
          <group key={step.id} position={[0, y, surfaceZ]}>
            <mesh position={[-PANEL_W / 2 + 0.12, 0, 0]} raycast={noopRaycast}>
              <circleGeometry args={[0.025, 20]} />
              <meshBasicMaterial color={toneOf(state)} />
            </mesh>
            <Text
              position={[-PANEL_W / 2 + 0.18, 0, 0]}
              fontSize={0.04}
              color={state === "pending" ? PANEL.textMuted : PANEL.text}
              anchorX="left"
              anchorY="middle"
              maxWidth={PANEL_W - 0.3}
            >
              {step.title}
            </Text>
          </group>
        );
      })}
      {next && (
        <group position={[0, -height / 2 + 0.11, surfaceZ]}>
          <Text position={[-PANEL_W / 2 + 0.1, 0, 0]} fontSize={0.032} color={PANEL.textMuted} anchorX="left" anchorY="middle" maxWidth={PANEL_W - 0.6}>
            {next.detail}
          </Text>
          {next.action && (
            <ActionButton
              label={next.action.label}
              position={[PANEL_W / 2 - 0.22, 0, 0.015]}
              onPress={() => {
                const refused = next.action!.run();
                if (refused) showToast(refused, "warning");
              }}
            />
          )}
        </group>
      )}
    </group>
  );
}
