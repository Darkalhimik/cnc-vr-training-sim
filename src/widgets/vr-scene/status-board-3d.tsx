"use client";

import { RoundedBox, Text } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useMachineStore } from "@/entities/machine/machine-store";
import { PANEL, toneOf } from "./panel-theme";

const PANEL_W = 1.2;
const PANEL_H = 1.05;
const PANEL_DEPTH = 0.04;

const noopRaycast: NonNullable<ThreeEvent<MouseEvent>>["object"]["raycast"] = () => {};

type Indicator = {
  label: string;
  /** The state word — both the value shown and the tone lookup key. */
  state: string;
};

/** The 3D counterpart of the DOM status pill: a tinted plate carrying the
 *  state word, so hue and text always arrive together. */
function StatePill({ state }: { state: string }) {
  const tone = toneOf(state);
  return (
    <group>
      <mesh raycast={noopRaycast}>
        <planeGeometry args={[0.26, 0.075]} />
        <meshBasicMaterial color={tone} transparent opacity={0.2} />
      </mesh>
      <Text position={[0, 0, 0.001]} fontSize={0.045} color={tone} anchorX="center" anchorY="middle">
        {state}
      </Text>
    </group>
  );
}

export function StatusBoard3D() {
  const machine = useMachineStore((s) => s.machine);

  const indicators: Indicator[] = [
    { label: "Air", state: machine.airValveOpen ? "on" : "off" },
    { label: "Power", state: machine.powerOn ? "on" : "off" },
    { label: "E-stop", state: machine.estop === "released" ? "free" : "lock" },
    { label: "Door", state: machine.doorOpen ? "open" : "shut" },
    { label: "Jog", state: machine.handleJogActive ? "on" : "off" },
    { label: "Coolant", state: machine.coolantOn ? "on" : "off" },
  ];

  const rowHeight = 0.13;
  const firstRowY = (indicators.length - 1) * rowHeight * 0.5;
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
        position={[0, PANEL_H / 2 - 0.10, surfaceZ]}
        fontSize={0.055}
        color={PANEL.text}
        anchorX="center"
        anchorY="middle"
      >
        Machine status
      </Text>

      {indicators.map((ind, i) => {
        const y = firstRowY - i * rowHeight - 0.05;
        return (
          <group key={ind.label} position={[0, y, surfaceZ]}>
            <Text
              position={[-PANEL_W / 2 + 0.12, 0, 0]}
              fontSize={0.042}
              color={PANEL.textMuted}
              anchorX="left"
              anchorY="middle"
            >
              {ind.label}
            </Text>
            <group position={[PANEL_W / 2 - 0.25, 0, 0]}>
              <StatePill state={ind.state} />
            </group>
          </group>
        );
      })}
    </group>
  );
}
