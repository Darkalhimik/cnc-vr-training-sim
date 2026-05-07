"use client";

import { useState } from "react";
import { RoundedBox, Text } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";

const PANEL_W = 1.2;
const PANEL_H = 0.6;
const PANEL_DEPTH = 0.04;

const COLOR_PANEL = "#0d1218";
const COLOR_BORDER = "#1d3344";
const COLOR_BTN = "#1f3a4a";
const COLOR_BTN_HOVER = "#2a536a";
const COLOR_BTN_DISABLED = "#202b35";
const COLOR_TEXT_PRIMARY = "#eef2f7";
const COLOR_TEXT_MUTED = "#aab6c2";
const COLOR_ACCENT = "#7fc4d6";

const STEP = 0.1;
const MIN = 0.1;
const MAX = 2.0;

type ButtonProps = {
  position: [number, number, number];
  label: string;
  disabled: boolean;
  onClick: () => void;
};

function StepButton({ position, label, disabled, onClick }: ButtonProps) {
  const [hovered, setHovered] = useState(false);
  const color = disabled ? COLOR_BTN_DISABLED : hovered ? COLOR_BTN_HOVER : COLOR_BTN;

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
        color={disabled ? COLOR_TEXT_MUTED : COLOR_TEXT_PRIMARY}
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
  const clamp = (v: number) => Math.max(MIN, Math.min(MAX, Math.round(v * 100) / 100));

  return (
    <group>
      <RoundedBox args={[PANEL_W, PANEL_H, PANEL_DEPTH]} radius={0.04}>
        <meshStandardMaterial color={COLOR_PANEL} roughness={0.65} metalness={0.05} />
      </RoundedBox>
      <RoundedBox args={[PANEL_W + 0.01, PANEL_H + 0.01, PANEL_DEPTH * 0.95]} radius={0.04}>
        <meshBasicMaterial color={COLOR_BORDER} wireframe />
      </RoundedBox>

      <Text
        position={[0, PANEL_H / 2 - 0.09, surfaceZ]}
        fontSize={0.05}
        color={COLOR_TEXT_MUTED}
        anchorX="center"
        anchorY="middle"
      >
        Machine Size
      </Text>

      <Text
        position={[0, 0.02, surfaceZ]}
        fontSize={0.13}
        color={COLOR_ACCENT}
        anchorX="center"
        anchorY="middle"
      >
        {`${value.toFixed(2)}×`}
      </Text>

      <StepButton
        position={[-PANEL_W / 2 + 0.18, -PANEL_H / 2 + 0.18, surfaceZ + 0.025]}
        label="−"
        disabled={value <= MIN}
        onClick={() => onChange(clamp(value - STEP))}
      />
      <StepButton
        position={[PANEL_W / 2 - 0.18, -PANEL_H / 2 + 0.18, surfaceZ + 0.025]}
        label="+"
        disabled={value >= MAX}
        onClick={() => onChange(clamp(value + STEP))}
      />
    </group>
  );
}
