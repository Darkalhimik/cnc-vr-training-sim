"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { ThemeToggle } from "@/widgets/theme-toggle/theme-toggle";
import {
  MACHINE_SCALE_MAX,
  MACHINE_SCALE_MIN,
  SIM_SPEEDS,
  type SimSpeed,
  useSessionStore,
} from "@/features/session/session-store";
import { FreePlayOverlay } from "@/features/free-play/ui/freeplay-overlay";
import { PartDevelopmentPanel } from "@/features/part-development/ui/part-development-panel";
import { useLevelSession } from "@/features/levels/level-session";
import { TaskPanel } from "@/features/levels/ui/task-panel";
import { HudMachineStatus } from "@/widgets/hud/hud-machine-status";
import { HudTutorialTracker } from "@/widgets/hud/hud-tutorial-tracker";
import { ImmersiveLaunch } from "@/widgets/hud/immersive-launch";
import type { MachineInfo } from "@/entities/catalog/machines";
import { DEVICE_MODES, DEVICE_SHORT, type DeviceMode, type GameMode } from "@/entities/machine/machine-types";

const GAME_MODE_TITLE: Record<GameMode, string> = {
  freeplay: "Free play",
  tutorial: "Tutorial",
  task: "Task",
};

const deviceModeOptions = DEVICE_MODES.map((value) => ({ value, label: DEVICE_SHORT[value] }));

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
  machine: MachineInfo;
  deviceMode: DeviceMode;
  gameMode: GameMode;
  xrError: string | null;
  xrSessionInfo: string | null;
  onEnterImmersive: () => void;
  /** Where the header's back link goes: the level map, or — in the
   *  workshop — back to walking. */
  back: { label: string; href?: string; onClick?: () => void };
  /** The machine can be sized and turned — not where it stands in a bay. */
  adjustable: boolean;
  className?: string;
  /** Sections that come first: in AR, the menu that stands in for the
   *  workshop (which machine, its tool cart, movement). */
  children?: React.ReactNode;
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
  machine,
  deviceMode,
  gameMode,
  xrError,
  xrSessionInfo,
  onEnterImmersive,
  back,
  adjustable,
  className,
  children,
}: HudSidePanelProps) {
  const router = useRouter();
  const search = useSearchParams();
  const level = useLevelSession((s) => s.level);
  const levelError = useLevelSession((s) => s.error);
  const machineScale = useSessionStore((s) => s.machineScale);
  const setMachineScale = useSessionStore((s) => s.setMachineScale);
  const turnMachine = useSessionStore((s) => s.turnMachine);
  const fullPanelOpen = useSessionStore((s) => s.fullPanelOpen);
  const setFullPanelOpen = useSessionStore((s) => s.setFullPanelOpen);
  const simSpeed = useSessionStore((s) => s.simSpeed);
  const setSimSpeed = useSessionStore((s) => s.setSimSpeed);


  return (
    <aside
      className={cn(
        "flex min-w-0 flex-col overflow-y-auto border-l bg-background",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 p-3">
        {back.href ? (
          <Link
            href={back.href}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            ← {back.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={back.onClick}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            ← {back.label}
          </button>
        )}
        <ThemeToggle />
      </header>

      <section className="space-y-2 border-t p-3">
        <div className="space-y-0.5">
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {machine.name} · {GAME_MODE_TITLE[gameMode]}
          </p>
          <h2 className="text-sm font-semibold tracking-tight">{level?.title ?? "The whole machine"}</h2>
        </div>
        <SegmentedControl
          options={deviceModeOptions}
          value={deviceMode}
          onChange={(device) => router.push(`/world/${device}${search.size ? `?${search}` : ""}`)}
          fill
        />
      </section>

      {/* Going in: the first thing under the mode switch, as in VR. */}
      {deviceMode !== "desktop" && (
        <ImmersiveLaunch device={deviceMode} onEnter={onEnterImmersive} error={xrError} sessionInfo={xrSessionInfo} />
      )}

      {children}

      <Section title={gameMode === "freeplay" ? "Job" : GAME_MODE_TITLE[gameMode]}>
        {levelError && !level && <p className="text-xs text-amber-700 dark:text-amber-300">{levelError}</p>}
        {gameMode === "tutorial" && <HudTutorialTracker />}
        {gameMode === "task" && <TaskPanel />}
        {gameMode === "freeplay" && <PartDevelopmentPanel />}
      </Section>

      <Section title="Machine status">
        <HudMachineStatus />
      </Section>

      {gameMode === "freeplay" && (
        <Section title="Explore">
          <FreePlayOverlay />
        </Section>
      )}

      <Section title="View" trailing={adjustable ? `${machineScale.toFixed(2)}×` : undefined}>
        {adjustable && (
          <>
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
          </>
        )}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Program speed</span>
          <SegmentedControl
            options={SIM_SPEEDS.map((s) => ({ value: String(s), label: `${s}×` }))}
            value={String(simSpeed)}
            onChange={(v) => setSimSpeed(Number(v) as SimSpeed)}
            className="ml-auto"
          />
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

    </aside>
  );
}
