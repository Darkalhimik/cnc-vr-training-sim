"use client";

import { useEffect, useMemo, useState } from "react";
import { createXRStore } from "@react-three/xr";
import type { DeviceMode, GameMode } from "@/entities/machine/machine-types";
import { useSessionStore } from "@/features/session/session-store";
import { ClientOnly } from "@/shared/ui/client-only";
import { HudNotification } from "@/widgets/hud/hud-notification";
import { HudSidePanel } from "@/widgets/hud/hud-side-panel";
import { VrScene } from "@/widgets/vr-scene/vr-scene";

interface SimulationShellProps {
  deviceMode: DeviceMode;
  gameMode: GameMode;
}

export function SimulationShell({ deviceMode, gameMode }: SimulationShellProps) {
  const setDeviceMode = useSessionStore((state) => state.setDeviceMode);
  const setGameMode = useSessionStore((state) => state.setGameMode);

  // The XR store lives here rather than in the scene: the side panel owns the
  // Enter VR / Enter AR control, and the scene owns the <XR> provider that
  // consumes the same store.
  // `emulate: false` because @pmndrs/xr otherwise injects the IWER emulator in
  // development, and its DevUI builds a second WebGLRenderer of its own. When
  // that extra context cannot be created the error escapes createXRStore and
  // takes the whole 3D scene down with it — a blank stage, no model request, no
  // message. A real headset is unaffected, and a WebXR emulator extension
  // already supplies navigator.xr when one is installed.
  const xrStore = useMemo(() => createXRStore({ emulate: false }), []);
  const [xrError, setXrError] = useState<string | null>(null);
  const [xrSessionInfo, setXrSessionInfo] = useState<string | null>(null);

  useEffect(() => {
    setDeviceMode(deviceMode);
    setGameMode(gameMode);
  }, [deviceMode, gameMode, setDeviceMode, setGameMode]);

  const startImmersiveMode = async () => {
    try {
      setXrError(null);
      if (deviceMode === "vr") {
        await xrStore.enterVR();
      } else if (deviceMode === "ar") {
        await xrStore.enterAR();
      }
    } catch {
      setXrError("WebXR session could not start on this device.");
    }
  };

  return (
    <div className="flex h-dvh w-screen overflow-hidden">
      {/* `bg-stage`, not `bg-background`: the machine's shell is light grey and
          would disappear on a white page, so the stage stays dark in both
          themes while the panel beside it follows the theme. */}
      <div className="relative min-w-0 flex-1 bg-stage">
        <ClientOnly>
          <VrScene
            mode={deviceMode}
            gameMode={gameMode}
            xrStore={xrStore}
            onSessionInfo={setXrSessionInfo}
          />
        </ClientOnly>

        {/* Toasts stay over the viewport — they report what an interaction with
            the machine just did, and belong next to the machine, not filed in
            the panel. */}
        <div className="pointer-events-none absolute bottom-4 right-4 z-20">
          <div className="pointer-events-auto">
            <HudNotification />
          </div>
        </div>
      </div>

      <HudSidePanel
        deviceMode={deviceMode}
        gameMode={gameMode}
        xrError={xrError}
        xrSessionInfo={xrSessionInfo}
        onEnterImmersive={startImmersiveMode}
        className="w-80 shrink-0"
      />
    </div>
  );
}
