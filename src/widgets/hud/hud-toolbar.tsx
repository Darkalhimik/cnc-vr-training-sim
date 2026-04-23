"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassPanel } from "@/shared/ui/glass-panel";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { cn } from "@/shared/lib/cn";
import { useSessionStore } from "@/features/session/session-store";
import type { DeviceMode, GameMode } from "@/entities/machine/machine-types";

const gameModeOptions: { value: GameMode; label: string }[] = [
  { value: "tutorial", label: "Tutorial" },
  { value: "freeplay", label: "Free Play" },
];

const deviceModeOptions: { value: DeviceMode; label: string }[] = [
  { value: "desktop", label: "Desktop" },
  { value: "vr", label: "VR" },
  { value: "ar", label: "AR" },
];

export function HudToolbar() {
  const router = useRouter();
  const gameMode = useSessionStore((state) => state.gameMode);
  const deviceMode = useSessionStore((state) => state.deviceMode);

  return (
    <GlassPanel className="flex flex-wrap items-center gap-3 px-3 py-2">
      <Link
        href="/"
        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
        title="Back to menu"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M10 12L6 8L10 4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>

      <div className="h-5 w-px bg-border" />

      <SegmentedControl
        options={gameModeOptions}
        value={gameMode}
        onChange={(mode) => router.push(`/play/${deviceMode}/${mode}`)}
      />

      <div className="h-5 w-px bg-border" />

      <div className="flex items-center gap-1">
        {deviceModeOptions.map((mode) => (
          <button
            key={mode.value}
            type="button"
            onClick={() => router.push(`/play/${mode.value}/${gameMode}`)}
            className={cn(
              "rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors",
              deviceMode === mode.value
                ? "bg-bg-elevated text-text-primary"
                : "text-text-muted hover:bg-bg-elevated hover:text-text-primary",
            )}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </GlassPanel>
  );
}
