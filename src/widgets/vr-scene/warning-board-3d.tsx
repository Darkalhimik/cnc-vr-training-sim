"use client";

import { RoundedBox, Text } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import {
  type NotificationVariant,
  useNotifications,
} from "@/shared/lib/notifications";
import { PANEL, TONE } from "./panel-theme";

const PANEL_W = 1.6;
const PANEL_H = 0.44;
const PANEL_DEPTH = 0.04;

const noopRaycast: NonNullable<ThreeEvent<MouseEvent>>["object"]["raycast"] = () => {};

/** Same mapping the DOM tones use, resolved to hex for three.js materials. */
const TONE_FOR: Record<NotificationVariant, string> = {
  success: TONE.emerald,
  info: TONE.sky,
  warning: TONE.amber,
  error: TONE.rose,
};

/**
 * The in-scene counterpart of the DOM toasts.
 *
 * In an immersive session the DOM HUD is invisible, so a rejected interaction
 * or a tutorial safety violation reached the trainee in no modality at all.
 * This board shows the most recent one beside the machine, in the tone the
 * DOM surface would have used.
 */
export function WarningBoard3D() {
  const items = useNotifications((s) => s.items);
  const latest = items[items.length - 1];

  if (!latest) return null;

  const tone = TONE_FOR[latest.variant] ?? TONE.amber;
  const surfaceZ = PANEL_DEPTH / 2 + 0.001;

  return (
    <group>
      <RoundedBox args={[PANEL_W, PANEL_H, PANEL_DEPTH]} radius={0.04} raycast={noopRaycast}>
        <meshStandardMaterial color={PANEL.surface} roughness={0.65} metalness={0.05} />
      </RoundedBox>

      {/* The tone rides the frame, not the text background — same rule the DOM
          pills follow, so the message itself stays maximally readable. */}
      <RoundedBox
        args={[PANEL_W + 0.012, PANEL_H + 0.012, PANEL_DEPTH * 0.95]}
        radius={0.04}
        raycast={noopRaycast}
      >
        <meshBasicMaterial color={tone} wireframe />
      </RoundedBox>

      <mesh position={[-PANEL_W / 2 + 0.05, 0, surfaceZ]} raycast={noopRaycast}>
        <planeGeometry args={[0.02, PANEL_H - 0.1]} />
        <meshBasicMaterial color={tone} />
      </mesh>

      <Text
        position={[-PANEL_W / 2 + 0.12, 0, surfaceZ]}
        fontSize={0.052}
        color={PANEL.text}
        anchorX="left"
        anchorY="middle"
        maxWidth={PANEL_W - 0.22}
        lineHeight={1.3}
      >
        {latest.message}
      </Text>
    </group>
  );
}
