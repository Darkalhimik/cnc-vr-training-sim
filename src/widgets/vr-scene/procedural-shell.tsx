"use client";

import { RoundedBox } from "@react-three/drei";

const shellColor = "#cfd7e0";
const shellDark = "#18222f";
const shellMid = "#314251";
const trim = "#8f9fad";

export function ProceduralShell() {
  return (
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
    </group>
  );
}
