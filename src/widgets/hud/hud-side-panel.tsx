"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { ThemeToggle } from "@/widgets/theme-toggle/theme-toggle";
import {
  MACHINE_SCALE_MAX,
  MACHINE_SCALE_MIN,
  useSessionStore,
} from "@/features/session/session-store";
import { FreePlayOverlay } from "@/features/free-play/ui/freeplay-overlay";
import { PartDevelopmentPanel } from "@/features/part-development/ui/part-development-panel";
import { HudMachineStatus } from "@/widgets/hud/hud-machine-status";
import { HudTutorialTracker } from "@/widgets/hud/hud-tutorial-tracker";
import type { DeviceMode, GameMode } from "@/entities/machine/machine-types";

const gameModeOptions: { value: GameMode; label: string }[] = [
  { value: "tutorial", label: "Tutorial" },
  { value: "freeplay", label: "Free play" },
  { value: "develop", label: "Part dev" },
];

const GAME_MODE_TITLE: Record<GameMode, string> = {
  tutorial: "Tutorial",
  freeplay: "Free play",
  develop: "Part development",
};

const deviceModeOptions: { value: DeviceMode; label: string }[] = [
  { value: "desktop", label: "Desktop" },
  { value: "vr", label: "VR" },
  { value: "ar", label: "AR" },
];

/** One titled block of the panel. The panel owns the surface, so a section is
 *  a heading plus its body — never a card of its own. */
function Section({
  title,
  trailing,
  children,
}: {
  title: string;
  trailing?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2 border-t p-3">
      <div className="flex items-baseline gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide">{title}</h3>
        {trailing && (
          <span className="ml-auto truncate font-mono text-[10px] text-muted-foreground">
            {trailing}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

interface HudSidePanelProps {
  deviceMode: DeviceMode;
  gameMode: GameMode;
  xrError: string | null;
  xrSessionInfo: string | null;
  onEnterImmersive: () => void;
  className?: string;
}

/**
 * Every panel of the HUD, in one column beside the viewport rather than five
 * cards floating over it: nothing covers the machine, and there is one place to
 * look for its state.
 *
 * It takes layout space (a sibling of the canvas, not an overlay) and scrolls
 * internally, so the machine never has to be read through a panel.
 */
export function HudSidePanel({
  deviceMode,
  gameMode,
  xrError,
  xrSessionInfo,
  onEnterImmersive,
  className,
}: HudSidePanelProps) {
  const router = useRouter();
  const machineScale = useSessionStore((s) => s.machineScale);
  const setMachineScale = useSessionStore((s) => s.setMachineScale);
  const turnMachine = useSessionStore((s) => s.turnMachine);
  const fullPanelOpen = useSessionStore((s) => s.fullPanelOpen);
  const setFullPanelOpen = useSessionStore((s) => s.setFullPanelOpen);

  const isImmersive = deviceMode === "vr" || deviceMode === "ar";

  return (
    <aside
      className={cn(
        "flex min-w-0 flex-col overflow-y-auto border-l bg-background",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 p-3">
        <Link
          href="/"
          className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          ← Menu
        </Link>
        <ThemeToggle />
      </header>

      <Section title="Session">
        <div className="grid gap-2">
          <SegmentedControl
            options={gameModeOptions}
            value={gameMode}
            onChange={(mode) => router.push(`/play/${deviceMode}/${mode}`)}
            fill
          />
          <SegmentedControl
            options={deviceModeOptions}
            value={deviceMode}
            onChange={(device) => router.push(`/play/${device}/${gameMode}`)}
            fill
          />
        </div>
      </Section>

      <Section title="Machine status">
        <HudMachineStatus />
      </Section>

      <Section title={GAME_MODE_TITLE[gameMode]}>
        {gameMode === "tutorial" && <HudTutorialTracker />}
        {gameMode === "freeplay" && <FreePlayOverlay />}
        {gameMode === "develop" && <PartDevelopmentPanel />}
      </Section>

      <Section title="View" trailing={`${machineScale.toFixed(2)}×`}>
        <label className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Size</span>
          <input
            type="range"
            min={MACHINE_SCALE_MIN}
            max={MACHINE_SCALE_MAX}
            step={0.05}
            value={machineScale}
            onChange={(e) => setMachineScale(parseFloat(e.target.value))}
            className="min-w-0 flex-1 accent-[var(--primary)]"
          />
        </label>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Turn</span>
          <div className="ml-auto flex gap-2">
            <Button size="md" variant="secondary" onClick={() => turnMachine(-1)}>
              Left 90°
            </Button>
            <Button size="md" variant="secondary" onClick={() => turnMachine(1)}>
              Right 90°
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Pendant</span>
          <Button
            size="md"
            variant={fullPanelOpen ? "primary" : "secondary"}
            className="ml-auto"
            onClick={() => setFullPanelOpen(!fullPanelOpen)}
          >
            {fullPanelOpen ? "Close full panel" : "Open full panel"}
          </Button>
        </div>
      </Section>

      {isImmersive && (
        <Section title="Immersive">
          <div className="space-y-2">
            <Button size="lg" onClick={onEnterImmersive} className="w-full">
              {deviceMode === "vr" ? "Enter VR" : "Enter AR"}
            </Button>

            {xrError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs/relaxed text-destructive-foreground">
                {xrError}
              </p>
            ) : (
              <p className="text-xs/relaxed text-muted-foreground">
                {deviceMode === "vr"
                  ? "Preview mode is active. Use Enter VR on a WebXR-capable headset."
                  : "Preview mode is active. Use Enter AR on a supported mobile device."}
              </p>
            )}

            {xrSessionInfo && (
              <p className="rounded-md border bg-muted/50 px-3 py-2 font-mono text-[10px] text-muted-foreground">
                {xrSessionInfo}
              </p>
            )}
          </div>
        </Section>
      )}
    </aside>
  );
}
