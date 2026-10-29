"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { XRSpace, useRequestXRAnchor, useXR, useXRHitTest, useXRInputSourceState } from "@react-three/xr";
import * as THREE from "three";
import { pulse } from "@/features/xr/haptics";
import { StackBoard, buttonsRow, textRow, PAD } from "./board-kit";

/**
 * Putting the machine in the trainee's own room, with AR glasses. Once the
 * session starts the machine follows a ring on the floor where the right
 * controller (or hand) points; a trigger pull or a pinch puts it down, held
 * by an XR anchor where the headset offers one so it stays put as tracking
 * settles. "Move the machine" picks it up again.
 *
 * Without hit testing the ring sits on the floor 2.5 m ahead of the user.
 * Before the session — the page preview — the machine stands where ArScene
 * puts it for phones.
 */
type Pose = { position: THREE.Vector3; yaw: number };

const NO_HIT_MS = 1500;
const BOARD_W = 1.1;

/** A soft dark disc that grounds the machine on a real floor. */
function useBlobShadow() {
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
  return texture;
}

function BlobShadow() {
  const texture = useBlobShadow();
  return (
    <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
      <planeGeometry args={[4, 4]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function Reticle() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} raycast={() => {}}>
      <ringGeometry args={[0.16, 0.2, 48]} />
      <meshBasicMaterial color="#ffb020" toneMapped={false} />
    </mesh>
  );
}

export function GlassesPlacement({
  preview,
  children,
}: {
  /** Where the machine stands before the session starts. */
  preview: [number, number, number];
  /** The machine and its boards; told whether it is still being placed. */
  children: (placing: boolean) => React.ReactNode;
}) {
  const session = useXR((s) => s.session);
  if (!session) return <group position={preview}>{children(false)}</group>;
  return <Placing session={session}>{children}</Placing>;
}

function Placing({ session, children }: { session: XRSession; children: (placing: boolean) => React.ReactNode }) {
  const camera = useThree((s) => s.camera);
  const requestAnchor = useRequestXRAnchor();
  const controller = useXRInputSourceState("controller", "right");
  const hand = useXRInputSourceState("hand", "right");
  const space = controller?.inputSource.targetRaySpace ?? hand?.inputSource.targetRaySpace;
  const [placed, setPlaced] = useState<Pose | null>(null);
  const [anchor, setAnchor] = useState<XRAnchor | null>(null);
  const follower = useRef<THREE.Group>(null);
  const aim = useRef<Pose & { at: number }>({ position: new THREE.Vector3(), yaw: 0, at: 0 });
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const placing = placed === null;

  /** Faces the machine's front (+z) towards the user. */
  const facingUser = (p: THREE.Vector3) => {
    const head = camera.getWorldPosition(new THREE.Vector3());
    return Math.atan2(head.x - p.x, head.z - p.z);
  };

  useXRHitTest(
    placing
      ? (results, getWorldMatrix) => {
          const hit = results[0];
          if (!hit || !getWorldMatrix(matrix, hit)) return;
          const p = new THREE.Vector3().setFromMatrixPosition(matrix);
          aim.current = { position: p, yaw: facingUser(p), at: performance.now() };
        }
      : undefined,
    space ?? "viewer",
    "plane",
  );

  useFrame(() => {
    if (!placing) return;
    // No floor found lately: the ring waits on the floor straight ahead.
    if (performance.now() - aim.current.at > NO_HIT_MS) {
      const head = camera.getWorldPosition(new THREE.Vector3());
      const ahead = camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize().multiplyScalar(2.5);
      const p = head.add(ahead).setY(0);
      aim.current = { position: p, yaw: facingUser(p), at: aim.current.at };
    }
    const f = follower.current;
    if (f) {
      f.position.copy(aim.current.position);
      f.rotation.set(0, aim.current.yaw, 0);
    }
  });

  // Trigger or pinch while placing puts it down.
  useEffect(() => {
    if (!placing) return;
    const put = async () => {
      const { position, yaw } = aim.current;
      const pose = { position: position.clone(), yaw };
      setPlaced(pose);
      pulse("detent");
      const made = await requestAnchor({
        relativeTo: "world",
        worldPosition: pose.position,
        worldQuaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
      }).catch(() => undefined);
      if (made) setAnchor(made);
    };
    session.addEventListener("select", put);
    return () => session.removeEventListener("select", put);
  }, [placing, session, requestAnchor]);

  const pickUp = () => {
    anchor?.delete();
    setAnchor(null);
    setPlaced(null);
  };

  if (placing) {
    return (
      <group ref={follower}>
        {children(true)}
        <Reticle />
        <BlobShadow />
        <group position={[0, 2.9, 0.4]}>
          <StackBoard
            width={BOARD_W}
            anchor="center"
            rows={[
              textRow("Place the machine", "title", BOARD_W - 2 * PAD, { gap: 0.012 }),
              textRow("Point at the floor where it should stand, then pull the trigger or pinch.", "body", BOARD_W - 2 * PAD),
            ]}
          />
        </group>
      </group>
    );
  }

  const content = (
    <>
      {children(false)}
      <BlobShadow />
      {/* Beside the size lectern, where a hand already goes. */}
      <group position={[-0.25, 1.25, 2.35]} rotation={[0, 0.5, 0]}>
        <StackBoard
          width={0.62}
          anchor="center"
          rows={[buttonsRow([{ label: "Move the machine", onPress: pickUp }], 0.62 - 2 * PAD)]}
        />
      </group>
    </>
  );
  return anchor ? (
    <XRSpace space={anchor.anchorSpace}>{content}</XRSpace>
  ) : (
    <group position={placed.position} rotation={[0, placed.yaw, 0]}>
      {content}
    </group>
  );
}
