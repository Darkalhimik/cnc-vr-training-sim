"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { XR, XROrigin, useXR, type createXRStore } from "@react-three/xr";
import * as THREE from "three";
import { MACHINES, machineById } from "@/entities/catalog/machines";
import type { DeviceMode, GameMode } from "@/entities/machine/machine-types";
import { insideBox } from "@/entities/world/layout";
import { useSessionStore } from "@/features/session/session-store";
import { useWorldStore } from "@/features/world/world-store";
import { HapticsBridge, pulse } from "@/features/xr/haptics";
import { StickTeleport, XrLocomotion, slideAroundBox, useFloorTeleport, type FloorBox } from "@/features/xr/locomotion";
import { AR_STAND, AR_STAND_IN_MACHINE, getPreviewCamera, getSceneGroupPosition } from "./layout";
import { MachineStation } from "./machine-station";
import { WristMenu } from "./wrist-menu";

type ArMode = Extract<DeviceMode, "glasses" | "phone">;

type ArSceneProps = {
  mode: ArMode;
  gameMode: GameMode;
  xrStore: ReturnType<typeof createXRStore>;
  onSessionInfo: (info: string | null) => void;
};

/** Where the machine stands on the floor, and its turn about +Y. */
type Pose = { position: THREE.Vector3; yaw: number };

/** How wide the preview must show: the machine and the boards either side. */
const PREVIEW_SPAN = 6.4;

/**
 * The page's view before the session starts: from the preview spot, backed
 * off along its line of sight until the machine and its boards fit across a
 * narrow (portrait) canvas too. In the session the glasses or phone drive
 * the camera.
 */
function PreviewFraming({ mode }: { mode: ArMode }) {
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

/** A soft dark disc that grounds the machine on a real floor. */
function BlobShadow() {
  const texture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(0,0,0,0.55)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
      <planeGeometry args={[4, 4]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/** Where the machine stands when a session starts: in front of where the
 *  trainee stands then, facing them (the reference space's origin is that
 *  spot, looking down −z). */
const startPose = (mode: ArMode): Pose => ({ position: new THREE.Vector3(...getSceneGroupPosition(mode)), yaw: 0 });

/**
 * The machine, the trainee's rig and how they get about, inside the canvas.
 * As in the first AR version, there is no placing step: the machine stands
 * on the floor in front of where the trainee starts (AR_STAND), facing them,
 * and stays there. In the glasses, "Bring machine here" on the left wrist
 * puts it in front of them again; nothing else moves it until the page is
 * loaded again.
 */
function ArWorld({ mode, gameMode }: { mode: ArMode; gameMode: GameMode }) {
  const camera = useThree((s) => s.camera);
  const session = useXR((s) => s.session);
  const originRef = useRef<THREE.Group>(null);
  // Set once per page load; only bringHere changes it.
  const [pose, setPose] = useState<Pose>(() => startPose(mode));
  const machineScale = useSessionStore((s) => s.machineScale);
  const machineYaw = useSessionStore((s) => s.machineYaw);
  const arMachineId = useWorldStore((s) => s.arMachineId);
  const setArMachine = useWorldStore((s) => s.setArMachine);

  /** In front of the trainee's head as it is now, facing them — as far as
   *  suits the machine at its present size; null when the gaze is straight
   *  up or down. */
  const inFrontOfHead = (): Pose | null => {
    const head = camera.getWorldPosition(new THREE.Vector3());
    const ahead = camera.getWorldDirection(new THREE.Vector3()).setY(0);
    if (ahead.lengthSq() < 1e-6) return null;
    ahead.normalize();
    const right = new THREE.Vector3(-ahead.z, 0, ahead.x);
    const position = head
      .addScaledVector(ahead, AR_STAND.distance * machineScale)
      .addScaledVector(right, -AR_STAND.side * machineScale)
      .setY(0);
    // The machine's front (+z) looks back along the trainee's gaze.
    return { position, yaw: Math.atan2(-ahead.x, -ahead.z) };
  };

  // The machine moves only when the trainee moves it — "Bring machine here",
  // or loading the page again. A new session only puts the trainee's rig
  // back where they stand; the session's floor space (local-floor) starts at
  // their feet looking down −z, so the machine's spot is in front of them.
  useEffect(() => {
    originRef.current?.position.set(0, 0, 0);
    originRef.current?.rotation.set(0, 0, 0);
  }, [session]);

  const bringHere = () => {
    const p = inFrontOfHead();
    if (!p) return;
    setPose(p);
    pulse("detent");
  };

  // The machine on the floor, for walking round it and landing beside it.
  const box = useMemo((): FloorBox => {
    const [w, d] = machineById(arMachineId)?.footprint ?? [2.9, 2.8];
    return {
      center: [pose.position.x, pose.position.z],
      yaw: pose.yaw + machineYaw,
      half: [(w * machineScale) / 2, (d * machineScale) / 2],
    };
  }, [arMachineId, machineScale, machineYaw, pose]);
  const slide = useMemo(() => slideAroundBox(() => box), [box]);
  const canStand = useMemo(() => (p: [number, number]) => !insideBox(box, p), [box]);
  const { floor, marker } = useFloorTeleport(originRef, canStand);

  // Only the UMC-500 has a working model and control today; the others are
  // listed so the menu reads the same when they arrive.
  const machines = MACHINES.map((m) => ({
    label: m.name,
    current: m.id === arMachineId,
    disabled: m.id !== "umc500",
    onPress: () => setArMachine(m.id),
  }));
  const glasses = mode === "glasses";

  return (
    <>
      <XROrigin ref={originRef}>
        {glasses && (
          <>
            <WristMenu machines={machines} actions={[{ label: "Bring machine here", onPress: bringHere }]} />
            <StickTeleport originRef={originRef} canStand={canStand} />
          </>
        )}
      </XROrigin>
      {glasses && <XrLocomotion originRef={originRef} slide={slide} />}
      {/* The trainee's own floor, invisible: pressing on it teleports there
          (in the glasses, Teleport mode). The machine and the boards are
          nearer along any ray aimed at them, so those presses press them. */}
      {glasses && floor && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} {...floor}>
            <planeGeometry args={[80, 80]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
          </mesh>
          {marker}
        </>
      )}

      <group position={pose.position} rotation={[0, pose.yaw, 0]}>
        <MachineStation gameMode={gameMode} boards adjustable interactive stand={AR_STAND_IN_MACHINE} />
        <group scale={machineScale}>
          <BlobShadow />
        </group>
      </group>
    </>
  );
}

/**
 * Augmented reality: the machine alone, in the trainee's own room — AR
 * glasses or a phone. No workshop around it: the room they are standing in is
 * the backdrop. Everything the side panel holds stands beside it as boards.
 * Getting about in the glasses is as in VR glasses (XrLocomotion: teleport,
 * walk or the stick), with nothing to bump into but the machine; a phone is
 * simply carried round it.
 */
export function ArScene({ mode, gameMode, xrStore, onSessionInfo }: ArSceneProps) {
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

          <HapticsBridge />
          <ArWorld mode={mode} gameMode={gameMode} />
        </XR>
      </Canvas>
    </div>
  );
}
