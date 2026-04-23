import type { DeviceMode } from "@/entities/machine/machine-types";
import {
  MACHINE_PART_POSITIONS,
  type MachinePartId,
} from "@/entities/machine/machine-parts";

const CONTROL_PARTS = new Set<MachinePartId>([
  "panel",
  "power_button",
  "power_off",
  "emergency_button",
  "handle_jog",
  "diagnostics_panel",
  "cycle_start",
  "feed_hold",
  "mode_selector",
]);

const CONTROL_OFFSETS: Record<DeviceMode, [number, number, number]> = {
  desktop: [0, 0, 0],
  vr: [-1.46, -0.02, -1.06],
  ar: [-0.78, -0.12, -0.48],
};

const COOLANT_OFFSETS: Record<DeviceMode, [number, number, number]> = {
  desktop: [0, 0, 0],
  vr: [-0.65, 0, -0.42],
  ar: [-0.35, -0.12, -0.18],
};

export function getPartPosition(
  partId: MachinePartId,
  mode: DeviceMode,
): [number, number, number] {
  const base = MACHINE_PART_POSITIONS[partId];

  if (CONTROL_PARTS.has(partId)) {
    const offset = CONTROL_OFFSETS[mode];
    return [base[0] + offset[0], base[1] + offset[1], base[2] + offset[2]];
  }

  if (partId === "coolant_toggle") {
    const offset = COOLANT_OFFSETS[mode];
    return [base[0] + offset[0], base[1] + offset[1], base[2] + offset[2]];
  }

  return base;
}

export function getSceneGroupPosition(mode: DeviceMode): [number, number, number] {
  switch (mode) {
    case "vr":
      return [0, -0.72, -3.1];
    case "ar":
      return [0, -1.02, -2.55];
    default:
      return [0, -0.46, 0];
  }
}

export function getPreviewCamera(mode: DeviceMode): {
  position: [number, number, number];
  fov: number;
} {
  switch (mode) {
    case "vr":
      return { position: [3.1, 2.25, 4.7], fov: 46 };
    case "ar":
      return { position: [4.0, 2.4, 5.3], fov: 44 };
    default:
      return { position: [5.3, 2.6, 5.8], fov: 41 };
  }
}
