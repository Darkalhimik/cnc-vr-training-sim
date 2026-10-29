import type { DeviceMode } from "@/entities/machine/machine-types";

/**
 * Where the machine stands in each mode. The model is at real scale with its
 * footprint centred on the origin and the operator's side towards +z; the
 * pendant sits about 0.6 m right of centre, so immersive modes shift the
 * machine left to put the door and pendant in front of the user.
 */
export function getSceneGroupPosition(mode: DeviceMode): [number, number, number] {
  switch (mode) {
    case "vr":
      return [-0.25, 0, -2.6];
    case "glasses":
    case "phone":
      return [-0.25, 0, -2.8];
    default:
      return [0, 0, 0];
  }
}

/**
 * The camera before an immersive session starts (and always on desktop, where
 * OrbitControls takes over the aim). R3F points a fresh camera at the origin,
 * which in VR and AR is where the user stands, not where the machine is — so
 * the preview aims explicitly.
 */
export function getPreviewCamera(mode: DeviceMode): {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
} {
  switch (mode) {
    case "vr":
      return { position: [1.4, 1.9, 2.2], target: [-0.1, 1.2, -1.6], fov: 60 };
    case "glasses":
    case "phone":
      return { position: [1.4, 1.9, 2.0], target: [-0.1, 1.2, -1.8], fov: 60 };
    default:
      // Orbit pivot between the door and the pendant, at chest height.
      return { position: [2.9, 2.2, 4.6], target: [0.2, 1.3, 0.6], fov: 45 };
  }
}
