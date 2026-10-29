"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { XROrigin, useXR, useXRInputSourceState } from "@react-three/xr";
import * as THREE from "three";
import { slide, stationById, type Vec2 } from "@/entities/world/layout";
import { EYE_HEIGHT, WORLD, useWorldStore } from "@/features/world/world-store";

const SPEED = 1.5;
const DEAD_ZONE = 0.2;
/** Snap turns: comfortable for most people, unlike smooth turning. */
const SNAP = THREE.MathUtils.degToRad(30);
const STICK = "xr-standard-thumbstick";

/** XROrigin's turn for a plan yaw: the headset looks down the origin's −z. */
const originYaw = (yaw: number) => yaw + Math.PI;

/**
 * Moving around the workshop in a headset. Walking in the real room always
 * works; beyond it, the left stick moves (sliding along walls and machines),
 * the right stick snap-turns, and the teleport arc lands on any floor. A
 * travel request — Start on the level terminal — jumps straight to the
 * station.
 */
export function VrLocomotion({ originRef }: { originRef: React.RefObject<THREE.Group | null> }) {
  const left = useXRInputSourceState("controller", "left");
  const right = useXRInputSourceState("controller", "right");
  const travel = useWorldStore((s) => s.travel);
  const canTurn = useRef(true);
  const heading = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();

  useEffect(() => {
    if (!travel) return;
    const s = stationById(WORLD, travel.stationId);
    const origin = originRef.current;
    if (!s || !origin) return;
    origin.position.set(s.stand.position[0], 0, s.stand.position[1]);
    origin.rotation.set(0, originYaw(s.stand.yaw), 0);
    useWorldStore.getState().arrive(s.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on a new request
  }, [travel?.seq]);

  useFrame((state, dt) => {
    const origin = originRef.current;
    if (!origin) return;
    const move = left?.gamepad?.[STICK];
    const turn = right?.gamepad?.[STICK];

    const tx = turn?.xAxis ?? 0;
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

    const mx = move?.xAxis ?? 0;
    const my = move?.yAxis ?? 0;
    if (Math.hypot(mx, my) > DEAD_ZONE) {
      // Stick forward walks where the head looks, levelled.
      state.camera.getWorldQuaternion(quaternion);
      heading.set(mx, 0, my).applyQuaternion(quaternion).setY(0).normalize().multiplyScalar(SPEED * Math.min(dt, 0.05) * Math.hypot(mx, my));
      const head = state.camera.getWorldPosition(new THREE.Vector3());
      const next = slide(WORLD, [head.x, head.z], [heading.x, heading.z]);
      origin.position.x += next[0] - head.x;
      origin.position.z += next[1] - head.z;
    }
  });

  return null;
}

/** The player's rig, placed where the world store says they stand. */
export function PlayerOrigin({ originRef }: { originRef: React.RefObject<THREE.Group | null> }) {
  const { position, yaw } = useWorldStore.getState().player;
  return <XROrigin ref={originRef} position={[position[0], 0, position[1]]} rotation={[0, originYaw(yaw), 0]} />;
}

/** Teleport lands here: the origin moves so the head ends up over the point. */
export function teleportTo(origin: THREE.Group | null, point: THREE.Vector3, camera: THREE.Camera) {
  if (!origin) return;
  const head = camera.getWorldPosition(new THREE.Vector3());
  const p: Vec2 = [point.x, point.z];
  origin.position.x += p[0] - head.x;
  origin.position.z += p[1] - head.z;
}

/**
 * Before the headset session starts, the page shows what it will: the view
 * from where the player stands, at eye height. In the session the headset
 * drives the camera.
 */
export function PreviewCamera({ originRef }: { originRef: React.RefObject<THREE.Group | null> }) {
  const session = useXR((s) => s.session);
  useFrame(({ camera }) => {
    const origin = originRef.current;
    if (session || !origin) return;
    camera.position.set(origin.position.x, EYE_HEIGHT, origin.position.z);
    camera.rotation.set(-0.08, origin.rotation.y, 0, "YXZ");
  });
  return null;
}
