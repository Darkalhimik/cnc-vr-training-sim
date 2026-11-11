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
import { useUsbStick } from "@/features/part-development/use-usb-stick";
import { useSessionStore } from "@/features/session/session-store";
import { usePendantKeyboard } from "@/features/session/use-pendant-keyboard";
import { useToolingStore } from "@/features/tooling/tooling-store";
import { useFreePlayTools } from "@/features/tooling/use-free-play-tools";
import { useTutorialSync } from "@/features/tutorial/tutorial-store";
import { useSession } from "@/shared/lib/auth-client";
import { cn } from "@/shared/lib/cn";
import { ChevronDownIcon, ChevronUpIcon } from "@/shared/ui/icons";
import { ClientOnly } from "@/shared/ui/client-only";
import { ProgramEditorOverlay } from "@/widgets/gcode-editor";
import { HudNotification } from "@/widgets/hud/hud-notification";
import { HudSidePanel } from "@/widgets/hud/hud-side-panel";
import { ArScene } from "@/widgets/vr-scene/ar-scene";
import { WorldScene } from "@/widgets/world/world-scene";
import { ArMenu, ToolCartPanel, ToolboxPanel, WarehousePanel, WorldPanel } from "./world-panels";
import { WORLD, machineStation, useWorldStore } from "./world-store";

/**
 * What the keys and the mouse do right now, over the stage: the station under
 * the pointer and what a click on it does, and whether the keyboard walks or
 * types into the full panel.
 */
function DesktopHints() {
  const hovered = useWorldStore((s) => (s.hovered ? stationById(WORLD, s.hovered) : null));
  const menuOpen = useWorldStore((s) => s.view.kind === "station");
  const typing = useSessionStore((s) => s.fullPanelOpen && s.panelKeyboard);
  const crouching = useWorldStore((s) => s.crouching);
  const chip = "rounded-md bg-background/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur";
  return (
    <>
      {hovered && (
        <p className={cn(chip, "pointer-events-none absolute bottom-14 left-1/2 z-10 -translate-x-1/2 text-foreground")}>
          {hovered.label} · click to use
        </p>
      )}
      {/* Keys and a mouse: no use reading about them on a phone. */}
      <p className={cn(chip, "pointer-events-none absolute bottom-4 left-4 z-10 max-md:hidden")}>
        {typing
          ? "The keyboard types into the control · Esc or a click elsewhere to walk again"
          : `${crouching ? "Crouching: tap Ctrl to stand · " : ""}WASD to walk · Shift to run · Ctrl to crouch · drag to look · wheel to zoom · click a machine or station to use it${menuOpen ? " · Esc closes its menu" : ""}`}
      </p>
    </>
  );
}

/**
 * Why an XR session cannot start here, in words the trainee can act on —
 * or null when it can. Browsers give WebXR only to secure pages (https, or
 * localhost): opened over http by the laptop's address, even a Quest's own
 * browser has no navigator.xr at all.
 */
async function whyNoXr(mode: "immersive-vr" | "immersive-ar"): Promise<string | null> {
  if (!window.isSecureContext) {
    return `WebXR works only on secure pages. Open https://${window.location.host}${window.location.pathname} — this page came over http.`;
  }
  const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
  if (!xr) return "This browser has no WebXR. Open the page in the glasses' own browser (Meta Quest Browser) or in Chrome on a phone.";
  const supported = await xr.isSessionSupported(mode).catch(() => false);
  if (!supported) {
    return mode === "immersive-vr"
      ? "This device does not offer VR sessions."
      : "This device does not offer AR (passthrough) sessions.";
  }
  return null;
}

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
  /** On a phone the panel can be folded away under the stage. */
  const [panelOpen, setPanelOpen] = useState(true);

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
    // AR has no workshop: the station's (or level's) machine is the one out.
    const machineId = station?.machineId ?? level?.machineId;
    if (machineId) useWorldStore.getState().setArMachine(machineId);
    if (!station) return;
    const arrive = useWorldStore.getState().arrive;
    arrive(station.id);
  });

  // Movement in the glasses: the teleport arc only when teleporting.
  const xrMovement = useSessionStore((s) => s.xrMovement);
  useEffect(() => useSessionStore.getState().loadXrMovement(), []);
  useEffect(() => {
    const teleportPointer = xrMovement === "teleport";
    xrStore.setController({ teleportPointer });
    xrStore.setHand({ teleportPointer });
  }, [xrStore, xrMovement]);

  useLevelRuntime(level ? level.kind : "freeplay", level?.id ?? null);
  const gameMode = useGameMode();
  useTutorialSync(gameMode === "tutorial");

  const view = useWorldStore((s) => s.view);
  const station = view.kind === "station" ? stationById(WORLD, view.id) : null;
  const atMachine = station?.kind === "machine";
  const passthrough = device === "glasses" || device === "phone";
  const arMachineId = useWorldStore((s) => s.arMachineId);
  const machine =
    machineById(passthrough ? arMachineId : (station?.machineId ?? level?.machineId ?? MACHINES[0].id)) ?? MACHINES[0];
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
  useUsbStick();

  const workspaceOpen = useJobStore((s) => s.workspaceOpen);
  const showWorkspace = device === "desktop" && atMachine && gameMode !== "tutorial" && workspaceOpen;

  const enterImmersive = async () => {
    setXrError(null);
    const blocked = await whyNoXr(device === "vr" ? "immersive-vr" : "immersive-ar");
    if (blocked) return setXrError(blocked);
    try {
      if (device === "vr") await xrStore.enterVR();
      else await xrStore.enterAR();
    } catch (error) {
      const reason = error instanceof Error && error.message ? ` (${error.message})` : "";
      setXrError(`The ${device === "vr" ? "VR" : "AR"} session did not start${reason}.`);
    }
  };

  // The panel fills its slot: a column from md up, the lower part of the
  // screen on a phone (see the layout below).
  const panelClass = "min-h-0 w-full flex-1 max-md:border-l-0";
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
      >
        <ArMenu device={device} />
      </HudSidePanel>
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
    // From md up the panel is a column beside the stage. On a phone it sits
    // under the stage instead — beside it, it would leave the machine a
    // sliver — and folds away to give the stage the whole screen.
    <div className="flex h-dvh w-screen flex-col overflow-hidden md:flex-row">
      <div className="relative min-h-0 min-w-0 flex-1 bg-stage">
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

        {device === "desktop" && <DesktopHints />}

        <div className="pointer-events-none absolute bottom-4 right-4 z-20">
          <div className="pointer-events-auto">
            <HudNotification />
          </div>
        </div>

        {!panelOpen && (
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="absolute bottom-3 left-1/2 z-20 inline-flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-full border bg-background/90 px-4 text-xs font-medium shadow-sm backdrop-blur md:hidden"
          >
            <ChevronUpIcon />
            Show panel
          </button>
        )}
      </div>
      <div className={cn("flex min-h-0 shrink-0 flex-col md:w-80", panelOpen ? "max-md:h-[45dvh]" : "max-md:hidden")}>
        <button
          type="button"
          onClick={() => setPanelOpen(false)}
          className="flex h-8 shrink-0 items-center justify-center gap-1.5 border-t bg-background text-xs text-muted-foreground md:hidden"
        >
          <ChevronDownIcon />
          Hide panel
        </button>
        {panel}
      </div>
      <ProgramEditorOverlay />
    </div>
  );
}
