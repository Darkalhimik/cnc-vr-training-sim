"use client";

import { useState } from "react";
import { RoundedBox, Text } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { PANEL } from "./panel-theme";
import {
  MACHINE_SCALE_MAX,
  MACHINE_SCALE_MIN,
  MACHINE_SCALE_STEP,
} from "@/features/session/session-store";

const PANEL_W = 1.2;
const PANEL_H = 0.6;
const PANEL_DEPTH = 0.04;


type ButtonProps = {
  position: [number, number, number];
  label: string;
  disabled: boolean;
  onClick: () => void;
};

function StepButton({ position, label, disabled, onClick }: ButtonProps) {
  const [hovered, setHovered] = useState(false);
  const color = disabled ? PANEL.controlDisabled : hovered ? PANEL.controlHover : PANEL.control;

  return (
    <group position={position}>
      <mesh
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (!disabled) onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[0.22, 0.22, 0.05]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} />
      </mesh>
      <Text
        position={[0, 0, 0.03]}
        fontSize={0.12}
        color={disabled ? PANEL.textMuted : PANEL.text}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
}

type Props = {
  value: number;
  onChange: (next: number) => void;
};

export function SizePanel3D({ value, onChange }: Props) {
  const surfaceZ = PANEL_DEPTH / 2 + 0.001;

  return (
    <group>
      <RoundedBox args={[PANEL_W, PANEL_H, PANEL_DEPTH]} radius={0.04}>
        <meshStandardMaterial color={PANEL.surface} roughness={0.65} metalness={0.05} />
      </RoundedBox>
      <RoundedBox args={[PANEL_W + 0.01, PANEL_H + 0.01, PANEL_DEPTH * 0.95]} radius={0.04}>
        <meshBasicMaterial color={PANEL.edge} wireframe />
      </RoundedBox>

      <Text
        position={[0, PANEL_H / 2 - 0.09, surfaceZ]}
        fontSize={0.045}
        color={PANEL.textMuted}
        anchorX="center"
        anchorY="middle"
      >
        Machine size
      </Text>

      <Text
        position={[0, 0.02, surfaceZ]}
        fontSize={0.12}
        color={PANEL.text}
        anchorX="center"
        anchorY="middle"
      >
        {`${value.toFixed(2)}×`}
      </Text>

      <StepButton
        position={[-PANEL_W / 2 + 0.18, -PANEL_H / 2 + 0.18, surfaceZ + 0.025]}
        label="−"
        disabled={value <= MACHINE_SCALE_MIN}
        onClick={() => onChange(value - MACHINE_SCALE_STEP)}
      />
      <StepButton
        position={[PANEL_W / 2 - 0.18, -PANEL_H / 2 + 0.18, surfaceZ + 0.025]}
        label="+"
        disabled={value >= MACHINE_SCALE_MAX}
        onClick={() => onChange(value + MACHINE_SCALE_STEP)}
      />
    </group>
  );
}
