import type { DeviceMode } from "@/entities/machine/machine-types";

/**
 * Where an AR trainee stands to the machine, as in the first AR version: the
 * machine is simply there on the floor in front of them when the session
 * starts, facing them — no placing step. Closer than it was: the pendant's
 * face is 1.32 m in front of the machine's centre (build_umc500.py), so a
 * centre 1.85 m away puts the keys at arm's length. The machine sits a little
 * to the left, so the door and the pendant (right of centre) are ahead.
 */
export const AR_STAND = { distance: 1.85, side: 0.3 } as const;

/** The AR trainee's spot in the machine's own frame (front towards +z). */
export const AR_STAND_IN_MACHINE: [number, number] = [AR_STAND.side, AR_STAND.distance];

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
      return [-AR_STAND.side, 0, -AR_STAND.distance];
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
      return { position: [1.4, 1.9, 2.0], target: [-AR_STAND.side, 1.2, -AR_STAND.distance], fov: 60 };
    default:
      // Orbit pivot between the door and the pendant, at chest height.
      return { position: [2.9, 2.2, 4.6], target: [0.2, 1.3, 0.6], fov: 45 };
  }
}
