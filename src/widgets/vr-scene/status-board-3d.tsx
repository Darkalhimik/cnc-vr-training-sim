"use client";

import { RoundedBox, Text } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useMachineStore } from "@/entities/machine/machine-store";

const PANEL_W = 1.2;
const PANEL_H = 1.05;
const PANEL_DEPTH = 0.04;

const COLOR_PANEL = "#0d1218";
const COLOR_BORDER = "#1d3344";
const COLOR_ON = "#6f9d78";
const COLOR_OFF = "#7a3a3a";
const COLOR_TEXT_PRIMARY = "#eef2f7";
const COLOR_TEXT_MUTED = "#aab6c2";

const noopRaycast: NonNullable<ThreeEvent<MouseEvent>>["object"]["raycast"] = () => {};

type Indicator = {
  label: string;
  active: boolean;
  on: string;
  off: string;
};

export function StatusBoard3D() {
  const machine = useMachineStore((s) => s.machine);

  const indicators: Indicator[] = [
    { label: "AIR", active: machine.airValveOpen, on: "ON", off: "OFF" },
    { label: "PWR", active: machine.powerOn, on: "ON", off: "OFF" },
    { label: "E-STOP", active: machine.estop === "released", on: "FREE", off: "LOCK" },
    { label: "DOOR", active: !machine.doorOpen, on: "SHUT", off: "OPEN" },
    { label: "JOG", active: machine.handleJogActive, on: "ON", off: "OFF" },
    { label: "COOL", active: machine.coolantOn, on: "ON", off: "OFF" },
  ];

  const rowHeight = 0.13;
  const firstRowY = (indicators.length - 1) * rowHeight * 0.5;
  const surfaceZ = PANEL_DEPTH / 2 + 0.001;

  return (
    <group>
      <RoundedBox args={[PANEL_W, PANEL_H, PANEL_DEPTH]} radius={0.04}>
        <meshStandardMaterial color={COLOR_PANEL} roughness={0.65} metalness={0.05} />
      </RoundedBox>
      <RoundedBox args={[PANEL_W + 0.01, PANEL_H + 0.01, PANEL_DEPTH * 0.95]} radius={0.04}>
        <meshBasicMaterial color={COLOR_BORDER} wireframe />
      </RoundedBox>

      <Text
        position={[0, PANEL_H / 2 - 0.10, surfaceZ]}
        fontSize={0.06}
        color={COLOR_TEXT_PRIMARY}
        anchorX="center"
        anchorY="middle"
      >
        Machine Status
      </Text>

      {indicators.map((ind, i) => {
        const y = firstRowY - i * rowHeight - 0.05;
        const color = ind.active ? COLOR_ON : COLOR_OFF;
        return (
          <group key={ind.label} position={[0, y, surfaceZ]}>
            <mesh position={[-PANEL_W / 2 + 0.12, 0, 0]} raycast={noopRaycast}>
              <circleGeometry args={[0.024, 20]} />
              <meshBasicMaterial color={color} />
            </mesh>
            <Text
              position={[-PANEL_W / 2 + 0.20, 0, 0]}
              fontSize={0.045}
              color={COLOR_TEXT_MUTED}
              anchorX="left"
              anchorY="middle"
            >
              {ind.label}
            </Text>
            <Text
              position={[PANEL_W / 2 - 0.12, 0, 0]}
              fontSize={0.05}
              color={color}
              anchorX="right"
              anchorY="middle"
            >
              {ind.active ? ind.on : ind.off}
            </Text>
          </group>
        );
      })}
    </group>
  );
}
