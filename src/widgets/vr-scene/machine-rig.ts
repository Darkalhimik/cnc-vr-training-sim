import * as THREE from "three";
import { isMachinePartId, type MachinePartId } from "@/entities/machine/machine-parts";
import { BOOT_MS, spindleRpm } from "@/entities/machine/machine-logic";
import {
  AXES,
  type Axis,
  type MachineState,
  airPressure,
} from "@/entities/machine/machine-types";
import { drawPendantScreen, screenKey, type ScreenView } from "./pendant-screen";

/**
 * Binds public/models/umc500.glb to machine state.
 *
 * The model is built by tools/blender/build_umc500.py, and this file is the
 * other half of its contract: pointable nodes carry a `part` extra, arrow
 * targets are `Anchor_<part>` empties, and the moving nodes below have fixed
 * names. Blender's local +Z arrives here as local +Y, so on every surface-
 * mounted control "out of the panel" is +Y.
 */
export const MODEL_URL = "/models/umc500.glb";

/** Machine position the CAD was drawn at; node offsets are relative to it. */
const CAD_POSE: Record<Axis, number> = { x: -53, y: 0, z: -259, b: 0, c: 0 };

/** How far the door slides to open, leaving the handle at the opening. */
const DOOR_TRAVEL_M = 0.68;
const BUTTON_TRAVEL_M = 0.003;
const ESTOP_TRAVEL_M = 0.008;
const PRESS_S = 0.18;
const HANDWHEEL_DETENT = (2 * Math.PI) / 10;

/** Parts that dip when pressed. */
const PUSH_PARTS = new Set<MachinePartId>([
  "power_on",
  "power_off",
  "reset",
  "power_up",
  "memory",
  "hand_jog",
  "axis_x",
  "axis_y",
  "axis_z",
  "axis_b",
  "axis_c",
  "coolant",
  "cycle_start",
  "feed_hold",
]);

const NODE_NAMES = {
  axisX: "Axis_X",
  axisY: "Axis_Y",
  axisZ: "Axis_Z",
  spindle: "Spindle",
  axisB: "Axis_B",
  axisC: "Axis_C",
  door: "Door",
  estop: "EStop",
  handwheel: "Handwheel",
  valveLever: "AirValve_Lever",
  gaugeNeedle: "AirGauge_Needle",
  mainHandle: "MainSwitch_Handle",
  beacon: "Beacon",
  screen: "Screen",
  coolantNozzle: "Coolant_Nozzle",
  toolTip: "Tool_Tip",
} as const;

type RigNodes = { [K in keyof typeof NODE_NAMES]: THREE.Object3D };

export type Anchor = { node: THREE.Object3D; scale: number };

type Glow = { mesh: THREE.Mesh; material: THREE.MeshStandardMaterial; base: THREE.Color };

export type MachineRig = {
  nodes: RigNodes;
  parts: Map<MachinePartId, THREE.Object3D>;
  anchors: Map<MachinePartId, Anchor>;
  glows: Map<MachinePartId, Glow[]>;
  rest: Map<THREE.Object3D, THREE.Vector3>;
  screen: { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; key: string; drawnAt: number };
  beacon: THREE.MeshStandardMaterial;
  /** Animated values: where things are drawn, easing towards machine state. */
  anim: {
    now: number;
    position: Record<Axis, number>;
    door: number;
    estop: number;
    estopTwistAt: number;
    estopWasPressed: boolean;
    valve: number;
    pressure: number;
    mainSwitch: number;
    rpm: number;
    spindleAngle: number;
    wheelAngle: number;
    wheelTarget: number;
    bootStartedAt: number | null;
    pressedAt: Map<MachinePartId, number>;
  };
};

/** The part a hit belongs to: the nearest ancestor that declares one. */
export function partOf(object: THREE.Object3D | null): MachinePartId | null {
  for (let o = object; o; o = o.parent) {
    const part = o.userData?.part;
    if (isMachinePartId(part)) return part;
  }
  return null;
}

function find(scene: THREE.Object3D, name: string) {
  const node = scene.getObjectByName(name);
  if (!node) throw new Error(`umc500.glb has no node "${name}" — rebuild it with tools/blender/build_umc500.py`);
  return node;
}

export function bindRig(scene: THREE.Object3D, initial: MachineState): MachineRig {
  const nodes = Object.fromEntries(
    Object.entries(NODE_NAMES).map(([key, name]) => [key, find(scene, name)]),
  ) as RigNodes;

  const parts = new Map<MachinePartId, THREE.Object3D>();
  const anchors = new Map<MachinePartId, Anchor>();
  scene.traverse((o) => {
    if (isMachinePartId(o.userData.part)) parts.set(o.userData.part, o);
    if (isMachinePartId(o.userData.anchorFor)) {
      anchors.set(o.userData.anchorFor, { node: o, scale: Number(o.userData.arrowScale ?? 1) });
    }
  });

  // Each part's meshes get their own material, so lighting one key does not
  // light every key that shares its source material.
  const glows = new Map<MachinePartId, Glow[]>();
  for (const [part, node] of parts) {
    const list: Glow[] = [];
    node.traverse((o) => {
      if (o !== node && isMachinePartId(o.userData.part)) return;
      if (!(o instanceof THREE.Mesh) || !(o.material instanceof THREE.MeshStandardMaterial)) return;
      if (partOf(o) !== part) return;
      const material = o.material.clone();
      o.material = material;
      list.push({ mesh: o, material, base: material.color.clone() });
    });
    glows.set(part, list);
  }

  const rest = new Map<THREE.Object3D, THREE.Vector3>();
  for (const node of [...Object.values(nodes), ...parts.values()]) rest.set(node, node.position.clone());

  // The screen is painted from state; the beacon is lit from it.
  const screenMesh = nodes.screen as THREE.Mesh;
  const aspect = Number(screenMesh.userData.aspect ?? 1.25);
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = Math.round(1024 / aspect);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false; // glTF UVs put v = 0 at the top
  texture.anisotropy = 4;
  screenMesh.material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  glows.delete("screen"); // it paints its own light

  const beaconMesh = nodes.beacon as THREE.Mesh;
  const beacon = (beaconMesh.material as THREE.MeshStandardMaterial).clone();
  beaconMesh.material = beacon;

  return {
    nodes,
    parts,
    anchors,
    glows,
    rest,
    screen: { canvas, texture, key: "", drawnAt: -1 },
    beacon,
    anim: {
      now: 0,
      position: { ...initial.position },
      door: initial.doorOpen ? 1 : 0,
      estop: initial.estopPressed ? 1 : 0,
      estopTwistAt: -10,
      estopWasPressed: initial.estopPressed,
      valve: initial.airValveOpen ? 1 : 0,
      pressure: airPressure(initial),
      mainSwitch: initial.mainSwitchOn ? 1 : 0,
      rpm: 0,
      spindleAngle: 0,
      wheelAngle: 0,
      wheelTarget: 0,
      bootStartedAt: null,
      pressedAt: new Map(),
    },
  };
}

/** Which way a click on the handwheel turns it: right half plus, left minus. */
export function handwheelSign(rig: MachineRig, worldPoint: THREE.Vector3): 1 | -1 {
  const wheel = rig.nodes.handwheel;
  const local = wheel.parent!.worldToLocal(worldPoint.clone());
  return local.x >= wheel.position.x ? 1 : -1;
}

/** Physical feedback for a click — the control may still refuse the action,
 *  but the button was pressed and the wheel was turned. */
export function pressRig(rig: MachineRig, part: MachinePartId, sign?: 1 | -1) {
  if (PUSH_PARTS.has(part)) rig.anim.pressedAt.set(part, rig.anim.now);
  // Plus is clockwise seen from the front, and +Y points at the viewer.
  if (part === "handwheel") rig.anim.wheelTarget -= (sign ?? 1) * HANDWHEEL_DETENT;
}

const ease = (from: number, to: number, rate: number, dt: number) =>
  from + (to - from) * (1 - Math.exp(-rate * dt));

const HIGHLIGHT = new THREE.Color("#ffb020");
const HOVER = new THREE.Color("#ffffff");
const BLACK = new THREE.Color("#000000");
const BEACON = {
  green: new THREE.Color("#2bd96b"),
  red: new THREE.Color("#ff2a2a"),
  amber: new THREE.Color("#ffb020"),
};

/** Lit like a key LED: the control is in the state this key selects. */
function isLit(part: MachinePartId, m: MachineState): boolean {
  const on = m.control === "on";
  switch (part) {
    case "power_on":
      return m.control !== "off";
    case "memory":
      return on && m.mode === "memory";
    case "hand_jog":
      return on && m.mode === "jog";
    case "axis_x":
    case "axis_y":
    case "axis_z":
    case "axis_b":
    case "axis_c":
      return on && m.mode === "jog" && m.jogAxis === part.slice(5);
    case "coolant":
      return m.coolantOn;
    case "power_up":
      return m.homingStage !== null;
    case "cycle_start":
      return m.program === "running";
    case "feed_hold":
      return m.program === "hold";
    default:
      return false;
  }
}

export function animateRig(
  rig: MachineRig,
  m: MachineState,
  message: string | null,
  dt: number,
  now: number,
  highlighted: ReadonlySet<MachinePartId>,
  hovered: MachinePartId | null,
) {
  const { nodes, anim, rest } = rig;
  anim.now = now;
  const restOf = (node: THREE.Object3D) => rest.get(node)!;

  // Axes ease towards the commanded position, so a zero return reads as
  // motion and a jog detent as a short move.
  for (const axis of AXES) anim.position[axis] = ease(anim.position[axis], m.position[axis], 3.2, dt);
  const p = anim.position;
  nodes.axisX.position.x = restOf(nodes.axisX).x + (p.x - CAD_POSE.x) / 1000;
  nodes.axisY.position.z = restOf(nodes.axisY).z - (p.y - CAD_POSE.y) / 1000;
  nodes.axisZ.position.y = restOf(nodes.axisZ).y + (p.z - CAD_POSE.z) / 1000;
  nodes.axisB.rotation.set(0, 0, -THREE.MathUtils.degToRad(p.b - CAD_POSE.b));
  nodes.axisC.rotation.set(0, THREE.MathUtils.degToRad(p.c - CAD_POSE.c), 0);

  // Spindle: real speed would strobe, so the drawn speed only suggests it.
  const rpm = spindleRpm(m);
  anim.rpm = ease(anim.rpm, rpm, 1.5, dt);
  const visualRps = anim.rpm > 5 ? 1.5 + 6 * Math.sqrt(anim.rpm / 8100) : (anim.rpm / 5) * 1.5;
  anim.spindleAngle = (anim.spindleAngle + visualRps * 2 * Math.PI * dt) % (2 * Math.PI);
  nodes.spindle.rotation.set(0, anim.spindleAngle, 0);

  anim.door = ease(anim.door, m.doorOpen ? 1 : 0, 4, dt);
  nodes.door.position.x = restOf(nodes.door).x - DOOR_TRAVEL_M * anim.door;

  // E-stop: pushed in while pressed; a twist and spring back on release.
  if (anim.estopWasPressed && !m.estopPressed) anim.estopTwistAt = now;
  anim.estopWasPressed = m.estopPressed;
  anim.estop = ease(anim.estop, m.estopPressed ? 1 : 0, 14, dt);
  nodes.estop.position.y = restOf(nodes.estop).y - ESTOP_TRAVEL_M * anim.estop;
  const twist = (now - anim.estopTwistAt) / 0.4;
  nodes.estop.rotation.set(0, twist < 1 ? -0.8 * Math.sin(Math.PI * twist) : 0, 0);

  anim.wheelAngle = ease(anim.wheelAngle, anim.wheelTarget, 12, dt);
  nodes.handwheel.rotation.set(0, anim.wheelAngle, 0);

  // Services. Lever across the pipe is closed; quarter-turn clockwise is ON.
  anim.valve = ease(anim.valve, m.airValveOpen ? 1 : 0, 9, dt);
  nodes.valveLever.rotation.set(0, (-Math.PI / 2) * (1 - anim.valve), 0);
  anim.pressure = ease(anim.pressure, airPressure(m), 2.2, dt);
  nodes.gaugeNeedle.rotation.set(0, THREE.MathUtils.degToRad(135 - 27 * anim.pressure), 0);
  anim.mainSwitch = ease(anim.mainSwitch, m.mainSwitchOn ? 1 : 0, 9, dt);
  nodes.mainHandle.rotation.set(0, (-Math.PI / 2) * anim.mainSwitch, 0);

  for (const part of PUSH_PARTS) {
    const node = rig.parts.get(part);
    if (!node) continue;
    const at = anim.pressedAt.get(part);
    const k = at === undefined ? 1 : (now - at) / PRESS_S;
    node.position.y = restOf(node).y - (k < 1 ? BUTTON_TRAVEL_M * Math.sin(Math.PI * k) : 0);
  }

  // Emissive: tutorial highlight beats an LED beats hover.
  const pulse = 0.55 + 0.3 * Math.sin(now * 5);
  for (const [part, glows] of rig.glows) {
    const lit = isLit(part, m);
    for (const g of glows) {
      if (highlighted.has(part)) {
        g.material.emissive.copy(HIGHLIGHT);
        g.material.emissiveIntensity = pulse;
      } else if (lit) {
        g.material.emissive.copy(g.base);
        g.material.emissiveIntensity = 0.55;
      } else if (hovered === part) {
        g.material.emissive.copy(HOVER);
        g.material.emissiveIntensity = 0.12;
      } else {
        g.material.emissive.copy(BLACK);
        g.material.emissiveIntensity = 0;
      }
    }
  }

  // Beacon: red alarm, green running, flashing green ready, flashing amber
  // while booting, dark when off.
  const blink = Math.sin(now * 6) > 0;
  let beacon: THREE.Color = BLACK;
  if (m.control === "booting") beacon = blink ? BEACON.amber : BLACK;
  else if (m.control === "on") {
    if (m.alarms.length > 0) beacon = BEACON.red;
    else if (m.program === "running" || m.homingStage !== null) beacon = BEACON.green;
    else beacon = blink ? BEACON.green : BLACK;
  }
  rig.beacon.emissive.copy(beacon);
  rig.beacon.emissiveIntensity = beacon === BLACK ? 0 : 2.2;

  // Screen: repaint when what it shows changes, at most 15 times a second.
  if (m.control === "booting") anim.bootStartedAt ??= now;
  else anim.bootStartedAt = null;
  const view: ScreenView = {
    machine: m,
    message,
    position: anim.position,
    rpm: Math.round(anim.rpm),
    bootProgress:
      anim.bootStartedAt === null ? 0 : Math.min(1, ((now - anim.bootStartedAt) * 1000) / BOOT_MS),
    blink,
  };
  const key = screenKey(view);
  if (key !== rig.screen.key && now - rig.screen.drawnAt > 1 / 15) {
    drawPendantScreen(rig.screen.canvas, view);
    rig.screen.texture.needsUpdate = true;
    rig.screen.key = key;
    rig.screen.drawnAt = now;
  }
}
