"use client";

import { Suspense, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { LibraryTool } from "@/entities/part/tool-library";
import { cn } from "@/shared/lib/cn";
import { createToolObject, disposeToolObject } from "@/widgets/vr-scene/tool-body";

const MM = 0.001;
/** How far apart the exploded view pulls the pull stud and the cutter. */
const EXPLODE = { stud: 45 * MM, cutter: 40 * MM };

function StudioReflections() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.7;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

/** A mark under the tool at `y` along its axis: clear of the flange, which
 *  is the widest a CT40 holder gets short of a face mill. The stage is dark
 *  in either theme, so the marks are light. */
function Label({ y, children }: { y: number; children: React.ReactNode }) {
  return (
    <Html position={[-0.042, y, 0]} center={false} style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
      <div className="flex flex-col items-start whitespace-nowrap font-mono text-[10px] text-zinc-300">
        <span className="h-3 w-px bg-current opacity-60" />
        <span className="-translate-x-1/2">{children}</span>
      </div>
    </Html>
  );
}

/** The tool lying left to right, tip to the right; its parts slide apart
 *  along its axis when exploded. */
function ToolModel({ tool, exploded, labels }: { tool: LibraryTool; exploded: boolean; labels: boolean }) {
  const object = useMemo(() => createToolObject(tool, { explodable: true }), [tool]);
  useEffect(() => () => disposeToolObject(object), [object]);
  const stud = object.getObjectByName("PullStud")!;
  const cutter = object.getObjectByName("Cutter")!;

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 8);
    stud.position.y += ((exploded ? EXPLODE.stud : 0) - stud.position.y) * k;
    cutter.position.y += ((exploded ? -EXPLODE.cutter : 0) - cutter.position.y) * k;
  });

  // Centre the tool on its length, from the stud's head to the tip.
  const top = (68.4 + 28) * MM;
  const tip = -tool.length * MM;
  const mid = (top + tip) / 2;
  const face = -(tool.length - tool.stickout) * MM;
  return (
    // Turned a quarter about Z: the tool's +Y (the stud) goes left, its tip right.
    <group rotation={[0, 0, Math.PI / 2]} position={[mid, 0, 0]}>
      <primitive object={object} />
      {labels && !exploded && (
        <>
          <Label y={0}>gauge line</Label>
          <Label y={face}>holder face · {tool.length - tool.stickout} mm</Label>
          <Label y={tip}>tip · {tool.length} mm</Label>
        </>
      )}
    </group>
  );
}

/** Frames the tool's length across the view. */
function Framing({ tool }: { tool: LibraryTool }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  useEffect(() => {
    const length = (tool.length + 100) * MM + 0.09;
    const fitWidth = length / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / (size.width / size.height);
    const fitHeight = 0.09 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(0, 0.02, Math.max(fitWidth, fitHeight) * 1.15);
    camera.lookAt(0, 0, 0);
  }, [camera, size.width, size.height, tool]);
  return null;
}

/**
 * A tool in close-up: its holder and cutter at real size, to turn round and
 * pull apart. Drag turns it, the wheel zooms.
 */
export function ToolViewer({
  tool,
  exploded = false,
  labels = true,
  className,
}: {
  tool: LibraryTool;
  exploded?: boolean;
  labels?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-md bg-stage", className)}>
      <Canvas dpr={[1, 2]} camera={{ fov: 30, near: 0.01, far: 10 }} gl={{ antialias: true }}>
        <StudioReflections />
        <ambientLight intensity={0.4} />
        <directionalLight position={[0.4, 1, 0.8]} intensity={1.4} />
        <Suspense fallback={null}>
          <ToolModel tool={tool} exploded={exploded} labels={labels} />
        </Suspense>
        <Framing tool={tool} />
        <OrbitControls enablePan={false} minDistance={0.08} maxDistance={1.2} />
      </Canvas>
    </div>
  );
}
