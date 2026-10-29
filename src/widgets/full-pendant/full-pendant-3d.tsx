"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { useMachineStore } from "@/entities/machine/machine-store";
import type { MachinePartId } from "@/entities/machine/machine-parts";
import { useRigRegistry } from "@/widgets/vr-scene/rig-registry";
import { useSessionStore } from "@/features/session/session-store";
import { useTutorialKeys } from "@/features/tutorial/tutorial-store";
import { pulseFrom } from "@/features/xr/haptics";
import { screenView } from "@/widgets/vr-scene/machine-rig";
import { drawPendantScreen, screenKey } from "@/widgets/vr-scene/pendant-screen";
import { CANVAS_H, CANVAS_W, paintKeypad } from "./keypad-painter";
import { PANEL_H, PANEL_W, PHYSICAL, SCREEN, SIDE_CONTROLS, keyAt } from "./ngc-layout";

const MM = 0.001;
const noopRaycast = () => {};
const NO_KEYS: string[] = [];

/** Panel millimetres (from the top-left) to the panel group's local metres. */
const at = (x: number, y: number, z = 0): [number, number, number] => [
  (x - PANEL_W / 2) * MM,
  (PANEL_H / 2 - y) * MM,
  z,
];

type Props = {
  /** The physical controls: same parts as on the machine's pendant. */
  onPartInteract: (part: MachinePartId, sign?: 1 | -1) => void;
  /** A keyboard key, with SHIFT if it was armed. */
  onKey: (id: string, shift: boolean) => void;
  /** A side-panel control the machine does not simulate yet. */
  onUnhandledKey: (label: string) => void;
  onClose: () => void;
};

/** A round push button standing proud of the panel; `square` frames it like CYCLE START. */
function PushButton({
  x,
  y,
  r,
  color,
  onPress,
  square,
}: {
  x: number;
  y: number;
  r: number;
  color: string;
  onPress: () => void;
  square?: boolean;
}) {
  return (
    <group position={at(x, y)}>
      {square ? (
        <mesh position={[0, 0, 0.003]} raycast={noopRaycast}>
          <boxGeometry args={[(r * 2 + 10) * MM, (r * 2 + 10) * MM, 0.006]} />
          <meshStandardMaterial color="#4a4f55" metalness={0.7} roughness={0.3} />
        </mesh>
      ) : (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.003]} raycast={noopRaycast}>
          <cylinderGeometry args={[(r + 4) * MM, (r + 4) * MM, 0.006, 32]} />
          <meshStandardMaterial color="#4a4f55" metalness={0.7} roughness={0.3} />
        </mesh>
      )}
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, 0.011]}
        onClick={(e) => {
          e.stopPropagation();
          onPress();
        }}
      >
        <cylinderGeometry args={[r * MM, r * MM, 0.012, 32]} />
        <meshStandardMaterial color={color} roughness={0.35} />
      </mesh>
    </group>
  );
}

/**
 * The complete NGC pendant at full size, beside the machine: all 132 keys,
 * the physical controls, the side-panel switches and a live screen.
 * Opened from the FULL PANEL key; works the same with a mouse or an XR ray.
 */
export function FullPendant3D({ onPartInteract, onKey, onUnhandledKey, onClose }: Props) {
  const rig = useRigRegistry((s) => s.rig);
  const tutorialKeys = useTutorialKeys();
  const inTutorial = useSessionStore((s) => s.gameMode) === "tutorial";
  const highlighted = inTutorial ? tutorialKeys : NO_KEYS;
  const [hovered, setHovered] = useState<string | null>(null);
  const [shift, setShift] = useState(false);
  const pressed = useRef<{ id: string; at: number } | null>(null);
  const painted = useRef({ keypad: "", screen: "", screenAt: -1 });
  const wheelBase = useRef<THREE.Group>(null);
  const wheel = useRef<THREE.Group>(null);
  const wheelAngle = useRef({ now: 0, target: 0 });
  const estop = useRef<THREE.Group>(null);

  const keypad = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return { canvas, texture };
  }, []);

  // The panel's own 4:3 screen, painted from the same live values as the
  // machine's: the two never disagree, and neither is stretched.
  const screen = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = Math.round((1280 * SCREEN.h) / SCREEN.w);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return { canvas, texture };
  }, []);

  useEffect(
    () => () => {
      keypad.texture.dispose();
      screen.texture.dispose();
    },
    [keypad, screen],
  );

  useFrame(({ clock }, dt) => {
    const { machine, message } = useMachineStore.getState();

    const flash =
      pressed.current && performance.now() / 1000 - pressed.current.at < 0.15 ? pressed.current.id : null;
    const keypadKey = `${hovered}|${flash}|${shift}|${highlighted.join(",")}`;
    if (keypadKey !== painted.current.keypad) {
      paintKeypad(keypad.canvas, { hovered, highlighted, pressed: flash, shift });
      keypad.texture.needsUpdate = true;
      painted.current.keypad = keypadKey;
    }

    if (rig) {
      const view = screenView(rig, machine, message);
      const key = screenKey(view);
      const now = clock.elapsedTime;
      if (key !== painted.current.screen && now - painted.current.screenAt > 1 / 15) {
        drawPendantScreen(screen.canvas, view);
        screen.texture.needsUpdate = true;
        painted.current.screen = key;
        painted.current.screenAt = now;
      }
    }

    const w = wheelAngle.current;
    w.now += (w.target - w.now) * (1 - Math.exp(-dt * 12));
    wheel.current?.rotation.set(0, 0, w.now);
    estop.current?.position.set(0, 0, machine.estopPressed ? 0.006 : 0.014);
  });

  const pointerKey = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
    e.uv ? keyAt(e.uv.x * PANEL_W, (1 - e.uv.y) * PANEL_H) : null;

  const press = (part: MachinePartId, sign?: 1 | -1) => onPartInteract(part, sign);

  return (
    <group>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          const key = pointerKey(e);
          if (!key) return;
          pulseFrom(e, "tap");
          pressed.current = { id: key.id, at: performance.now() / 1000 };
          if (key.id === "CLOSE_PANEL") return onClose();
          // SHIFT arms the next key's second legend, then disarms.
          if (key.id === "SHIFT") return setShift((s) => !s);
          setShift(false);
          onKey(key.id, shift);
        }}
        onPointerMove={(e) => {
          const id = pointerKey(e)?.id ?? null;
          if (id !== hovered) setHovered(id);
        }}
        onPointerOut={() => setHovered(null)}
      >
        <planeGeometry args={[PANEL_W * MM, PANEL_H * MM]} />
        {/* Lit like the rest of the scene, with enough self-light that the
            legends stay readable from a step back. */}
        <meshStandardMaterial
          map={keypad.texture}
          emissiveMap={keypad.texture}
          emissive="#ffffff"
          emissiveIntensity={0.45}
          roughness={0.7}
        />
      </mesh>
      {/* Back of the pendant, so it reads as an object from behind. */}
      <mesh position={[0, 0, -0.03]} raycast={noopRaycast}>
        <boxGeometry args={[PANEL_W * MM, PANEL_H * MM, 0.058]} />
        <meshStandardMaterial color="#1c1e22" roughness={0.6} />
      </mesh>

      <mesh position={at(SCREEN.x + SCREEN.w / 2, SCREEN.y + SCREEN.h / 2, 0.0015)} raycast={noopRaycast}>
        <planeGeometry args={[SCREEN.w * MM, SCREEN.h * MM]} />
        <meshBasicMaterial map={screen.texture} toneMapped={false} />
      </mesh>

      <PushButton {...PHYSICAL.powerOn} color="#1f9d3a" onPress={() => press("power_on")} />
      <PushButton {...PHYSICAL.powerOff} color="#c62828" onPress={() => press("power_off")} />
      <PushButton {...PHYSICAL.cycleStart} color="#1f9d3a" square onPress={() => press("cycle_start")} />
      <PushButton {...PHYSICAL.feedHold} color="#c62828" square onPress={() => press("feed_hold")} />

      {/* E-stop: yellow collar, mushroom head pushed in while pressed. */}
      <group position={at(PHYSICAL.estop.x, PHYSICAL.estop.y)}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.004]} raycast={noopRaycast}>
          <cylinderGeometry args={[(PHYSICAL.estop.r + 12) * MM, (PHYSICAL.estop.r + 12) * MM, 0.008, 48]} />
          <meshStandardMaterial color="#f2c200" roughness={0.45} />
        </mesh>
        <group ref={estop}>
          <mesh
            rotation={[Math.PI / 2, 0, 0]}
            position={[0, 0, 0.012]}
            onClick={(e) => {
              e.stopPropagation();
              press("estop");
            }}
          >
            <cylinderGeometry args={[PHYSICAL.estop.r * 0.88 * MM, PHYSICAL.estop.r * MM, 0.024, 48]} />
            <meshStandardMaterial color="#d01f1f" roughness={0.3} />
          </mesh>
        </group>
      </group>

      {/* Jog handle: left half minus, right half plus, as on the machine. */}
      <group ref={wheelBase} position={at(PHYSICAL.handwheel.x, PHYSICAL.handwheel.y, 0.008)}>
        <group ref={wheel}>
          <mesh
            rotation={[Math.PI / 2, 0, 0]}
            onClick={(e) => {
              e.stopPropagation();
              // Read the side in the panel's frame: the wheel itself turns.
              const local = wheelBase.current!.worldToLocal(e.point.clone());
              const sign: 1 | -1 = local.x >= 0 ? 1 : -1;
              wheelAngle.current.target -= sign * ((2 * Math.PI) / 10);
              press("handwheel", sign);
            }}
          >
            <cylinderGeometry args={[PHYSICAL.handwheel.r * MM, PHYSICAL.handwheel.r * MM, 0.016, 64]} />
            <meshStandardMaterial color="#1b1b1d" roughness={0.6} />
          </mesh>
          <mesh
            position={[PHYSICAL.handwheel.r * 0.65 * MM, 0, 0.018]}
            rotation={[Math.PI / 2, 0, 0]}
            raycast={noopRaycast}
          >
            <cylinderGeometry args={[0.008, 0.008, 0.02, 16]} />
            <meshStandardMaterial color="#b9bfc6" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      </group>

      {/* Side panel: shown where the real one is, not yet simulated. */}
      {SIDE_CONTROLS.map((c) => (
        <mesh
          key={c.id}
          position={at(c.x, c.y, c.kind === "port" ? 0.002 : 0.006)}
          rotation={[Math.PI / 2, 0, 0]}
          onClick={(e) => {
            e.stopPropagation();
            onUnhandledKey(c.label.replace(/\n/g, " "));
          }}
        >
          {c.kind === "port" ? (
            <boxGeometry args={[0.018, 0.004, 0.009]} />
          ) : (
            <cylinderGeometry args={[c.r * MM, c.r * MM, 0.012, 24]} />
          )}
          <meshStandardMaterial
            color={c.kind === "keyswitch" ? "#b6bcc2" : c.kind === "port" ? "#0d0e10" : "#5a6068"}
            metalness={c.kind === "keyswitch" ? 0.8 : 0.2}
            roughness={0.35}
          />
        </mesh>
      ))}

      {/* What "Show me" frames when the panel opens on desktop. */}
      <object3D name="FullPanel_View" userData={{ frontal: true, arrowScale: 2 }} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
}
