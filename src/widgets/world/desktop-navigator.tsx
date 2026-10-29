"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { roomAt, slide, stationById, type Station, type Vec2 } from "@/entities/world/layout";
import { useWarehouseStore } from "@/features/warehouse/warehouse-api";
import { useSessionStore } from "@/features/session/session-store";
import { EYE_HEIGHT, WORLD, useWorldStore } from "@/features/world/world-store";
import { useProgramEditor } from "@/widgets/gcode-editor";
import { partSlot } from "@/widgets/warehouse-scene/warehouse-scene";
import { cartSlot, cribSlot } from "@/widgets/tooling/tool-racks";
import { CameraFocus } from "@/widgets/vr-scene/camera-focus";

/** Walking speed, m/s; Shift runs. */
const WALK = 1.6;
const RUN = 3.2;
/** Radians per pixel of mouse drag. */
const LOOK = 0.0035;
/** A walk to a station: seconds per room crossed. */
const TRAVEL_S = 1.1;
/** The shop door, at eye height: where a walk between rooms passes. */
const DOORWAY = new THREE.Vector3(0, EYE_HEIGHT, 0);

type Pose = { position: THREE.Vector3; target: THREE.Vector3 };

/** Plan point + height, for a station's frame. */
const at = (p: Vec2, y = 0) => new THREE.Vector3(p[0], y, p[1]);

/** What a station is looked at: where its interesting part is. */
function lookTarget(s: Station): THREE.Vector3 {
  switch (s.kind) {
    case "machine":
      return at(s.position, 1.25);
    case "warehouse":
      return at(s.position, 1.1);
    case "toolbox":
      return at(s.position, 1.05);
    case "toolcart":
      return at(s.position, 0.85);
    case "terminal":
      return at(s.position, 1.8);
    default:
      return at(s.position, 1.6);
  }
}

/** Standing at a station, eyes level, looking at it. */
function standPose(s: Station): Pose {
  return { position: at(s.stand.position, EYE_HEIGHT), target: lookTarget(s) };
}

/** A point in a station's frame (front towards +z) in the world. */
function stationPoint(s: Station, local: THREE.Vector3) {
  return local.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw).add(at(s.position));
}

function isTyping(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  return target instanceof Element && !!target.closest("input, textarea, select, [contenteditable=true], .cm-editor");
}

/**
 * The desktop camera in the workshop. Walking: WASD or the arrows to move,
 * drag to look, Shift to run, colliding with walls and machines. A station
 * clicked or chosen from the panel is walked to on its own; there the view
 * becomes the station's — orbiting a machine, facing the warehouse or the
 * terminal — until Esc or a walking key leaves it.
 */
export function DesktopNavigator() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const view = useWorldStore((s) => s.view);
  const travel = useWorldStore((s) => s.travel);
  const selectedPart = useWorldStore((s) => s.selectedPart);
  const selectedTool = useWorldStore((s) => s.selectedTool);
  const parts = useWarehouseStore((s) => s.parts);
  const keys = useRef(new Set<string>());
  const look = useRef({ yaw: useWorldStore.getState().player.yaw, pitch: -0.05 });
  const flight = useRef<{
    from: Pose;
    to: Pose;
    /** Through the door when the walk changes rooms. */
    via: THREE.Vector3 | null;
    start: number;
    seconds: number;
    arrive: string | null;
  } | null>(null);
  const station = view.kind === "station" ? stationById(WORLD, view.id) : null;

  /** The camera's pose now, as position and a point a metre ahead. */
  const currentPose = (): Pose => {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    return { position: camera.position.clone(), target: camera.position.clone().add(dir) };
  };
  const fly = (to: Pose, arrive: string | null) => {
    const from = currentPose();
    const room = (p: THREE.Vector3) => roomAt(WORLD, [p.x, p.z])?.id ?? null;
    const via = room(from.position) !== room(to.position) ? DOORWAY : null;
    // Wall-clock time, not frame time: a slow frame must not stretch a walk.
    flight.current = { from, to, via, start: performance.now(), seconds: via ? TRAVEL_S * 1.6 : TRAVEL_S, arrive };
  };

  // Start where the trainee stands.
  useEffect(() => {
    const { player } = useWorldStore.getState();
    camera.position.set(player.position[0], EYE_HEIGHT, player.position[1]);
    camera.rotation.set(look.current.pitch, player.yaw + Math.PI, 0, "YXZ");
  }, [camera]);

  // A travel request: walk the camera to the station.
  useEffect(() => {
    if (!travel) return;
    const s = stationById(WORLD, travel.stationId);
    if (s) fly(standPose(s), s.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on a new request
  }, [travel?.seq]);

  // At the warehouse, a chosen part is flown to and the camera comes back after.
  useEffect(() => {
    if (station?.kind !== "warehouse") return;
    if (!selectedPart) {
      fly(standPose(station), null);
      return;
    }
    const slot = partSlot(parts, selectedPart);
    if (!slot) return;
    const target = stationPoint(station, slot.clone().add(new THREE.Vector3(0, 0.05, 0)));
    const position = stationPoint(station, slot.clone().add(new THREE.Vector3(0.06, 0.2, 0.42)));
    fly({ position, target }, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on a new selection
  }, [selectedPart, station?.id]);

  // At the crib or a cart, likewise for a chosen tool.
  useEffect(() => {
    if (station?.kind !== "toolbox" && station?.kind !== "toolcart") return;
    if (!selectedTool) {
      fly(standPose(station), null);
      return;
    }
    const slot =
      station.kind === "toolcart" && station.machineId ? cartSlot(station.machineId, selectedTool) : cribSlot(selectedTool);
    if (!slot) return;
    const target = stationPoint(station, slot.clone().add(new THREE.Vector3(0, 0.1, 0)));
    const position = stationPoint(station, slot.clone().add(new THREE.Vector3(0.05, 0.2, 0.55)));
    fly({ position, target }, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on a new selection
  }, [selectedTool, station?.id]);

  // Keys: walking keys move, Esc leaves a station; neither while typing or
  // while the full panel takes the keyboard.
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (isTyping(event) || useProgramEditor.getState().isOpen) return;
      if (useSessionStore.getState().fullPanelOpen && useWorldStore.getState().view.kind === "station") return;
      const key = event.key.toLowerCase();
      if (key === "escape" && useWorldStore.getState().view.kind === "station") {
        useWorldStore.getState().leave();
        return;
      }
      if (!["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(key)) return;
      if (useWorldStore.getState().view.kind === "station" && key !== "shift") useWorldStore.getState().leave();
      keys.current.add(key);
      if (key.startsWith("arrow")) event.preventDefault();
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // Drag to look while walking.
  useEffect(() => {
    const el = gl.domElement;
    let dragging: { x: number; y: number } | null = null;
    const downAt = (e: PointerEvent) => {
      if (useWorldStore.getState().view.kind !== "walk" || flight.current) return;
      dragging = { x: e.clientX, y: e.clientY };
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      look.current.yaw -= (e.clientX - dragging.x) * LOOK;
      look.current.pitch = THREE.MathUtils.clamp(look.current.pitch - (e.clientY - dragging.y) * LOOK, -1.2, 1.2);
      dragging = { x: e.clientX, y: e.clientY };
    };
    const release = () => {
      dragging = null;
    };
    el.addEventListener("pointerdown", downAt);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", release);
    return () => {
      el.removeEventListener("pointerdown", downAt);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", release);
    };
  }, [gl]);

  // Leaving a station: walk on from where it is used, looking where the
  // camera looked.
  const wasAt = useRef<string | null>(null);
  useEffect(() => {
    const left = wasAt.current && view.kind === "walk" ? stationById(WORLD, wasAt.current) : null;
    wasAt.current = view.kind === "station" ? view.id : null;
    // Going straight on to another station: its flight has already started.
    if (!left || flight.current?.arrive) return;
    const pose = standPose(left);
    const dir = pose.target.clone().sub(pose.position);
    look.current = { yaw: Math.atan2(dir.x, dir.z), pitch: -0.05 };
    const ahead = new THREE.Vector3(Math.sin(look.current.yaw), -0.05, Math.cos(look.current.yaw));
    fly({ position: pose.position, target: pose.position.clone().add(ahead) }, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on a change of view only
  }, [view]);

  const lookAt = useRef(new THREE.Vector3());
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const f = flight.current;
    if (f) {
      const t = Math.min(1, (performance.now() - f.start) / (f.seconds * 1000));
      const k = t * t * (3 - 2 * t);
      if (f.via) {
        // Two legs, through the door: the camera never passes through a wall.
        const leg = k < 0.5 ? k * 2 : (k - 0.5) * 2;
        if (k < 0.5) camera.position.lerpVectors(f.from.position, f.via, leg);
        else camera.position.lerpVectors(f.via, f.to.position, leg);
      } else {
        camera.position.lerpVectors(f.from.position, f.to.position, k);
      }
      lookAt.current.lerpVectors(f.from.target, f.to.target, k);
      camera.lookAt(lookAt.current);
      if (t >= 1) {
        flight.current = null;
        const dir = f.to.target.clone().sub(f.to.position);
        look.current = { yaw: Math.atan2(dir.x, dir.z), pitch: Math.atan2(dir.y, Math.hypot(dir.x, dir.z)) };
        if (f.arrive) useWorldStore.getState().arrive(f.arrive);
      }
      return;
    }
    if (useWorldStore.getState().view.kind !== "walk") return;

    const k = keys.current;
    const forward = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0);
    const strafe = (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0);
    const turn = (k.has("arrowleft") ? 1 : 0) - (k.has("arrowright") ? 1 : 0);
    look.current.yaw += turn * 1.8 * dt;
    const { yaw, pitch } = look.current;
    if (forward || strafe) {
      const speed = (k.has("shift") ? RUN : WALK) * dt;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      const step: Vec2 = [(fx * forward - fz * strafe) * speed, (fz * forward + fx * strafe) * speed];
      const next = slide(WORLD, [camera.position.x, camera.position.z], step);
      camera.position.set(next[0], EYE_HEIGHT, next[1]);
      useWorldStore.getState().setPlayer(next, yaw);
    }
    camera.rotation.set(pitch, yaw + Math.PI, 0, "YXZ");
  });

  // At a machine the camera orbits it, and "show me" can fly it to a part.
  if (station?.kind === "machine") {
    const target = lookTarget(station);
    return (
      <>
        <OrbitControls
          makeDefault
          enablePan
          enableZoom
          zoomToCursor
          minDistance={0.35}
          maxDistance={6}
          maxPolarAngle={Math.PI * 0.55}
          target={[target.x, target.y, target.z]}
        />
        <CameraFocus />
      </>
    );
  }
  return null;
}
