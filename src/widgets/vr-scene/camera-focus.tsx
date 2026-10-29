"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { useSessionStore } from "@/features/session/session-store";

type OrbitLike = { target: Vector3; update: () => void };

/** Viewing distance: close for a pendant key, further for the door or a valve. */
const distanceFor = (arrowScale: number) => (arrowScale < 0.8 ? 0.6 : 1.5);

/**
 * Flies the desktop camera to a part on request, from the side its anchor
 * faces — so "show me" on the air valve swings round to the rear panel instead
 * of asking the trainee to find it.
 */
export function CameraFocus() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as OrbitLike | null;
  const scene = useThree((s) => s.scene);
  const request = useSessionStore((s) => s.cameraFocus);
  const flight = useRef<{ position: Vector3; target: Vector3 } | null>(null);

  useEffect(() => {
    if (!request) return;
    const anchor = scene.getObjectByName(`Anchor_${request.part}`);
    if (!anchor) return;
    const target = anchor.getWorldPosition(new Vector3());
    // Anchor +Y points out of the surface the part sits on, +X along it.
    // Standing a little up and to one side keeps the guide arrow readable as
    // an arrow; straight down its axis it is a dot.
    const out = new Vector3(0, 1, 0).transformDirection(anchor.matrixWorld);
    const along = new Vector3(1, 0, 0).transformDirection(anchor.matrixWorld);
    const distance = distanceFor(Number(anchor.userData.arrowScale ?? 1));
    const position = target
      .clone()
      .addScaledVector(out, distance)
      .addScaledVector(along, distance * 0.35)
      .add(new Vector3(0, distance * 0.3, 0));
    flight.current = { position, target };
  }, [request, scene]);

  useFrame((_, dt) => {
    const f = flight.current;
    if (!f || !controls) return;
    const k = 1 - Math.exp(-dt * 4);
    camera.position.lerp(f.position, k);
    controls.target.lerp(f.target, k);
    controls.update();
    if (camera.position.distanceTo(f.position) < 0.005) flight.current = null;
  });

  // A drag takes the camera back.
  useEffect(() => {
    const stop = () => (flight.current = null);
    window.addEventListener("pointerdown", stop);
    window.addEventListener("wheel", stop);
    return () => {
      window.removeEventListener("pointerdown", stop);
      window.removeEventListener("wheel", stop);
    };
  }, []);

  return null;
}
