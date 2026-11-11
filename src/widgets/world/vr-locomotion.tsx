"use client";

import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { XROrigin, useXR } from "@react-three/xr";
import type * as THREE from "three";
import { slide, stationById } from "@/entities/world/layout";
import { EYE_HEIGHT, WORLD, useWorldStore } from "@/features/world/world-store";
import { XrLocomotion } from "@/features/xr/locomotion";

export { teleportTo } from "@/features/xr/locomotion";

/** XROrigin's turn for a plan yaw: the headset looks down the origin's −z. */
const originYaw = (yaw: number) => yaw + Math.PI;

const slideInWorkshop = (from: [number, number], step: [number, number]) => slide(WORLD, from, step);

/**
 * Moving around the workshop in VR glasses: the movement the trainee chose
 * (teleport, walk or joystick — XrLocomotion), sliding along the workshop's
 * walls and machines. A travel request — Start on the level terminal — jumps
 * straight to the station.
 */
export function VrLocomotion({ originRef }: { originRef: React.RefObject<THREE.Group | null> }) {
  const travel = useWorldStore((s) => s.travel);

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

  return <XrLocomotion originRef={originRef} slide={slideInWorkshop} />;
}

/** The player's rig, placed where the world store says they stand; what
 *  rides with them (the wrist menu) goes inside. */
export function PlayerOrigin({
  originRef,
  children,
}: {
  originRef: React.RefObject<THREE.Group | null>;
  children?: React.ReactNode;
}) {
  const { position, yaw } = useWorldStore.getState().player;
  return (
    <XROrigin ref={originRef} position={[position[0], 0, position[1]]} rotation={[0, originYaw(yaw), 0]}>
      {children}
    </XROrigin>
  );
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
