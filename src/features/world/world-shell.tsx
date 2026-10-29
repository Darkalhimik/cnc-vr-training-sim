"use client";

import { useEffect, useMemo, useState } from "react";
import { createXRStore } from "@react-three/xr";
import { levelById } from "@/entities/catalog/levels";
import { MACHINES, machineById } from "@/entities/catalog/machines";
import type { DeviceMode } from "@/entities/machine/machine-types";
import { stationById } from "@/entities/world/layout";
import { useWarehouseStore } from "@/features/warehouse/warehouse-api";
import { useGameMode, useLevelRuntime } from "@/features/levels/level-session";
import { PartWorkspace } from "@/features/part-development/ui/workspace";
import { useJobStore } from "@/features/part-development/job-store";
import { useSessionStore } from "@/features/session/session-store";
import { usePendantKeyboard } from "@/features/session/use-pendant-keyboard";
import { useToolingStore } from "@/features/tooling/tooling-store";
import { useFreePlayTools } from "@/features/tooling/use-free-play-tools";
import { useTutorialSync } from "@/features/tutorial/tutorial-store";
import { useSession } from "@/shared/lib/auth-client";
import { ClientOnly } from "@/shared/ui/client-only";
import { ProgramEditorOverlay } from "@/widgets/gcode-editor";
import { HudNotification } from "@/widgets/hud/hud-notification";
import { HudSidePanel } from "@/widgets/hud/hud-side-panel";
import { ArScene } from "@/widgets/vr-scene/ar-scene";
import { WorldScene } from "@/widgets/world/world-scene";
import { ToolCartPanel, ToolboxPanel, WarehousePanel, WorldPanel } from "./world-panels";
import { WORLD, machineStation, useWorldStore } from "./world-store";

type Props = {
  device: DeviceMode;
  /** The level to start, from the URL. */
  levelId: string | null;
  /** A station to start at instead of the lobby: a machine id, "warehouse"… */
  at: string | null;
};

/**
 * The trainer itself. On a desktop and in a VR headset it is the workshop —
 * lobby and shop, walked; AR glasses and phones get the machine alone in
 * their own room. Levels start here from the URL or from the terminal, and
 * the page never changes while playing, so a headset session survives a
 * level change.
 */
export function WorldShell({ device, levelId, at }: Props) {
  const level = levelId ? levelById(levelId) : null;
  const setDeviceMode = useSessionStore((s) => s.setDeviceMode);
  const setGameMode = useSessionStore((s) => s.setGameMode);
  const { data, isPending } = useSession();
  const loadWarehouse = useWarehouseStore((s) => s.load);
  const loadTooling = useToolingStore((s) => s.load);
  const [xrError, setXrError] = useState<string | null>(null);
  const [xrSessionInfo, setXrSessionInfo] = useState<string | null>(null);

  // The headset gets the teleport arc on its controllers and hands; hands
  // poke and pinch by default. `emulate: false` because @pmndrs/xr otherwise
  // injects the IWER emulator in development, and its DevUI's second WebGL
  // context, when it cannot be created, takes the whole scene down with it.
  const xrStore = useMemo(
    () =>
      createXRStore({
        emulate: false,
        controller: { teleportPointer: true },
        hand: { teleportPointer: true },
        foveation: 1,
      }),
    [],
  );

  // Where the trainee starts: at the station asked for, at the level's
  // machine, or in the lobby. Set before the first frame, so the camera and
  // the headset's origin start there rather than flying in.
  useState(() => {
    // Old links said ?at=cabinet; the cabinet is in the warehouse now.
    const asked = at === "cabinet" ? "warehouse" : at;
    const stationId = asked && stationById(WORLD, asked) ? asked : (level && machineStation(level.machineId)?.id) || null;
    const station = stationId ? stationById(WORLD, stationId) : null;
    if (!station) return;
    const arrive = useWorldStore.getState().arrive;
    arrive(station.id);
  });

  useLevelRuntime(level ? level.kind : "freeplay", level?.id ?? null);
  const gameMode = useGameMode();
  useTutorialSync(gameMode === "tutorial");

  const view = useWorldStore((s) => s.view);
  const station = view.kind === "station" ? stationById(WORLD, view.id) : null;
  const atMachine = station?.kind === "machine";
  const machine = machineById(station?.machineId ?? level?.machineId ?? MACHINES[0].id) ?? MACHINES[0];
  const passthrough = device === "glasses" || device === "phone";
  usePendantKeyboard(device === "desktop" && (atMachine || passthrough));

  useEffect(() => {
    setDeviceMode(device);
    setGameMode(gameMode);
  }, [device, gameMode, setDeviceMode, setGameMode]);

  // The warehouse and the progress wall stand in the lobby: load what they
  // show. The trainee's tool loadouts too: free play runs with them.
  useEffect(() => {
    if (isPending) return;
    void loadWarehouse(data?.user.id ?? null);
    void loadTooling(data?.user.id ?? null);
  }, [data?.user.id, isPending, loadWarehouse, loadTooling]);
  useFreePlayTools(machine.id, gameMode === "freeplay");

  const workspaceOpen = useJobStore((s) => s.workspaceOpen);
  const showWorkspace = device === "desktop" && atMachine && gameMode !== "tutorial" && workspaceOpen;

  const enterImmersive = async () => {
    try {
      setXrError(null);
      if (device === "vr") await xrStore.enterVR();
      else await xrStore.enterAR();
    } catch {
      setXrError("A WebXR session could not start on this device.");
    }
  };

  const panelClass = "w-80 shrink-0";
  let panel: React.ReactNode;
  if (passthrough) {
    panel = (
      <HudSidePanel
        machine={machine}
        deviceMode={device}
        gameMode={gameMode}
        xrError={xrError}
        xrSessionInfo={xrSessionInfo}
        onEnterImmersive={enterImmersive}
        back={{ label: "Levels", href: `/machines/${machine.slug}/levels` }}
        adjustable
        className={panelClass}
      />
    );
  } else if (device === "desktop" && atMachine) {
    panel = (
      <HudSidePanel
        machine={machine}
        deviceMode={device}
        gameMode={gameMode}
        xrError={xrError}
        xrSessionInfo={xrSessionInfo}
        onEnterImmersive={enterImmersive}
        back={{ label: "Workshop", onClick: () => useWorldStore.getState().leave() }}
        adjustable={false}
        className={panelClass}
      />
    );
  } else if (device === "desktop" && station?.kind === "warehouse") {
    panel = <WarehousePanel className={panelClass} />;
  } else if (device === "desktop" && station?.kind === "toolbox") {
    panel = <ToolboxPanel className={panelClass} />;
  } else if (device === "desktop" && station?.kind === "toolcart" && station.machineId) {
    panel = <ToolCartPanel machineId={station.machineId} className={panelClass} />;
  } else {
    panel = <WorldPanel device={device} onEnterImmersive={enterImmersive} xrError={xrError} className={panelClass} />;
  }

  return (
    <div className="flex h-dvh w-screen overflow-hidden">
      <div className="relative min-w-0 flex-1 bg-stage">
        <ClientOnly>
          {passthrough ? (
            <ArScene mode={device} gameMode={gameMode} xrStore={xrStore} onSessionInfo={setXrSessionInfo} />
          ) : (
            <WorldScene device={device} gameMode={gameMode} xrStore={xrStore} />
          )}
        </ClientOnly>

        {/* The design and program workspace sits over the left of the stage,
            so the machine stays in view beside it. */}
        {showWorkspace && (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10">
            <PartWorkspace />
          </div>
        )}

        {device === "desktop" && view.kind === "walk" && (
          <p className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-md bg-background/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
            WASD to walk · drag to look · click a station to go to it
          </p>
        )}

        <div className="pointer-events-none absolute bottom-4 right-4 z-20">
          <div className="pointer-events-auto">
            <HudNotification />
          </div>
        </div>
      </div>
      {panel}
      <ProgramEditorOverlay />
    </div>
  );
}
