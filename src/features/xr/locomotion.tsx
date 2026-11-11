"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { XRSpace, useXRInputSourceState, type XRControllerState } from "@react-three/xr";
import * as THREE from "three";
import { pulse } from "./haptics";
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
 * always works. Teleport: a stick pushed forward aims an arc, let go to land
 * (StickTeleport); the right stick sideways snap-turns. Joystick: the left
 * stick walks where the head looks, sliding along what `slide` says is in
 * the way, the right stick snap-turns. Walk: nothing but the trainee's feet.
 * The trigger is never movement: it always presses what the ray points at.
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
    const ty = right?.gamepad?.[STICK]?.yAxis ?? 0;
    // Stick mostly forward is aiming a teleport (StickTeleport), not a turn.
    if (Math.abs(tx) < DEAD_ZONE || Math.abs(ty) > Math.abs(tx)) canTurn.current = true;
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

/** The arc: thrown from the controller at this speed, m/s, under gravity. */
const ARC_SPEED = 7;
const ARC_STEP_S = 0.025;
const ARC_POINTS = 64;
const AIM_ON = -0.6;
const AIM_OFF = -0.25;
const ARC_OK = new THREE.Color("#4ade80");
const ARC_NO = new THREE.Color("#f87171");

/**
 * Teleport, the way Quest apps do it: push a stick forward and an arc from
 * that controller shows where you would land (green where you can stand, red
 * where you cannot); let the stick go to jump there. Nothing else moves you,
 * so the trigger is free to press what its ray points at — pmndrs' own
 * teleport pointer shares the trigger with the ray, and whichever hits
 * nearer wins: aimed at the machine, the arc's landing on the floor in front
 * of it was nearer, and the trigger teleported instead of pressing.
 *
 * Must be inside the XROrigin: the controller's space is the origin's.
 */
export function StickTeleport({
  originRef,
  canStand,
}: {
  originRef: React.RefObject<THREE.Group | null>;
  /** Whether the trainee can stand at a floor point (plan x, z). */
  canStand: (p: Vec2) => boolean;
}) {
  const movement = useSessionStore((s) => s.xrMovement);
  const left = useXRInputSourceState("controller", "left");
  const right = useXRInputSourceState("controller", "right");
  if (movement !== "teleport") return null;
  return (
    <>
      {left && <ControllerTeleport state={left} originRef={originRef} canStand={canStand} />}
      {right && <ControllerTeleport state={right} originRef={originRef} canStand={canStand} />}
    </>
  );
}

function ControllerTeleport({
  state,
  originRef,
  canStand,
}: {
  state: XRControllerState;
  originRef: React.RefObject<THREE.Group | null>;
  canStand: (p: Vec2) => boolean;
}) {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const ray = useRef<THREE.Group>(null);
  const aiming = useRef(false);
  const landing = useRef<THREE.Vector3 | null>(null);

  const { line, ring } = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(ARC_POINTS * 3), 3));
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: ARC_OK, depthTest: false }));
    line.frustumCulled = false;
    line.visible = false;
    line.renderOrder = 10;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.26, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: ARC_OK, depthTest: false, transparent: true, opacity: 0.9 }),
    );
    ring.visible = false;
    ring.renderOrder = 10;
    return { line, ring };
  }, []);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
    },
    [line, ring],
  );

  const p = useMemo(() => new THREE.Vector3(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);

  useFrame(() => {
    const stick = state.gamepad?.[STICK];
    const x = stick?.xAxis ?? 0;
    const y = stick?.yAxis ?? 0;
    const hide = () => {
      line.visible = false;
      ring.visible = false;
    };

    if (y < AIM_ON && Math.abs(y) > Math.abs(x) && ray.current) {
      aiming.current = true;
      // Throw from the controller's pointing ray, forward is its −z.
      ray.current.getWorldPosition(p);
      ray.current.getWorldQuaternion(q);
      v.set(0, 0, -1).applyQuaternion(q).multiplyScalar(ARC_SPEED);
      const positions = line.geometry.getAttribute("position") as THREE.BufferAttribute;
      let landed: THREE.Vector3 | null = null;
      let i = 0;
      for (; i < ARC_POINTS; i++) {
        positions.setXYZ(i, p.x, p.y, p.z);
        const next = p.clone().addScaledVector(v, ARC_STEP_S);
        v.y -= 9.81 * ARC_STEP_S;
        if (next.y <= 0 && p.y > 0) {
          // Down through the floor between p and next: land where it crossed.
          landed = p.clone().lerp(next, p.y / (p.y - next.y));
          landed.y = 0;
          positions.setXYZ(++i < ARC_POINTS ? i : ARC_POINTS - 1, landed.x, 0, landed.z);
          break;
        }
        p.copy(next);
      }
      // Fold the unused points onto the last one.
      const [lx, ly, lz] = [positions.getX(Math.min(i, ARC_POINTS - 1)), positions.getY(Math.min(i, ARC_POINTS - 1)), positions.getZ(Math.min(i, ARC_POINTS - 1))];
      for (let k = i + 1; k < ARC_POINTS; k++) positions.setXYZ(k, lx, ly, lz);
      positions.needsUpdate = true;

      const ok = landed !== null && canStand([landed.x, landed.z]);
      landing.current = ok ? landed : null;
      const color = ok ? ARC_OK : ARC_NO;
      (line.material as THREE.LineBasicMaterial).color.copy(color);
      (ring.material as THREE.MeshBasicMaterial).color.copy(color);
      line.visible = true;
      ring.visible = landed !== null;
      if (landed) ring.position.copy(landed).setY(0.01);
      return;
    }

    if (aiming.current && y > AIM_OFF) {
      aiming.current = false;
      hide();
      if (landing.current) {
        teleportTo(originRef.current, landing.current, camera);
        pulse("detent");
      }
      landing.current = null;
    } else if (!aiming.current) {
      hide();
    }
  });

  return (
    <>
      <XRSpace space={state.inputSource.targetRaySpace}>
        <group ref={ray} />
      </XRSpace>
      {createPortal(
        <>
          <primitive object={line} />
          <primitive object={ring} />
        </>,
        scene,
      )}
    </>
  );
}

/** A SlideFn for an open floor with one box on it, wherever the box is now —
 *  AR, where the room is the trainee's own and only the machine is in the way. */
export const slideAroundBox =
  (box: () => FloorBox | null): SlideFn =>
  (from, step) =>
    slideAround(box(), from, step);
