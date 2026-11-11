"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { roomAt, slide, stationById, type Station, type Vec2 } from "@/entities/world/layout";
import { findPath } from "@/entities/world/navigation";
import { useSessionStore } from "@/features/session/session-store";
import { EYE_HEIGHT, WORLD, hasMenu, useWorldStore } from "@/features/world/world-store";
import { showToast } from "@/shared/ui/toast";
import { useProgramEditor } from "@/widgets/gcode-editor";

/** Walking and running speed, m/s (Shift runs). */
const WALK = 3;
const RUN = 5.5;
/** Crouched: eye height, m, and walking speed, m/s (no running). */
const CROUCH_EYE = 1.05;
const CROUCH_WALK = 1.4;
/** How fast walking speeds up and slows down, 1/s. */
const ACCEL = 12;
/** Radians per pixel of mouse drag. */
const LOOK = 0.0035;
/** A drag starts once the pointer has moved this far, px: less is a click. */
const DRAG_PX = 4;
/** Turning with the arrow keys, rad/s. */
const TURN = 2.2;
const PITCH_LIMIT = 1.35;
/** Field of view: normal, and the closest the wheel zooms the eyes in. */
const FOV = 60;
const FOV_MIN = 22;
/** Walk further than this from a station and its menu closes, m. */
const MENU_RANGE = 9;
/** "Show me" turns the head when the part is this close and facing the
 *  player; otherwise the player walks round to where it can be seen, m. */
const SEE_RANGE = 3.2;
const SEE_DISTANCE = 1.3;

/** Plan point + height. */
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

/** The yaw and pitch that look from `from` at `to`. */
function anglesTo(from: THREE.Vector3, to: THREE.Vector3) {
  const d = to.clone().sub(from);
  return { yaw: Math.atan2(d.x, d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) };
}

/** `angle` moved towards `goal` the short way round, by fraction `k`. */
function turnTowards(angle: number, goal: number, k: number) {
  const diff = Math.atan2(Math.sin(goal - angle), Math.cos(goal - angle));
  return angle + diff * k;
}

function isTyping(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  return target instanceof Element && !!target.closest("input, textarea, select, [contenteditable=true], .cm-editor");
}

/** The full panel has the keyboard: letters type G-code, they do not walk. */
const panelHasKeyboard = () => {
  const { fullPanelOpen, panelKeyboard } = useSessionStore.getState();
  return fullPanelOpen && panelKeyboard;
};

type Route = {
  points: Vec2[];
  /** Turn to look at this on arrival. */
  face: THREE.Vector3 | null;
  /** Open this station's menu on arrival. */
  open: string | null;
  /** Walking time left before giving up, s: a route should never take this
   *  long. Game time, not wall-clock: a throttled tab walks slower. */
  budget: number;
};

/**
 * The desktop player: one person in the workshop, and the camera is their
 * eyes — always at eye height over where they stand, nowhere else.
 *
 * WASD or the arrows walk (Shift runs; ← → turn; a tap of Ctrl crouches and
 * stands up again — to read a low gauge or see under the spindle), a drag looks round, the
 * wheel narrows the eyes' field of view to read a small control. Nothing
 * clicked moves the view: a station's menu opens where the player stands
 * (world-scene.tsx). Sent somewhere — a station from the list, a level's
 * machine, "show me" on a control round the back — the player walks there
 * on their own feet, round machines and through the door, and any walking
 * key takes over again.
 */
export function DesktopNavigator() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const travel = useWorldStore((s) => s.travel);
  const focus = useSessionStore((s) => s.cameraFocus);
  const keys = useRef(new Set<string>());
  const look = useRef({ yaw: useWorldStore.getState().player.yaw, pitch: -0.05 });
  const velocity = useRef<Vec2>([0, 0]);
  const route = useRef<Route | null>(null);
  /** A point the head is turning to look at. */
  const aim = useRef<THREE.Vector3 | null>(null);
  /** A "show me" node not found yet: it may mount a frame after the request. */
  const pendingFocus = useRef<{ node: string; until: number } | null>(null);
  const zoom = useRef(FOV);
  const drag = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const cursor = useRef("");
  /** Ctrl went down and nothing else since: its release crouches or stands. */
  const crouchTap = useRef(false);
  /** Eye height now: it sinks and rises with crouching. */
  const eye = useRef(EYE_HEIGHT);

  const eyes = () => at(useWorldStore.getState().player.position, eye.current);

  /** Walk to `to` along a route round whatever is in the way. */
  const walkTo = (to: Vec2, face: THREE.Vector3 | null, open: string | null) => {
    const from = useWorldStore.getState().player.position;
    const points = findPath(WORLD, from, to);
    if (!points) {
      showToast("There is no way there from here.", "warning");
      return;
    }
    const length = points.reduce((sum, p, i) => sum + Math.hypot(p[0] - (i ? points[i - 1] : from)[0], p[1] - (i ? points[i - 1] : from)[1]), 0);
    route.current = { points, face, open, budget: length / WALK + 3 };
    aim.current = null;
  };

  /** "Show me" a part: turn to it if it can be seen from here, else walk round. */
  const showNode = (node: THREE.Object3D) => {
    node.updateWorldMatrix(true, false);
    const target = node.getWorldPosition(new THREE.Vector3());
    // A part's anchor points +Y out of the surface it sits on.
    const out = new THREE.Vector3(0, 1, 0).transformDirection(node.matrixWorld);
    const eye = eyes();
    const toEye = new THREE.Vector2(eye.x - target.x, eye.z - target.z);
    const distance = toEye.length();
    toEye.normalize();
    const outPlan = new THREE.Vector2(out.x, out.z);
    const sideways = outPlan.length() > 0.3;
    const faces = !sideways || outPlan.clone().normalize().dot(toEye) > 0.2;
    if (distance <= SEE_RANGE && faces) {
      aim.current = target;
      return;
    }
    const away = sideways ? outPlan.normalize() : toEye;
    walkTo([target.x + away.x * SEE_DISTANCE, target.z + away.y * SEE_DISTANCE], target, null);
  };

  // Development only: the player's eyes and the scene, for browser checks.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __player?: object }).__player = {
      camera,
      scene,
      Raycaster: THREE.Raycaster,
      Vector2: THREE.Vector2,
      findPath: (from: Vec2, to: Vec2) => findPath(WORLD, from, to),
      get route() {
        return route.current;
      },
      get look() {
        return look.current;
      },
    };
  }, [camera, scene]);

  // Start where the trainee stands, facing the station whose menu is open.
  useEffect(() => {
    const { player, view } = useWorldStore.getState();
    look.current = { yaw: player.yaw, pitch: -0.05 };
    const station = view.kind === "station" ? stationById(WORLD, view.id) : null;
    if (station) look.current = anglesTo(at(player.position, EYE_HEIGHT), lookTarget(station));
  }, []);

  // Sent to a station: walk there; its menu opens on arrival.
  useEffect(() => {
    if (!travel) return;
    const s = stationById(WORLD, travel.stationId);
    if (s) walkTo(s.stand.position, lookTarget(s), hasMenu(s) ? s.id : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on a new request
  }, [travel?.seq]);

  // "Show me": resolved in the frame loop, where the scene is current.
  useEffect(() => {
    if (focus) pendingFocus.current = { node: focus.node, until: performance.now() + 1000 };
  }, [focus]);

  // Keys: walking keys move; Esc gives the keyboard back from the full panel,
  // or else closes the open menu.
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (isTyping(event) || useProgramEditor.getState().isOpen) return;
      const key = event.key.toLowerCase();
      // Ctrl on its own crouches or stands up, on release. Held down with W
      // it would be Ctrl+W, which closes the tab before a page can stop it,
      // so it is a tap, not a hold; any key pressed with it (Ctrl+S…) is a
      // shortcut, not a crouch.
      if (key === "control") {
        if (!event.repeat) crouchTap.current = true;
        return;
      }
      crouchTap.current = false;
      if (key === "escape") {
        if (panelHasKeyboard()) useSessionStore.getState().setPanelKeyboard(false);
        else if (useWorldStore.getState().view.kind === "station") useWorldStore.getState().leave();
        return;
      }
      if (panelHasKeyboard()) return;
      if (!["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(key)) return;
      keys.current.add(key);
      if (key.startsWith("arrow")) event.preventDefault();
    };
    const up = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      keys.current.delete(key);
      if (key === "control" && crouchTap.current) {
        crouchTap.current = false;
        const world = useWorldStore.getState();
        world.setCrouching(!world.crouching);
      }
    };
    const blur = () => {
      keys.current.clear();
      crouchTap.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // Drag to look; the wheel zooms the eyes. A click (no drag) anywhere but on
  // the full panel gives the keyboard back to walking.
  useEffect(() => {
    const el = gl.domElement;
    const downAt = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 2) return;
      drag.current = { x: e.clientX, y: e.clientY, active: false };
    };
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.active && Math.hypot(dx, dy) < DRAG_PX) return;
      d.active = true;
      aim.current = null;
      // A narrower field of view turns slower, so the aim stays steady.
      const scale = LOOK * (zoom.current / FOV);
      look.current.yaw -= dx * scale;
      look.current.pitch = THREE.MathUtils.clamp(look.current.pitch - dy * scale, -PITCH_LIMIT, PITCH_LIMIT);
      d.x = e.clientX;
      d.y = e.clientY;
    };
    const release = () => {
      drag.current = null;
    };
    const clickUp = (e: PointerEvent) => {
      if (drag.current?.active) return;
      const stamp = e.timeStamp;
      // The panel marks its own pointer events; they may run after this one.
      setTimeout(() => {
        const session = useSessionStore.getState();
        if (session.panelKeyboard && session.panelPointerAt !== stamp) session.setPanelKeyboard(false);
      }, 0);
    };
    const wheel = (e: WheelEvent) => {
      zoom.current = THREE.MathUtils.clamp(zoom.current * (1 + e.deltaY * 0.0012), FOV_MIN, FOV);
    };
    const noMenu = (e: MouseEvent) => e.preventDefault();
    el.addEventListener("pointerdown", downAt);
    el.addEventListener("pointerup", clickUp);
    el.addEventListener("wheel", wheel, { passive: true });
    el.addEventListener("contextmenu", noMenu);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", release);
    return () => {
      el.removeEventListener("pointerdown", downAt);
      el.removeEventListener("pointerup", clickUp);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("contextmenu", noMenu);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", release);
    };
  }, [gl]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const world = useWorldStore.getState();

    const p = pendingFocus.current;
    if (p) {
      const node = scene.getObjectByName(p.node);
      if (node) {
        pendingFocus.current = null;
        showNode(node);
      } else if (performance.now() > p.until) {
        pendingFocus.current = null;
      }
    }

    const k = keys.current;
    const forward = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0);
    const strafe = (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0);
    const turn = (k.has("arrowleft") ? 1 : 0) - (k.has("arrowright") ? 1 : 0);
    if (forward || strafe || turn) {
      // The player takes over from any walk or turn under way.
      route.current = null;
      aim.current = null;
    }
    look.current.yaw += turn * TURN * dt;

    // Where the player wants to go, m/s.
    const position = world.player.position;
    let want: Vec2 = [0, 0];
    if (forward || strafe) {
      const speed = world.crouching ? CROUCH_WALK : k.has("shift") ? RUN : WALK;
      const { yaw } = look.current;
      const [fx, fz] = [Math.sin(yaw), Math.cos(yaw)];
      const v: Vec2 = [fx * forward - fz * strafe, fz * forward + fx * strafe];
      const n = Math.hypot(v[0], v[1]);
      want = [(v[0] / n) * speed, (v[1] / n) * speed];
    } else if (route.current) {
      const r = route.current;
      const next = r.points[0];
      const dx = next[0] - position[0];
      const dz = next[1] - position[1];
      const d = Math.hypot(dx, dz);
      const last = r.points.length === 1;
      r.budget -= dt;
      if (d < (last ? 0.05 : 0.25) || r.budget < 0) {
        r.points.shift();
        if (!r.points.length || r.budget < 0) {
          route.current = null;
          velocity.current = [0, 0];
          if (r.face) aim.current = r.face;
          if (r.open) world.interact(r.open);
        }
      } else {
        // Ease into the last stop rather than overshooting it.
        const speed = WALK * (last ? Math.min(1, d / 0.8) + 0.15 : 1);
        want = [(dx / d) * speed, (dz / d) * speed];
        if (!drag.current?.active) {
          const kk = 1 - Math.exp(-dt * 8);
          look.current.yaw = turnTowards(look.current.yaw, Math.atan2(dx, dz), kk);
          look.current.pitch += (-0.05 - look.current.pitch) * kk;
        }
      }
    }

    const a = 1 - Math.exp(-dt * ACCEL);
    const v = velocity.current;
    v[0] += (want[0] - v[0]) * a;
    v[1] += (want[1] - v[1]) * a;
    let standing = position;
    if (Math.hypot(v[0], v[1]) > 0.01) {
      standing = slide(WORLD, position, [v[0] * dt, v[1] * dt]);
      if (standing[0] !== position[0] || standing[1] !== position[1]) world.setPlayer(standing, look.current.yaw);
    } else if (!forward && !strafe) {
      v[0] = 0;
      v[1] = 0;
    }

    // Turning the head to look at something.
    if (aim.current) {
      const goal = anglesTo(at(standing, eye.current), aim.current);
      const kk = 1 - Math.exp(-dt * 6);
      look.current.yaw = turnTowards(look.current.yaw, goal.yaw, kk);
      look.current.pitch += (goal.pitch - look.current.pitch) * kk;
      const off = Math.abs(Math.atan2(Math.sin(goal.yaw - look.current.yaw), Math.cos(goal.yaw - look.current.yaw)));
      if (off < 0.004 && Math.abs(goal.pitch - look.current.pitch) < 0.004) aim.current = null;
    }

    // The camera is the player's eyes, lower while crouching.
    const eyeGoal = world.crouching ? CROUCH_EYE : EYE_HEIGHT;
    eye.current += (eyeGoal - eye.current) * (1 - Math.exp(-dt * 10));
    camera.position.set(standing[0], eye.current, standing[1]);
    camera.rotation.set(look.current.pitch, look.current.yaw + Math.PI, 0, "YXZ");
    if (Math.abs(camera.fov - zoom.current) > 0.01) {
      camera.fov += (zoom.current - camera.fov) * (1 - Math.exp(-dt * 12));
      camera.updateProjectionMatrix();
    }

    // Walked away from the station whose menu is open: it closes.
    if (world.view.kind === "station") {
      const s = stationById(WORLD, world.view.id);
      const far = s && Math.hypot(s.position[0] - standing[0], s.position[1] - standing[1]) > MENU_RANGE;
      const elsewhere = s && roomAt(WORLD, s.position)?.id !== roomAt(WORLD, standing)?.id;
      if (s && (far || elsewhere) && !route.current) world.leave();
    }

    // The pointer says what a click will do.
    const session = useSessionStore.getState();
    const pointerCursor = drag.current?.active ? "grabbing" : world.hovered || session.hoveredPart ? "pointer" : "";
    if (cursor.current !== pointerCursor) {
      cursor.current = pointerCursor;
      gl.domElement.style.cursor = pointerCursor;
    }
  });

  return null;
}
