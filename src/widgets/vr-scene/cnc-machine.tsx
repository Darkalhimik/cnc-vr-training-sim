"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { type ThreeEvent } from "@react-three/fiber";
import type { DeviceMode, MachineState } from "@/entities/machine/machine-types";
import type { MachinePartId } from "@/entities/machine/machine-parts";
import { CoolantVoxels } from "./coolant-voxels";
import { getPartPosition } from "./layout";
import { ProceduralShell } from "./procedural-shell";
import { ShellFallbackBoundary } from "./shell-fallback-boundary";

const MachineShell = dynamic(
  () => import("./machine-shell").then((mod) => mod.MachineShell),
  { ssr: false, loading: () => null },
);

type CncMachineProps = {
  mode: DeviceMode;
  highlightedParts: MachinePartId[];
  machine: MachineState;
  onPartInteract: (partId: MachinePartId) => void;
  onHoverPart: (partId: MachinePartId | null) => void;
};

type BallValveProps = {
  active: boolean;
  highlight: boolean;
};

function highlightIsOn(partId: MachinePartId, highlightedParts: MachinePartId[]) {
  return highlightedParts.includes(partId);
}

// PVC ball valve modeled after the photo: vertical white pipe with three
// sections (top fitting, central housing bulge, bottom fitting) joined by
// shoulder flanges, plus a red lever sticking out horizontally from the side
// of the housing. The lever rotates around its stem axis (Z) — when open,
// the blade is parallel to the pipe (vertical); when closed, perpendicular.
function BallValve({ active, highlight }: BallValveProps) {
  const pvcWhite = "#f1f2f4";
  const pvcShade = "#dcdee2";
  const leverIdle = "#c92418";
  const leverHighlight = "#e8412e";
  const leverDark = "#7a1812";

  return (
    <group>
      {/* Top pipe stub */}
      <mesh position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.075, 0.075, 0.18, 24]} />
        <meshStandardMaterial color={pvcWhite} roughness={0.45} metalness={0.0} />
      </mesh>
      {/* Top shoulder flange */}
      <mesh position={[0, 0.235, 0]}>
        <cylinderGeometry args={[0.092, 0.082, 0.030, 24]} />
        <meshStandardMaterial color={pvcShade} roughness={0.5} metalness={0.0} />
      </mesh>
      {/* Central housing (where the ball sits) */}
      <mesh position={[0, 0.115, 0]}>
        <cylinderGeometry args={[0.105, 0.105, 0.215, 24]} />
        <meshStandardMaterial color={pvcWhite} roughness={0.45} metalness={0.0} />
      </mesh>
      {/* Bottom shoulder flange */}
      <mesh position={[0, -0.005, 0]}>
        <cylinderGeometry args={[0.082, 0.092, 0.030, 24]} />
        <meshStandardMaterial color={pvcShade} roughness={0.5} metalness={0.0} />
      </mesh>
      {/* Bottom pipe stub */}
      <mesh position={[0, -0.11, 0]}>
        <cylinderGeometry args={[0.075, 0.075, 0.18, 24]} />
        <meshStandardMaterial color={pvcWhite} roughness={0.45} metalness={0.0} />
      </mesh>

      {/* Lever assembly: anchored at side of central housing */}
      <group position={[0, 0.115, 0.105]}>
        {/* Stem — short cylinder protruding outward (Z axis), with rounded cap */}
        <mesh position={[0, 0, 0.030]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.030, 0.034, 0.060, 16]} />
          <meshStandardMaterial color={leverDark} roughness={0.5} metalness={0.0} />
        </mesh>
        <mesh position={[0, 0, 0.075]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.040, 0.040, 0.030, 20]} />
          <meshStandardMaterial color={leverIdle} roughness={0.45} metalness={0.0} />
        </mesh>
        {/* Handle blade — rotates around the stem (Z) axis */}
        <group position={[0, 0, 0.090]} rotation={[0, 0, active ? Math.PI / 2 : 0]}>
          <mesh position={[0.13, 0, 0]}>
            <boxGeometry args={[0.26, 0.05, 0.032]} />
            <meshStandardMaterial
              color={highlight ? leverHighlight : leverIdle}
              emissive={highlight ? leverIdle : "#000000"}
              emissiveIntensity={highlight ? 0.4 : 0}
              roughness={0.45}
              metalness={0.0}
            />
          </mesh>
          {/* Handle tip cap */}
          <mesh position={[0.255, 0, 0]}>
            <boxGeometry args={[0.020, 0.058, 0.040]} />
            <meshStandardMaterial color={leverDark} roughness={0.5} metalness={0.0} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export function CncMachine({
  mode,
  highlightedParts,
  machine,
  onPartInteract,
  onHoverPart,
}: CncMachineProps) {
  const partHandlers = (partId: MachinePartId) => ({
    onClick: (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      onPartInteract(partId);
    },
    onPointerEnter: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      onHoverPart(partId);
    },
    onPointerLeave: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      onHoverPart(null);
    },
  });

  const airValvePos = getPartPosition("air_valve", mode);

  return (
    <group>
      <ShellFallbackBoundary fallback={<ProceduralShell />}>
        <Suspense fallback={<ProceduralShell />}>
          <MachineShell
            machine={machine}
            highlightedParts={highlightedParts}
            onPartInteract={onPartInteract}
            onHoverPart={onHoverPart}
          />
        </Suspense>
      </ShellFallbackBoundary>

      <group position={airValvePos} {...partHandlers("air_valve")}>
        <group scale={0.5} rotation={[0, -Math.PI / 2, 0]}>
          <BallValve
            active={machine.airValveOpen}
            highlight={highlightIsOn("air_valve", highlightedParts)}
          />
        </group>
      </group>

      <CoolantVoxels active={machine.coolantOn} />
    </group>
  );
}
