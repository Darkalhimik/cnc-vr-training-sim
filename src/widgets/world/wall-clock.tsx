"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

const noRaycast = () => {};
const SIZE = 256;

function paintFace(ctx: CanvasRenderingContext2D, now: Date) {
  const c = SIZE / 2;
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = "#f4f3ef";
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1c1d1f";
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const long = i % 5 === 0;
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(a);
    ctx.fillRect(-(long ? 3 : 1), -c + 10, long ? 6 : 2, long ? 20 : 9);
    ctx.restore();
  }
  const hand = (angle: number, length: number, width: number, color: string) => {
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.fillRect(-width / 2, -length, width, length + 14);
    ctx.restore();
  };
  const h = now.getHours() % 12;
  const m = now.getMinutes();
  hand(((h + m / 60) / 12) * Math.PI * 2, c * 0.5, 9, "#1c1d1f");
  hand((m / 60) * Math.PI * 2, c * 0.78, 6, "#1c1d1f");
  ctx.fillStyle = "#c4281c";
  ctx.beginPath();
  ctx.arc(c, c, 7, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * A plain wall clock showing the trainee's own time — a real room has one,
 * and it says how long the session has run. Repainted once a minute.
 */
export function WallClock({ position, yaw }: { position: [number, number, number]; yaw: number }) {
  const face = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = SIZE;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return { canvas, texture };
  }, []);

  useEffect(() => {
    const paint = () => {
      paintFace(face.canvas.getContext("2d")!, new Date());
      face.texture.needsUpdate = true;
    };
    paint();
    const timer = setInterval(paint, 30_000);
    return () => {
      clearInterval(timer);
      face.texture.dispose();
    };
  }, [face]);

  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.01]} raycast={noRaycast}>
        <cylinderGeometry args={[0.2, 0.2, 0.04, 40]} />
        <meshStandardMaterial color="#2c3036" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.011]} raycast={noRaycast}>
        <circleGeometry args={[0.18, 40]} />
        <meshBasicMaterial map={face.texture} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}
