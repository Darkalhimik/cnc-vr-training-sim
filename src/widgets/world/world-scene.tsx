"use client";

import { Suspense, useEffect, useRef } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { XR, type createXRStore } from "@react-three/xr";
import type * as THREE from "three";
import type { GameMode } from "@/entities/machine/machine-types";
import { isBlocked, roomAt, type Station } from "@/entities/world/layout";
import { StickTeleport } from "@/features/xr/locomotion";
import { useSessionStore } from "@/features/session/session-store";
import { useWarehouseStore } from "@/features/warehouse/warehouse-api";
import { WORLD, useWorldStore } from "@/features/world/world-store";
import { isDragClick } from "@/shared/lib/pointer";
import { CabinetDisplay } from "@/widgets/warehouse-scene/warehouse-scene";
import { ToolCart, ToolCrib } from "@/widgets/tooling/tool-racks";
import { MachineStation } from "@/widgets/vr-scene/machine-station";
import { DesktopNavigator } from "./desktop-navigator";
import { LevelTerminal, ProgressWall } from "./lobby-boards";
import { Rooms } from "./rooms";
import { WorldLighting } from "./world-lighting";
import { PlayerOrigin, PreviewCamera, VrLocomotion } from "./vr-locomotion";
import { HapticsBridge } from "@/features/xr/haptics";
import { CarryLayer } from "./carry-layer";

type Props = {
  device: "desktop" | "vr";
  gameMode: GameMode;
  xrStore: ReturnType<typeof createXRStore>;
};

/** A station's frame: its position in plan, turned to face its front. */
function StationFrame({ station, children }: { station: Station; children: React.ReactNode }) {
  return (
    <group position={[station.position[0], 0, station.position[1]]} rotation={[0, station.yaw, 0]}>
      {children}
    </group>
  );
}

/** Whether this station's menu is open. */
const useHere = (station: Station) =>
  useWorldStore((s) => s.view.kind === "station" && s.view.id === station.id);

/** How tall each kind of station stands, for its hit box, m. */
const HIT_HEIGHT: Partial<Record<Station["kind"], number>> = { machine: 2.8, warehouse: 2.15, toolbox: 2, toolcart: 1.2 };

/**
 * On a desktop, while a station's menu is closed, an invisible box over it
 * takes the pointer: hovering names it, a click opens its menu where the
 * player stands. Nothing under the box answers until then — so a click never
 * presses a control by surprise — and a box is cheap to hit-test on every
 * pointer move, where a 240k-triangle machine is not.
 */
function StationHitBox({ station }: { station: Station }) {
  const interact = useWorldStore((s) => s.interact);
  const setHovered = useWorldStore((s) => s.setHovered);
  if (!station.footprint) return null;
  // The footprint is turned into the world; the box is in the station's frame.
  const quarter = Math.round(station.yaw / (Math.PI / 2)) % 2 !== 0;
  const w = station.footprint.max[0] - station.footprint.min[0];
  const d = station.footprint.max[1] - station.footprint.min[1];
  const [x, z] = quarter ? [d, w] : [w, d];
  const h = HIT_HEIGHT[station.kind] ?? 2;
  return (
    <mesh
      position={[0, h / 2, 0]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (isDragClick(e)) return;
        interact(station.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(station.id);
      }}
      onPointerOut={() => {
        if (useWorldStore.getState().hovered === station.id) setHovered(null);
      }}
    >
      <boxGeometry args={[x + 0.1, h, z + 0.1]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

function MachineBay({ station, desktop, gameMode }: { station: Station; desktop: boolean; gameMode: GameMode }) {
  const here = useHere(station);
  // The full panel belongs to the machine's menu: it goes when the menu does.
  useEffect(() => {
    if (desktop && !here && useSessionStore.getState().fullPanelOpen) useSessionStore.getState().setFullPanelOpen(false);
  }, [desktop, here]);
  return (
    <StationFrame station={station}>
      <MachineStation gameMode={gameMode} boards={!desktop} adjustable={false} interactive={!desktop || here} />
      {desktop && !here && <StationHitBox station={station} />}
    </StationFrame>
  );
}

function WarehouseCorner({ station, desktop }: { station: Station; desktop: boolean }) {
  const parts = useWarehouseStore((s) => s.parts);
  const selected = useWorldStore((s) => s.selectedPart);
  const selectPart = useWorldStore((s) => s.selectPart);
  const here = useHere(station);
  return (
    <StationFrame station={station}>
      <CabinetDisplay parts={parts} selected={selected} onSelect={(id) => selectPart(id === selected ? null : id)} />
      {desktop && !here && <StationHitBox station={station} />}
    </StationFrame>
  );
}

/** The tool crib and the machines' carts: with the menu open, a click on a
 *  tool picks it, so the panel can show it. */
function ToolStation({ station, desktop }: { station: Station; desktop: boolean }) {
  const selected = useWorldStore((s) => s.selectedTool);
  const here = useHere(station);
  const pick = (id: string) => useWorldStore.getState().selectTool(id === selected ? null : id);
  return (
    <StationFrame station={station}>
      {station.kind === "toolcart" && station.machineId ? (
        <ToolCart machineId={station.machineId} selected={here || !desktop ? selected : null} onSelect={pick} />
      ) : (
        <ToolCrib selected={here || !desktop ? selected : null} onSelect={pick} />
      )}
      {desktop && !here && <StationHitBox station={station} />}
    </StationFrame>
  );
}

/** Where a teleport may land in the workshop: on a floor, clear of walls,
 *  machines and furniture. */
const canStandInWorkshop = (p: [number, number]) => !!roomAt(WORLD, p) && !isBlocked(WORLD, p);

/**
 * The workshop: rooms, the machines in their bays with their tool carts, the
 * warehouse, the tool crib, the level terminal and the progress wall. On a
 * desktop the player walks it with the keyboard and mouse and uses a station
 * through its menu; a VR headset walks, teleports and turns, and uses
 * everything in reach. AR glasses and phones see only the machine (ArScene)
 * — their own room is the setting.
 */
export function WorldScene({ device, gameMode, xrStore }: Props) {
  const desktop = device === "desktop";
  const originRef = useRef<THREE.Group>(null);
  const stations = WORLD.stations;

  return (
    <div className="relative h-full w-full">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ fov: desktop ? 60 : 70, near: 0.05, far: 120 }}
        gl={{ antialias: true }}
        onPointerMissed={() => {
          useWorldStore.getState().selectPart(null);
          useWorldStore.getState().selectTool(null);
        }}
      >
        <color attach="background" args={["#14161a"]} />
        <XR store={xrStore}>
          <WorldLighting />

          <Suspense fallback={null}>
            <Rooms layout={WORLD} />

            {stations.map((s) => {
              switch (s.kind) {
                case "machine":
                  // One working machine today; its state is the machine store's.
                  return s.machineId === "umc500" ? (
                    <MachineBay key={s.id} station={s} desktop={desktop} gameMode={gameMode} />
                  ) : null;
                case "warehouse":
                  return <WarehouseCorner key={s.id} station={s} desktop={desktop} />;
                case "toolbox":
                case "toolcart":
                  return <ToolStation key={s.id} station={s} desktop={desktop} />;
                case "terminal":
                  return (
                    <StationFrame key={s.id} station={s}>
                      <LevelTerminal />
                    </StationFrame>
                  );
                case "progress":
                  return (
                    <group key={s.id} position={[s.position[0], 1.75, s.position[1]]} rotation={[0, s.yaw, 0]}>
                      <ProgressWall />
                    </group>
                  );
                default:
                  return null;
              }
            })}
          </Suspense>

          {desktop ? (
            <DesktopNavigator />
          ) : (
            <>
              <PlayerOrigin originRef={originRef}>
                <StickTeleport originRef={originRef} canStand={canStandInWorkshop} />
              </PlayerOrigin>
              <VrLocomotion originRef={originRef} />
              <PreviewCamera originRef={originRef} />
              <HapticsBridge />
              <CarryLayer />
            </>
          )}
        </XR>
      </Canvas>
    </div>
  );
}
