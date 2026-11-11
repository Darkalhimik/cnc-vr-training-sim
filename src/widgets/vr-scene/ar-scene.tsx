"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { TeleportTarget, XR, XROrigin, useXR, type createXRStore } from "@react-three/xr";
import * as THREE from "three";
import { MACHINES, machineById } from "@/entities/catalog/machines";
import type { DeviceMode, GameMode } from "@/entities/machine/machine-types";
import { useSessionStore } from "@/features/session/session-store";
import { useWorldStore } from "@/features/world/world-store";
import { HapticsBridge } from "@/features/xr/haptics";
import { XrLocomotion, slideAroundBox, teleportTo, type FloorBox } from "@/features/xr/locomotion";
import { GlassesPlacement, type Pose } from "./ar-placement";
import { getPreviewCamera, getSceneGroupPosition } from "./layout";
import { MachineStation } from "./machine-station";
import { WristMenu } from "./wrist-menu";

type ArSceneProps = {
  mode: Extract<DeviceMode, "glasses" | "phone">;
  gameMode: GameMode;
  xrStore: ReturnType<typeof createXRStore>;
  onSessionInfo: (info: string | null) => void;
};

/** How wide the preview must show: the machine and the boards either side. */
const PREVIEW_SPAN = 6.4;

/**
 * The page's view before the session starts: from the preview spot, backed
 * off along its line of sight until the machine and its boards fit across a
 * narrow (portrait) canvas too. In the session the glasses or phone drive
 * the camera.
 */
function PreviewFraming({ mode }: { mode: ArSceneProps["mode"] }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const session = useXR((s) => s.session);
  useEffect(() => {
    if (session) return;
    const { position, target } = getPreviewCamera(mode);
    const t = new THREE.Vector3(...target);
    const dir = new THREE.Vector3(...position).sub(t);
    const base = dir.length();
    const halfH = THREE.MathUtils.degToRad(camera.fov / 2);
    const halfW = Math.atan(Math.tan(halfH) * (size.width / Math.max(1, size.height)));
    const fit = PREVIEW_SPAN / 2 / Math.tan(halfW);
    camera.position.copy(t).addScaledVector(dir.normalize(), Math.max(base, fit));
    camera.lookAt(t);
  }, [camera, size.width, size.height, session, mode]);
  return null;
}

// In an immersive-ar session the compositor blends our rendered frame on
// top of the camera passthrough. If the renderer's clear color stays opaque
// or scene.background is set, the canvas paints solid black over the feed —
// the user sees a "black room" instead of their environment. Force a fully
// transparent clear and null background regardless of session.
function ArPassthrough({ onSessionInfo }: { onSessionInfo: (info: string | null) => void }) {
  const sessionMode = useXR((state) => state.mode);
  const session = useXR((state) => state.session);
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    scene.background = null;
    gl.setClearColor(0x000000, 0);
  }, [gl, scene, sessionMode]);

  useEffect(() => {
    if (!session) {
      onSessionInfo(null);
      return;
    }
    const blend =
      (gl.xr as { getEnvironmentBlendMode?: () => string | undefined }).getEnvironmentBlendMode?.() ?? "unknown";
    onSessionInfo(`mode=${sessionMode ?? "?"} blend=${blend}`);
  }, [session, sessionMode, gl, onSessionInfo]);

  return null;
}

/** The trainee's own floor as a teleport target: invisible, everywhere. */
function TeleportFloor({ originRef }: { originRef: React.RefObject<THREE.Group | null> }) {
  const camera = useThree((s) => s.camera);
  const movement = useSessionStore((s) => s.xrMovement);
  if (movement !== "teleport") return null;
  return (
    <TeleportTarget onTeleport={(point) => teleportTo(originRef.current, point, camera)}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
    </TeleportTarget>
  );
}

/**
 * Augmented reality: the machine alone, in the trainee's own room — AR
 * glasses or a phone. No workshop around it: the room they are standing in is
 * the backdrop. Everything the side panel holds stands beside it as boards.
 * Glasses put the machine down on their floor where the trainee points; a
 * phone shows it where it always has.
 *
 * Getting about is as in VR glasses (XrLocomotion: teleport, walk or the
 * stick), only with nothing to bump into but the machine. The left wrist
 * carries the movement choice and which machine is out.
 */
export function ArScene({ mode, gameMode, xrStore, onSessionInfo }: ArSceneProps) {
  const placement = getSceneGroupPosition(mode);
  const originRef = useRef<THREE.Group>(null);
  const machineScale = useSessionStore((s) => s.machineScale);
  const machineYaw = useSessionStore((s) => s.machineYaw);
  const arMachineId = useWorldStore((s) => s.arMachineId);
  const setArMachine = useWorldStore((s) => s.setArMachine);

  // Where the machine stands, for walking round it: the phone's fixed spot,
  // or wherever the glasses put it down (none while it is being carried).
  const pose = useRef<Pose | null>({ position: new THREE.Vector3(...placement), yaw: 0 });
  const onPose = useCallback((p: Pose | null) => {
    pose.current = p;
  }, []);
  const slide = useMemo(() => {
    const [w, d] = machineById(arMachineId)?.footprint ?? [2.9, 2.8];
    return slideAroundBox((): FloorBox | null => {
      const p = pose.current;
      if (!p) return null;
      return { center: [p.position.x, p.position.z], yaw: p.yaw + machineYaw, half: [(w * machineScale) / 2, (d * machineScale) / 2] };
    });
  }, [arMachineId, machineScale, machineYaw]);

  // Only the UMC-500 has a working model and control today; the others are
  // listed so the menu reads the same when they arrive.
  const machines = MACHINES.map((m) => ({
    label: m.name,
    current: m.id === arMachineId,
    disabled: m.id !== "umc500",
    onPress: () => setArMachine(m.id),
  }));

  return (
    <div className="relative h-full w-full">
      <Canvas dpr={[1, 1.75]} camera={{ fov: getPreviewCamera(mode).fov }} gl={{ antialias: true, alpha: true }}>
        <XR store={xrStore}>
          <ArPassthrough onSessionInfo={onSessionInfo} />
          <PreviewFraming mode={mode} />
          {/* Low ambient and a key from the front right, so the light grey
              sheet metal keeps its edges instead of washing out to white. */}
          <ambientLight intensity={0.35} />
          <hemisphereLight intensity={0.7} groundColor="#15202c" />
          <directionalLight position={[4, 6, 5]} intensity={1.9} />
          <directionalLight position={[-5, 3.5, -2]} intensity={0.55} />
          <directionalLight position={[0, 4, -6]} intensity={0.45} />

          <XROrigin ref={originRef}>{mode === "glasses" && <WristMenu machines={machines} />}</XROrigin>
          {mode === "glasses" && (
            <>
              <XrLocomotion originRef={originRef} slide={slide} />
              <TeleportFloor originRef={originRef} />
            </>
          )}

          <HapticsBridge />
          {mode === "glasses" ? (
            <GlassesPlacement preview={placement} onPose={onPose}>
              {(placing) => (
                <MachineStation gameMode={gameMode} boards={!placing} adjustable interactive={!placing} />
              )}
            </GlassesPlacement>
          ) : (
            <group position={placement}>
              <MachineStation gameMode={gameMode} boards adjustable interactive />
            </group>
          )}
        </XR>
      </Canvas>
    </div>
  );
}
