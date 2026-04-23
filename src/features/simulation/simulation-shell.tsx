"use client";

import { useEffect } from "react";
import type { DeviceMode, GameMode } from "@/entities/machine/machine-types";
import { useSessionStore } from "@/features/session/session-store";
import { FreePlayOverlay } from "@/features/free-play/ui/freeplay-overlay";
import { ClientOnly } from "@/shared/ui/client-only";
import { HudLayout } from "@/widgets/hud/hud-layout";
import { HudMachineStatus } from "@/widgets/hud/hud-machine-status";
import { HudNotification } from "@/widgets/hud/hud-notification";
import { HudToolbar } from "@/widgets/hud/hud-toolbar";
import { HudTutorialTracker } from "@/widgets/hud/hud-tutorial-tracker";
import { VrScene } from "@/widgets/vr-scene/vr-scene";

interface SimulationShellProps {
  deviceMode: DeviceMode;
  gameMode: GameMode;
}

export function SimulationShell({ deviceMode, gameMode }: SimulationShellProps) {
  const setDeviceMode = useSessionStore((state) => state.setDeviceMode);
  const setGameMode = useSessionStore((state) => state.setGameMode);

  useEffect(() => {
    setDeviceMode(deviceMode);
    setGameMode(gameMode);
  }, [deviceMode, gameMode, setDeviceMode, setGameMode]);

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-bg-primary">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.18),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.14),transparent_28%)]" />

      <ClientOnly>
        <VrScene mode={deviceMode} gameMode={gameMode} />
      </ClientOnly>

      <HudLayout
        topLeft={<HudToolbar />}
        topRight={<HudMachineStatus />}
        bottomLeft={gameMode === "tutorial" ? <HudTutorialTracker /> : <FreePlayOverlay />}
        bottomRight={<HudNotification />}
      />
    </div>
  );
}
