"use client";

import { RoundedBox, Text } from "@react-three/drei";
import { type ThreeEvent } from "@react-three/fiber";
import type { DeviceMode, MachineState } from "@/entities/machine/machine-types";
import type { MachinePartId } from "@/entities/machine/machine-parts";
import { CoolantVoxels } from "./coolant-voxels";
import { getPartPosition } from "./layout";

type CncMachineProps = {
  mode: DeviceMode;
  highlightedParts: MachinePartId[];
  machine: MachineState;
  onPartInteract: (partId: MachinePartId) => void;
  onHoverPart: (partId: MachinePartId | null) => void;
};

type ValveWheelProps = {
  active: boolean;
  highlight: boolean;
  color: string;
};

type RoundButtonProps = {
  label: string;
  active: boolean;
  highlight: boolean;
  color: string;
};

type RectButtonProps = {
  label: string;
  color: string;
  highlight: boolean;
};

function highlightIsOn(partId: MachinePartId, highlightedParts: MachinePartId[]) {
  return highlightedParts.includes(partId);
}

function ValveWheel({ active, highlight, color }: ValveWheelProps) {
  return (
    <group rotation={[Math.PI / 2, 0, active ? Math.PI / 2 : 0]}>
      <mesh>
        <torusGeometry args={[0.11, 0.016, 14, 28]} />
        <meshStandardMaterial
          color={color}
          emissive={highlight ? color : "#000000"}
          emissiveIntensity={highlight ? 0.22 : 0}
          metalness={0.58}
          roughness={0.28}
        />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.03, 0.03, 0.03, 18]} />
        <meshStandardMaterial color="#d9e2ea" metalness={0.75} roughness={0.18} />
      </mesh>
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((rotation) => (
        <mesh key={rotation} rotation={[0, 0, rotation]}>
          <boxGeometry args={[0.16, 0.016, 0.016]} />
          <meshStandardMaterial color="#d9e2ea" metalness={0.72} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function RoundButtonControl({ label, active, highlight, color }: RoundButtonProps) {
  return (
    <group>
      <mesh position={[0, 0, -0.02]}>
        <cylinderGeometry args={[0.08, 0.08, 0.04, 24]} />
        <meshStandardMaterial color="#17202c" roughness={0.72} metalness={0.28} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <cylinderGeometry args={[0.056, 0.062, 0.06, 24]} />
        <meshStandardMaterial
          color={active ? color : "#55687d"}
          emissive={active || highlight ? color : "#000000"}
          emissiveIntensity={active ? 0.55 : highlight ? 0.18 : 0}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      <Text position={[0, 0.12, 0.02]} fontSize={0.035} color="#e6edf5" anchorX="center" anchorY="middle">
        {label}
      </Text>
    </group>
  );
}

function RectControlButton({ label, color, highlight }: RectButtonProps) {
  return (
    <group>
      <RoundedBox args={[0.18, 0.12, 0.035]} radius={0.02} position={[0, 0, -0.01]}>
        <meshStandardMaterial color="#17202c" roughness={0.7} metalness={0.2} />
      </RoundedBox>
      <RoundedBox args={[0.16, 0.1, 0.05]} radius={0.018} position={[0, 0, 0.018]}>
        <meshStandardMaterial
          color={color}
          emissive={highlight ? color : "#000000"}
          emissiveIntensity={highlight ? 0.22 : 0.08}
          roughness={0.32}
          metalness={0.1}
        />
      </RoundedBox>
      <Text position={[0, 0.13, 0.02]} fontSize={0.03} color="#eef2f7" anchorX="center" anchorY="middle">
        {label}
      </Text>
    </group>
  );
}

function ModeSelectorKnob({ highlight }: { highlight: boolean }) {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.05, 24]} />
        <meshStandardMaterial color="#151d28" roughness={0.72} metalness={0.22} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.03]}>
        <cylinderGeometry args={[0.058, 0.062, 0.08, 24]} />
        <meshStandardMaterial
          color="#d6dde6"
          emissive={highlight ? "#d6dde6" : "#000000"}
          emissiveIntensity={highlight ? 0.12 : 0}
          roughness={0.18}
          metalness={0.74}
        />
      </mesh>
      <mesh position={[0.035, 0.035, 0.04]} rotation={[0, 0, Math.PI / 3]}>
        <boxGeometry args={[0.1, 0.016, 0.016]} />
        <meshStandardMaterial color="#10161f" />
      </mesh>
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

  const shellColor = "#cfd7e0";
  const shellDark = "#18222f";
  const shellMid = "#314251";
  const trim = "#8f9fad";
  const accent = "#6f9d78";
  const warning = "#c99554";
  const danger = "#c5675d";

  const doorBase = getPartPosition("door", mode);
  const airValvePos = getPartPosition("air_valve", mode);
  const coolantValvePos = getPartPosition("coolant_toggle", mode);
  const panelAnchor = getPartPosition("panel", mode);
  const doorX = doorBase[0] + (machine.doorOpen ? -0.74 : 0);
  const emergencyLift = machine.emergencyExtended ? 0.05 : 0;
  const emergencyRotate = machine.emergencyClockwise ? Math.PI / 4 : 0;

  return (
    <group>
      <group>
        <mesh position={[0, 0.17, 0]}>
          <boxGeometry args={[3.08, 0.34, 2.44]} />
          <meshStandardMaterial color="#0e151e" roughness={0.9} metalness={0.16} />
        </mesh>

        <mesh position={[0, 0.54, -0.98]}>
          <boxGeometry args={[2.74, 0.42, 0.42]} />
          <meshStandardMaterial color="#151e2a" roughness={0.94} metalness={0.12} />
        </mesh>

        <RoundedBox args={[0.16, 2.12, 2.12]} radius={0.025} position={[-1.34, 1.29, 0]}>
          <meshStandardMaterial color={shellColor} roughness={0.58} metalness={0.24} />
        </RoundedBox>
        <RoundedBox args={[0.16, 2.12, 2.12]} radius={0.025} position={[1.34, 1.29, 0]}>
          <meshStandardMaterial color={shellColor} roughness={0.58} metalness={0.24} />
        </RoundedBox>
        <RoundedBox args={[2.52, 2.12, 0.14]} radius={0.025} position={[0, 1.29, -1.06]}>
          <meshStandardMaterial color={shellColor} roughness={0.58} metalness={0.24} />
        </RoundedBox>
        <RoundedBox args={[2.52, 0.14, 2.1]} radius={0.025} position={[0, 2.29, 0]}>
          <meshStandardMaterial color={shellColor} roughness={0.58} metalness={0.24} />
        </RoundedBox>
        <RoundedBox args={[2.52, 0.5, 0.16]} radius={0.025} position={[0, 0.58, 1.06]}>
          <meshStandardMaterial color={shellColor} roughness={0.58} metalness={0.24} />
        </RoundedBox>
        <RoundedBox args={[2.52, 0.54, 0.16]} radius={0.025} position={[0, 2.0, 1.06]}>
          <meshStandardMaterial color={shellColor} roughness={0.58} metalness={0.24} />
        </RoundedBox>
        <RoundedBox args={[0.46, 1.44, 0.16]} radius={0.025} position={[-0.92, 1.25, 1.06]}>
          <meshStandardMaterial color={shellColor} roughness={0.58} metalness={0.24} />
        </RoundedBox>
        <RoundedBox args={[0.46, 1.44, 0.16]} radius={0.025} position={[0.92, 1.25, 1.06]}>
          <meshStandardMaterial color={shellColor} roughness={0.58} metalness={0.24} />
        </RoundedBox>

        <mesh position={[0, 2.05, 1.07]}>
          <boxGeometry args={[1.82, 0.03, 0.08]} />
          <meshStandardMaterial color={trim} metalness={0.7} roughness={0.22} />
        </mesh>
        <mesh position={[0, 0.56, 1.07]}>
          <boxGeometry args={[1.82, 0.03, 0.08]} />
          <meshStandardMaterial color={trim} metalness={0.7} roughness={0.22} />
        </mesh>

        <RoundedBox args={[0.12, 1.36, 1.46]} radius={0.025} position={[1.18, 1.49, 0.18]}>
          <meshStandardMaterial color={shellMid} roughness={0.46} metalness={0.28} />
        </RoundedBox>
        <mesh position={[1.21, 1.49, 0.18]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[1.22, 1.08]} />
          <meshPhysicalMaterial color="#8eb3c6" transparent opacity={0.15} roughness={0.06} transmission={0.56} />
        </mesh>

        <mesh position={[0, 0.67, 0.12]}>
          <boxGeometry args={[2.08, 0.08, 1.72]} />
          <meshStandardMaterial color="#202a37" roughness={0.86} metalness={0.12} />
        </mesh>

        <mesh position={[0.42, 1.74, -0.1]}>
          <boxGeometry args={[0.64, 0.62, 0.84]} />
          <meshStandardMaterial color={shellMid} roughness={0.46} metalness={0.28} />
        </mesh>
        <mesh position={[0.42, 1.48, 0.2]}>
          <cylinderGeometry args={[0.11, 0.13, 0.3, 28]} />
          <meshStandardMaterial color="#b3c3d2" roughness={0.24} metalness={0.74} />
        </mesh>

        <mesh position={[-0.25, 0.96, 0.08]}>
          <boxGeometry args={[0.22, 0.54, 0.74]} />
          <meshStandardMaterial color={shellDark} roughness={0.84} metalness={0.14} />
        </mesh>
        <mesh position={[0.25, 0.96, 0.08]}>
          <boxGeometry args={[0.22, 0.54, 0.74]} />
          <meshStandardMaterial color={shellDark} roughness={0.84} metalness={0.14} />
        </mesh>
        <mesh position={[0, 1.11, 0.08]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.42, 0.08, 18, 44]} />
          <meshStandardMaterial color="#2f4051" roughness={0.68} metalness={0.2} />
        </mesh>
        <mesh position={[0, 1.11, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.34, 0.34, 0.18, 36]} />
          <meshStandardMaterial color="#516a84" roughness={0.46} metalness={0.34} />
        </mesh>
        {[-0.16, 0, 0.16].map((slot) => (
          <mesh key={slot} position={[slot, 1.12, 0.17]}>
            <boxGeometry args={[0.024, 0.62, 0.02]} />
            <meshStandardMaterial color="#0f151e" />
          </mesh>
        ))}

        <mesh position={[-1.02, 1.52, -0.16]}>
          <boxGeometry args={[0.44, 1.2, 0.84]} />
          <meshStandardMaterial color="#d7dde4" roughness={0.56} metalness={0.22} />
        </mesh>
        {[-0.52, -0.24, 0.04, 0.32].map((toolY) => (
          <mesh key={toolY} position={[-1.24, 1.52 + toolY, -0.16]}>
            <cylinderGeometry args={[0.055, 0.055, 0.16, 18]} />
            <meshStandardMaterial color="#344555" roughness={0.4} metalness={0.56} />
          </mesh>
        ))}

        <mesh position={[0.94, 0.18, -1.14]}>
          <boxGeometry args={[0.7, 0.26, 0.56]} />
          <meshStandardMaterial color="#10161f" roughness={0.86} metalness={0.16} />
        </mesh>
        <mesh position={[0.94, 0.36, -1.14]}>
          <boxGeometry args={[0.62, 0.08, 0.48]} />
          <meshStandardMaterial color="#394b5f" roughness={0.54} metalness={0.22} />
        </mesh>

        <group position={[1.0, 1.46, 1.04]} rotation={[0, -0.22, 0]}>
          <mesh position={[-0.05, -0.3, -0.08]} rotation={[0.12, 0, 0]}>
            <boxGeometry args={[0.08, 0.6, 0.12]} />
            <meshStandardMaterial color={shellDark} roughness={0.54} metalness={0.34} />
          </mesh>
          <RoundedBox args={[0.42, 0.62, 0.07]} radius={0.02} position={[0, 0, 0]}>
            <meshStandardMaterial color="#1d2a38" roughness={0.42} metalness={0.28} />
          </RoundedBox>
          <mesh position={[0, 0.07, 0.045]}>
            <planeGeometry args={[0.28, 0.2]} />
            <meshStandardMaterial color="#2b463d" emissive="#1f352d" emissiveIntensity={0.28} />
          </mesh>
          <mesh position={[0, -0.15, 0.045]}>
            <boxGeometry args={[0.2, 0.12, 0.02]} />
            <meshStandardMaterial color="#121a24" />
          </mesh>
        </group>

        <group position={[doorX, doorBase[1], doorBase[2]]} {...partHandlers("door")}>
          <RoundedBox args={[1.22, 1.5, 0.075]} radius={0.028}>
            <meshStandardMaterial
              color={highlightIsOn("door", highlightedParts) ? "#708999" : "#4c5d6f"}
              roughness={0.38}
              metalness={0.34}
            />
          </RoundedBox>
          <mesh position={[0, 0.02, 0.048]}>
            <planeGeometry args={[0.88, 1.06]} />
            <meshPhysicalMaterial color="#9cb3c4" transparent opacity={0.16} transmission={0.68} roughness={0.06} />
          </mesh>
          <mesh position={[0.41, 0, 0.055]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.024, 0.024, 0.38, 18]} />
            <meshStandardMaterial color="#96a8b9" metalness={0.84} roughness={0.22} />
          </mesh>
        </group>
      </group>

      <group position={airValvePos} {...partHandlers("air_valve")}>
        <mesh position={[0, -0.18, 0]}>
          <cylinderGeometry args={[0.046, 0.064, 0.34, 18]} />
          <meshStandardMaterial color="#334350" roughness={0.72} metalness={0.18} />
        </mesh>
        <ValveWheel
          active={machine.airValveOpen}
          highlight={highlightIsOn("air_valve", highlightedParts)}
          color={machine.airValveOpen ? accent : warning}
        />
      </group>

      <group position={coolantValvePos} {...partHandlers("coolant_toggle")}>
        <mesh position={[0, -0.16, 0]}>
          <cylinderGeometry args={[0.05, 0.07, 0.3, 18]} />
          <meshStandardMaterial color="#21303d" roughness={0.74} metalness={0.2} />
        </mesh>
        <ValveWheel
          active={machine.coolantOn}
          highlight={highlightIsOn("coolant_toggle", highlightedParts)}
          color={machine.coolantOn ? "#73a8c7" : "#7e909f"}
        />
      </group>

      <CoolantVoxels active={machine.coolantOn} />

      <group position={panelAnchor} {...partHandlers("panel")}>
        <mesh position={[0, -1.02, -0.16]} rotation={[0.26, 0, 0]}>
          <cylinderGeometry args={[0.085, 0.11, 0.9, 18]} />
          <meshStandardMaterial color="#263443" roughness={0.56} metalness={0.28} />
        </mesh>
        <mesh position={[0, -0.8, -0.02]}>
          <boxGeometry args={[0.5, 0.12, 0.3]} />
          <meshStandardMaterial color="#111822" roughness={0.9} metalness={0.12} />
        </mesh>
        <RoundedBox args={[1.08, 1.92, 0.18]} radius={0.03}>
          <meshStandardMaterial
            color={highlightIsOn("panel", highlightedParts) ? "#202d3a" : "#151d27"}
            roughness={0.54}
            metalness={0.26}
          />
        </RoundedBox>

        <RoundedBox args={[0.78, 0.5, 0.03]} radius={0.02} position={[0, 0.51, 0.1]}>
          <meshStandardMaterial color="#0f151e" roughness={0.3} metalness={0.26} />
        </RoundedBox>
        <mesh position={[0, 0.51, 0.125]} {...partHandlers("diagnostics_panel")}>
          <planeGeometry args={[0.7, 0.42]} />
          <meshStandardMaterial
            color={machine.diagnosticsOpen ? "#84b999" : "#2e404b"}
            emissive={machine.diagnosticsOpen ? "#365840" : "#16232c"}
            emissiveIntensity={machine.diagnosticsOpen ? 0.7 : 0.25}
          />
        </mesh>
        <Text position={[0, 0.63, 0.15]} fontSize={0.05} color="#edf1f5" anchorX="center" anchorY="middle">
          {machine.diagnosticsOpen ? "SYSTEM READY" : "DIAGNOSTICS"}
        </Text>
        <Text position={[0, 0.47, 0.15]} fontSize={0.033} color="#d4dde7" anchorX="center" anchorY="middle">
          {machine.powerOn ? "POWER ONLINE" : "POWER OFF"}
        </Text>

        {[0, 1, 2, 3].flatMap((row) =>
          [0, 1, 2].map((col) => {
            const x = -0.26 + col * 0.19;
            const y = -0.04 - row * 0.15;
            return (
              <RoundedBox key={`${row}-${col}`} args={[0.12, 0.085, 0.022]} radius={0.014} position={[x, y, 0.1]}>
                <meshStandardMaterial color="#2a3948" roughness={0.5} metalness={0.18} />
              </RoundedBox>
            );
          }),
        )}

        <group position={[0.17, 0.18, 0.18]} {...partHandlers("power_button")}>
          <RoundButtonControl
            label="ON"
            active={machine.powerOn}
            highlight={highlightIsOn("power_button", highlightedParts)}
            color={accent}
          />
        </group>

        <group position={[-0.15, 0.18, 0.18]} {...partHandlers("power_off")}>
          <RoundButtonControl
            label="OFF"
            active={false}
            highlight={highlightIsOn("power_off", highlightedParts)}
            color="#8494a3"
          />
        </group>

        <group position={[0.3, 0.18, 0.23]} rotation={[0, 0, emergencyRotate]} {...partHandlers("emergency_button")}>
          <mesh position={[0, 0, -0.02]}>
            <cylinderGeometry args={[0.13, 0.13, 0.04, 28]} />
            <meshStandardMaterial color="#d6b54b" roughness={0.62} metalness={0.14} />
          </mesh>
          <mesh position={[0, 0, emergencyLift + 0.02]}>
            <sphereGeometry args={[0.09, 28, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial
              color={machine.emergencyReleased ? "#dfb877" : danger}
              emissive={highlightIsOn("emergency_button", highlightedParts) ? "#73413b" : "#000000"}
              emissiveIntensity={highlightIsOn("emergency_button", highlightedParts) ? 0.25 : 0}
              roughness={0.32}
              metalness={0.06}
            />
          </mesh>
        </group>

        <group position={[-0.22, -0.49, 0.18]} {...partHandlers("handle_jog")}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.13, 0.024, 16, 32]} />
            <meshStandardMaterial color="#bac8d5" metalness={0.72} roughness={0.2} />
          </mesh>
          <mesh rotation={[0, 0, machine.handleJogPressed ? Math.PI / 3 : 0]}>
            <boxGeometry args={[0.16, 0.024, 0.024]} />
            <meshStandardMaterial color="#eef2f7" metalness={0.68} roughness={0.16} />
          </mesh>
        </group>

        <group position={[0.24, -0.53, 0.2]} {...partHandlers("cycle_start")}>
          <RectControlButton
            label="START"
            color="#6f9d78"
            highlight={highlightIsOn("cycle_start", highlightedParts)}
          />
        </group>

        <group position={[0.01, -0.53, 0.2]} {...partHandlers("feed_hold")}>
          <RectControlButton
            label="HOLD"
            color="#b17061"
            highlight={highlightIsOn("feed_hold", highlightedParts)}
          />
        </group>

        <group position={[0.25, -0.83, 0.19]} {...partHandlers("mode_selector")}>
          <ModeSelectorKnob highlight={highlightIsOn("mode_selector", highlightedParts)} />
          <Text position={[0, 0.13, 0.02]} fontSize={0.028} color="#d8dfe6" anchorX="center" anchorY="middle">
            MODE
          </Text>
        </group>
      </group>
    </group>
  );
}
