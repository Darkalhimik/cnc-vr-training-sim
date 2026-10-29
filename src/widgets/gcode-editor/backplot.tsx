"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { JAW_GRIP, type Stock } from "@/entities/part/part-design";
import { segmentsOnLine, type SegmentSet, type Toolpath } from "./toolpath";

/**
 * Feed colours by tool, bright enough on the dark stage. The backplot sits on
 * the stage colour in both themes, like the machine, so one set serves both.
 */
export const TOOL_COLORS = ["#38bdf8", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#2dd4bf", "#fb923c", "#a3e635"];
export const toolColor = (tool: number) => (tool > 0 ? TOOL_COLORS[(tool - 1) % TOOL_COLORS.length] : "#a1a1aa");

const RAPID = "#71717a";
const HIGHLIGHT = "#ffffff";

/** Vise body width along X and depth along Y (program-check.ts). */
const VISE: [number, number] = [140, 70];

type Hover = { line: number; program?: string; kind: "rapid" | "feed"; tool?: number; x: number; y: number };

function useGeometry(positions: Float32Array | number[]) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(positions instanceof Float32Array ? positions : new Float32Array(positions), 3),
    );
    return g;
  }, [positions]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

function Segments({
  set,
  color,
  dashed,
  onHover,
  onPick,
}: {
  set: SegmentSet;
  color: string;
  dashed?: boolean;
  onHover: (hit: { segment: number; x: number; y: number } | null) => void;
  onPick: (segment: number) => void;
}) {
  const geometry = useGeometry(set.positions);
  const ref = useRef<THREE.LineSegments>(null);
  useEffect(() => {
    if (dashed) ref.current?.computeLineDistances();
  }, [dashed, geometry]);

  const segmentOf = (e: ThreeEvent<PointerEvent | MouseEvent>) => Math.floor((e.index ?? 0) / 2);

  if (set.lines.length === 0) return null;
  return (
    <lineSegments
      ref={ref}
      geometry={geometry}
      onPointerMove={(e) => {
        e.stopPropagation();
        onHover({ segment: segmentOf(e), x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
      }}
      onPointerOut={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        onPick(segmentOf(e));
      }}
    >
      {dashed ? (
        <lineDashedMaterial color={color} dashSize={3} gapSize={2} transparent opacity={0.8} />
      ) : (
        <lineBasicMaterial color={color} />
      )}
    </lineSegments>
  );
}

/** The blank as an outline, and the plane the vise jaws come up to. */
function Fixture({ stock }: { stock: Stock }) {
  const box = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(stock.x, stock.z, stock.y)), [stock]);
  useEffect(() => () => box.dispose(), [box]);
  const jawWidth = Math.max(VISE[0], stock.x + 50);
  return (
    <group>
      <lineSegments geometry={box} position={[0, -stock.z / 2, 0]} raycast={() => {}}>
        <lineBasicMaterial color="#d4d4d8" transparent opacity={0.7} />
      </lineSegments>
      <mesh position={[0, -stock.z + JAW_GRIP, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
        <planeGeometry args={[jawWidth, VISE[1]]} />
        <meshBasicMaterial color="#f43f5e" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Part zero: X red, Y green, Z blue. The turn maps the helper's own
          axes onto part X, Y (into the screen) and Z (up). */}
      <axesHelper args={[Math.min(stock.x, stock.y) / 3]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}} />
    </group>
  );
}

/** Frames the stock whenever its size changes. */
function Frame({ stock }: { stock: Stock }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  useEffect(() => {
    // Room for the blank and the approach moves above it.
    const r = Math.max(stock.x, stock.y, stock.z) * 2 + 80;
    const target = new THREE.Vector3(0, -stock.z / 2, 0);
    camera.position.set(target.x + r * 0.9, target.y + r * 0.8, target.z + r * 1.2);
    camera.lookAt(target);
    if (controls) {
      controls.target.copy(target);
      controls.update();
    }
  }, [stock.x, stock.y, stock.z, camera, controls]);
  return null;
}

/**
 * The toolpath in 3D: rapids dashed, feeds coloured by tool, the blank and
 * the jaw plane for scale. Hover reads a segment's line; click jumps the
 * editor there; the caret's line is drawn white.
 */
export function Backplot({
  toolpath,
  stock,
  caretLine,
  onPickLine,
}: {
  toolpath: Toolpath | null;
  stock: Stock;
  caretLine: number | null;
  onPickLine: (line: number) => void;
}) {
  const [hover, setHover] = useState<Hover | null>(null);

  const highlight = useMemo(() => {
    if (!toolpath || caretLine === null) return [];
    return [toolpath.rapids, ...toolpath.feeds.map((f) => f.set)].flatMap((set) => segmentsOnLine(set, caretLine));
  }, [toolpath, caretLine]);
  const highlightGeometry = useGeometry(highlight);

  const sets: { key: string; set: SegmentSet; kind: "rapid" | "feed"; tool?: number }[] = toolpath
    ? [
        { key: "rapids", set: toolpath.rapids, kind: "rapid" },
        ...toolpath.feeds.map((f) => ({ key: `t${f.tool}`, set: f.set, kind: "feed" as const, tool: f.tool })),
      ]
    : [];

  return (
    <div className="relative h-full w-full bg-stage" onPointerLeave={() => setHover(null)}>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ fov: 40, near: 1, far: 20000, position: [200, 160, 240] }}
        raycaster={{ params: { Line: { threshold: 1.5 }, Points: { threshold: 1 }, Mesh: {}, LOD: {}, Sprite: {} } }}
        onPointerMissed={() => setHover(null)}
      >
        <OrbitControls makeDefault enableDamping={false} />
        <Frame stock={stock} />
        <Fixture stock={stock} />
        {sets.map(({ key, set, kind, tool }) => (
          <Segments
            key={key}
            set={set}
            color={kind === "rapid" ? RAPID : toolColor(tool!)}
            dashed={kind === "rapid"}
            onHover={(hit) =>
              setHover(
                hit && {
                  line: set.lines[hit.segment],
                  program: set.programs[hit.segment],
                  kind,
                  tool,
                  x: hit.x,
                  y: hit.y,
                },
              )
            }
            onPick={(segment) => {
              if (set.programs[segment] === undefined) onPickLine(set.lines[segment]);
            }}
          />
        ))}
        {highlight.length > 0 && (
          <lineSegments geometry={highlightGeometry} raycast={() => {}} renderOrder={1}>
            <lineBasicMaterial color={HIGHLIGHT} depthTest={false} />
          </lineSegments>
        )}
      </Canvas>

      {hover && (
        <div
          className="pointer-events-none absolute rounded-md bg-background/90 px-2 py-1 font-mono text-[11px] shadow-md ring-1 ring-border"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          L{hover.line}
          {hover.program ? ` (${hover.program})` : ""} · {hover.kind === "rapid" ? "rapid" : `T${hover.tool} feed`}
        </div>
      )}
      {!toolpath && (
        <p className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">Checking the program…</p>
      )}
    </div>
  );
}
