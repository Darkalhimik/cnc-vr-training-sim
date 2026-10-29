"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, type Object3D } from "three";
import { useSessionStore } from "@/features/session/session-store";

type OrbitLike = { target: Vector3; update: () => void };

/** Viewing distance: close for a pendant key, further for the door or a valve. */
const distanceFor = (arrowScale: number) => (arrowScale < 0.8 ? 0.6 : arrowScale > 1.5 ? 1.25 : 1.5);

/** Where to put the camera to look at `anchor`, and what to look at. */
function framing(anchor: Object3D) {
  anchor.updateWorldMatrix(true, false);
  const target = anchor.getWorldPosition(new Vector3());
  // Anchor +Y points out of the surface the part sits on, +X along it.
  // Standing a little up and to one side keeps the guide arrow readable as an
  // arrow; straight down its axis it is a dot. A panel to read is framed
  // square on instead.
  const out = new Vector3(0, 1, 0).transformDirection(anchor.matrixWorld);
  const along = new Vector3(1, 0, 0).transformDirection(anchor.matrixWorld);
  const distance = distanceFor(Number(anchor.userData.arrowScale ?? 1));
  const frontal = Boolean(anchor.userData.frontal);
  const position = target
    .clone()
    .addScaledVector(out, distance)
    .addScaledVector(along, frontal ? 0 : distance * 0.35)
    .add(new Vector3(0, frontal ? 0 : distance * 0.3, 0));
  return { position, target };
}

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
  /** Requested node, resolved on the next frames: what it names may mount
   *  a commit after the request (the full panel opens and asks at once). */
  const pending = useRef<{ node: string; until: number } | null>(null);

  useEffect(() => {
    if (request) pending.current = { node: request.node, until: performance.now() + 1000 };
  }, [request]);

  useFrame((_, dt) => {
    const p = pending.current;
    if (p) {
      const anchor = scene.getObjectByName(p.node);
      if (anchor) {
        pending.current = null;
        flight.current = framing(anchor);
      } else if (performance.now() > p.until) {
        pending.current = null;
      }
    }

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
