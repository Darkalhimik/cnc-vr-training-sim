import * as THREE from "three";

/**
 * What @react-three/xr's pointer events carry beyond R3F's own: which kind of
 * pointer it is ("grab" for a controller squeeze or a hand pinch close up,
 * "touch" for a fingertip, "ray" for a pointing ray) and the pose of the hand
 * or controller doing it. A desktop mouse event has none of these.
 */
type XrPointerFields = {
  pointerType?: string;
  pointerPosition?: THREE.Vector3;
  pointerQuaternion?: THREE.Quaternion;
  target?: unknown;
};

const UNIT = new THREE.Vector3(1, 1, 1);

export const isGrab = (event: unknown) => (event as XrPointerFields).pointerType === "grab";

/** The grabbing hand's pose as a world matrix, or null for any other pointer. */
export function grabPose(event: unknown): THREE.Matrix4 | null {
  const e = event as XrPointerFields;
  if (e.pointerType !== "grab" || !e.pointerPosition || !e.pointerQuaternion) return null;
  return new THREE.Matrix4().compose(e.pointerPosition, e.pointerQuaternion, UNIT);
}

/** Keep the pointer's events coming to the object it grabbed, wherever it goes. */
export function capture(event: unknown, pointerId: number) {
  const target = (event as XrPointerFields).target as THREE.Object3D | undefined;
  target?.setPointerCapture?.(pointerId);
}

/**
 * The machine's part is in the trainee's hand. It stays clamped underneath —
 * only hidden — so a program must not start until it is back in the vise or
 * on a shelf.
 */
export const partInHand = { current: false };
