"use client";

import { Suspense, useRef } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { XR, type createXRStore } from "@react-three/xr";
import type * as THREE from "three";
import type { GameMode } from "@/entities/machine/machine-types";
import type { Station } from "@/entities/world/layout";
import { useWarehouseStore } from "@/features/warehouse/warehouse-api";
import { WORLD, useWorldStore } from "@/features/world/world-store";
import { CabinetDisplay } from "@/widgets/warehouse-scene/warehouse-scene";
import { ToolCart, ToolCrib } from "@/widgets/tooling/tool-racks";
import { MachineStation } from "@/widgets/vr-scene/machine-station";
import { DesktopNavigator } from "./desktop-navigator";
import { LevelTerminal, ProgressWall } from "./lobby-boards";
import { Rooms } from "./rooms";
import { WorldLighting } from "./world-lighting";
import { PlayerOrigin, PreviewCamera, VrLocomotion, teleportTo } from "./vr-locomotion";
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

/** On a desktop, a click on a station from across the room walks to it. */
function useWalkTo(station: Station, desktop: boolean) {
  const view = useWorldStore((s) => s.view);
  const goTo = useWorldStore((s) => s.goTo);
  const here = view.kind === "station" && view.id === station.id;
  const onClick =
    desktop && !here
      ? (event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation();
          goTo(station.id);
        }
      : undefined;
  return { here, onClick };
}

function MachineBay({ station, desktop, gameMode }: { station: Station; desktop: boolean; gameMode: GameMode }) {
  const { here, onClick } = useWalkTo(station, desktop);
  return (
    <StationFrame station={station}>
      <group onClick={onClick}>
        <MachineStation
          gameMode={gameMode}
          boards={!desktop}
          adjustable={false}
          interactive={!desktop || here}
          focusPanel={desktop && here}
        />
      </group>
    </StationFrame>
  );
}

function WarehouseCorner({ station, desktop }: { station: Station; desktop: boolean }) {
  const parts = useWarehouseStore((s) => s.parts);
  const selected = useWorldStore((s) => s.selectedPart);
  const selectPart = useWorldStore((s) => s.selectPart);
  const { here, onClick } = useWalkTo(station, desktop);
  return (
    <StationFrame station={station}>
      <group onClick={onClick}>
        <CabinetDisplay
          parts={parts}
          selected={selected}
          onSelect={(id) => {
            // From across the room, a click on a part walks to the cabinet first.
            if (desktop && !here) useWorldStore.getState().goTo(station.id);
            selectPart(id === selected ? null : id);
          }}
        />
      </group>
    </StationFrame>
  );
}

/** The tool crib and the machines' carts: a click on a tool walks there and
 *  picks it (on a desktop), so the panel can show it. */
function ToolStation({ station, desktop }: { station: Station; desktop: boolean }) {
  const selected = useWorldStore((s) => s.selectedTool);
  const { here, onClick } = useWalkTo(station, desktop);
  const pick = (id: string) => {
    if (desktop && !here) useWorldStore.getState().goTo(station.id);
    useWorldStore.getState().selectTool(id === selected ? null : id);
  };
  return (
    <StationFrame station={station}>
      <group onClick={onClick}>
        {station.kind === "toolcart" && station.machineId ? (
          <ToolCart machineId={station.machineId} selected={here || !desktop ? selected : null} onSelect={pick} />
        ) : (
          <ToolCrib selected={here || !desktop ? selected : null} onSelect={pick} />
        )}
      </group>
    </StationFrame>
  );
}

/** Floors take the teleport arc and move the player's origin. */
function TeleportFloors({ originRef }: { originRef: React.RefObject<THREE.Group | null> }) {
  const camera = useThree((s) => s.camera);
  return <Rooms layout={WORLD} onTeleport={(point) => teleportTo(originRef.current, point, camera)} />;
}

/**
 * The workshop: rooms, the machines in their bays with their tool carts, the
 * warehouse, the tool crib, the level terminal and the progress wall. A desktop walks it with the keyboard and
 * mouse; a VR headset walks, teleports and turns. AR glasses and phones see
 * only the machine (ArScene) — their own room is the setting.
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
            {desktop ? <Rooms layout={WORLD} /> : <TeleportFloors originRef={originRef} />}

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
              <PlayerOrigin originRef={originRef} />
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
