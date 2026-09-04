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
    desc: "Guided startup flow, five steps, with the next part highlighted.",
  },
  {
    value: "freeplay",
    title: "Free play",
    desc: "Inspect the machine and test controls without scripted guidance.",
  },
];

const deviceModes: { value: DeviceMode; title: string; desc: string }[] = [
  { value: "desktop", title: "Desktop", desc: "Mouse and keyboard" },
  { value: "vr", title: "VR", desc: "WebXR headset" },
  { value: "ar", title: "Phone AR", desc: "Mobile immersive" },
];

/** One option row for both groups, so the two read as the same control. */
function OptionButton({
  title,
  desc,
  selected,
  onClick,
}: {
  title: string;
  desc: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-md border p-3 text-left transition-colors",
        selected ? "bg-accent" : "hover:bg-accent/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium">{title}</p>
          <p className="text-xs/relaxed text-muted-foreground">{desc}</p>
        </div>
        <span
          className={cn(
            "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full border",
            selected ? "border-primary bg-primary" : "border-muted-foreground/50",
          )}
        />
      </div>
    </button>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{children}</p>
  );
}

export function ModeSelector() {
  const router = useRouter();
  const [gameMode, setGameMode] = useState<GameMode>("tutorial");
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");

  const device = deviceModes.find((mode) => mode.value === deviceMode);
  const game = gameModes.find((mode) => mode.value === gameMode);

  return (
    <Card className="space-y-5 p-5">
      <h2 className="text-lg font-semibold tracking-tight">Configure simulation</h2>

      <div className="space-y-2">
        <GroupLabel>Training mode</GroupLabel>
        <div className="grid gap-2">
          {gameModes.map((mode) => (
            <OptionButton
              key={mode.value}
              title={mode.title}
              desc={mode.desc}
              selected={gameMode === mode.value}
              onClick={() => setGameMode(mode.value)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <GroupLabel>Device</GroupLabel>
        <div className="grid gap-2 sm:grid-cols-3">
          {deviceModes.map((mode) => (
            <OptionButton
              key={mode.value}
              title={mode.title}
              desc={mode.desc}
              selected={deviceMode === mode.value}
              onClick={() => setDeviceMode(mode.value)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t pt-4">
        <p className="font-mono text-xs text-muted-foreground">
          {device?.title} · {game?.title}
        </p>

        <Button
          size="lg"
          onClick={() => router.push(`/play/${deviceMode}/${gameMode}`)}
          className="w-full"
        >
          Open simulation
        </Button>
      </div>
    </Card>
  );
}
