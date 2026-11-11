"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useXRInputSourceState } from "@react-three/xr";
import * as THREE from "three";
import { slideAround, type FloorBox, type Vec2 } from "@/entities/world/layout";

export type { FloorBox };
import { useSessionStore } from "@/features/session/session-store";

/** Moves a walker from `from` by `step`, sliding along whatever is in the way. */
export type SlideFn = (from: Vec2, step: Vec2) => Vec2;

const SPEED = 1.5;
const DEAD_ZONE = 0.2;
/** Snap turns: comfortable for most people, unlike smooth turning. */
const SNAP = THREE.MathUtils.degToRad(30);
const STICK = "xr-standard-thumbstick";

/**
 * Getting about in VR or AR glasses beyond the trainee's own steps, as the
 * movement setting says (session-store XrMovement). Walking in the real room
 * always works. Teleport: the arc lands on whatever floor is a teleport
 * target (teleportTo), the right stick snap-turns. Joystick: the left stick
 * walks where the head looks, sliding along what `slide` says is in the way,
 * the right stick snap-turns. Walk: nothing but the trainee's feet.
 */
export function XrLocomotion({ originRef, slide }: { originRef: React.RefObject<THREE.Group | null>; slide: SlideFn }) {
  const left = useXRInputSourceState("controller", "left");
  const right = useXRInputSourceState("controller", "right");
  const movement = useSessionStore((s) => s.xrMovement);
  const canTurn = useRef(true);
  const heading = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();

  useFrame((state, dt) => {
    const origin = originRef.current;
    if (!origin || movement === "walk") return;

    const tx = right?.gamepad?.[STICK]?.xAxis ?? 0;
    if (Math.abs(tx) < DEAD_ZONE) canTurn.current = true;
    else if (canTurn.current) {
      canTurn.current = false;
      // Turn about the head, not the origin, so the view does not swing sideways.
      const head = state.camera.getWorldPosition(new THREE.Vector3());
      const angle = tx > 0 ? -SNAP : SNAP;
      const offset = origin.position.clone().sub(head).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      origin.position.copy(head.add(offset)).setY(0);
      origin.rotation.y += angle;
    }

    if (movement !== "joystick") return;
    const move = left?.gamepad?.[STICK];
    const mx = move?.xAxis ?? 0;
    const my = move?.yAxis ?? 0;
    if (Math.hypot(mx, my) > DEAD_ZONE) {
      // Stick forward walks where the head looks, levelled.
      state.camera.getWorldQuaternion(quaternion);
      heading.set(mx, 0, my).applyQuaternion(quaternion).setY(0).normalize().multiplyScalar(SPEED * Math.min(dt, 0.05) * Math.hypot(mx, my));
      const head = state.camera.getWorldPosition(new THREE.Vector3());
      const next = slide([head.x, head.z], [heading.x, heading.z]);
      origin.position.x += next[0] - head.x;
      origin.position.z += next[1] - head.z;
    }
  });

  return null;
}

/** Teleport lands here: the origin moves so the head ends up over the point. */
export function teleportTo(origin: THREE.Group | null, point: THREE.Vector3, camera: THREE.Camera) {
  if (!origin) return;
  const head = camera.getWorldPosition(new THREE.Vector3());
  origin.position.x += point.x - head.x;
  origin.position.z += point.z - head.z;
}

/** A SlideFn for an open floor with one box on it, wherever the box is now —
 *  AR, where the room is the trainee's own and only the machine is in the way. */
export const slideAroundBox =
  (box: () => FloorBox | null): SlideFn =>
  (from, step) =>
    slideAround(box(), from, step);
