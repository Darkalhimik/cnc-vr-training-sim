"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { cn } from "@/shared/lib/cn";
import type { DeviceMode, GameMode } from "@/entities/machine/machine-types";

const gameModes: { value: GameMode; title: string; desc: string }[] = [
  {
    value: "tutorial",
    title: "Tutorial",
    desc: "Guided startup flow with five steps and machine highlights.",
  },
  {
    value: "freeplay",
    title: "Free Play",
    desc: "Inspect the machine and test controls without scripted guidance.",
  },
];

const deviceModes: { value: DeviceMode; title: string; desc: string }[] = [
  { value: "desktop", title: "Desktop", desc: "Mouse and keyboard" },
  { value: "vr", title: "VR", desc: "WebXR headset preview" },
  { value: "ar", title: "Phone AR", desc: "Mobile immersive preview" },
];

export function ModeSelector() {
  const router = useRouter();
  const [gameMode, setGameMode] = useState<GameMode>("tutorial");
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");

  return (
    <Card className="animate-fade-in-up-delay-2 flex flex-col gap-8 bg-bg-glass p-6 backdrop-blur-md">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
          Session
        </p>
        <h2 className="text-2xl font-bold text-text-primary">Configure simulation</h2>
      </div>

      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-text-muted">
          Game Mode
        </p>
        <div className="grid gap-3">
          {gameModes.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => setGameMode(mode.value)}
              className={cn(
                "rounded-[var(--radius-md)] border px-4 py-4 text-left transition-colors",
                gameMode === mode.value
                  ? "border-border-accent bg-bg-elevated"
                  : "border-border bg-bg-secondary hover:bg-bg-elevated",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{mode.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-text-secondary">{mode.desc}</p>
                </div>
                <div
                  className={cn(
                    "mt-0.5 h-3 w-3 rounded-full border",
                    gameMode === mode.value
                      ? "border-accent bg-accent"
                      : "border-text-muted/50 bg-transparent",
                  )}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-text-muted">
          Device
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {deviceModes.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => setDeviceMode(mode.value)}
              className={cn(
                "rounded-[var(--radius-md)] border px-4 py-4 text-left transition-colors",
                deviceMode === mode.value
                  ? "border-border-accent bg-bg-elevated"
                  : "border-border bg-bg-secondary hover:bg-bg-elevated",
              )}
            >
              <p className="text-sm font-semibold text-text-primary">{mode.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">{mode.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-sm text-text-secondary">
          <span className="font-semibold text-text-primary">
            {deviceModes.find((mode) => mode.value === deviceMode)?.title}
          </span>
          {" / "}
          <span className="font-semibold text-text-primary">
            {gameModes.find((mode) => mode.value === gameMode)?.title}
          </span>
        </p>

        <Button
          size="lg"
          onClick={() => router.push(`/play/${deviceMode}/${gameMode}`)}
          className="w-full"
        >
          Open Simulation
        </Button>
      </div>
    </Card>
  );
}
