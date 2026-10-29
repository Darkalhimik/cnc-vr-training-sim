"use client";

import { Button } from "@/shared/ui/button";
import {
  useCurrentPhase,
  useCurrentStep,
  useTutorialSteps,
  useTutorialStore,
} from "@/features/tutorial/tutorial-store";
import { instructionOf } from "@/features/cnc-tutorial/tutorial-types";
import { useMachineStore } from "@/entities/machine/machine-store";
import { useLevelSession } from "@/features/levels/level-session";
import { TUTORIALS } from "@/features/levels/tutorials";
import { LevelComplete } from "@/features/levels/ui/level-complete";
import { useSessionStore } from "@/features/session/session-store";
import { cn } from "@/shared/lib/cn";
import { TONE_CLASSES, TONE_TEXT, toneOf } from "@/shared/ui/tone";

/** done / active / pending — the same three states the 3D tracker uses. */
function stepState(index: number, stepIndex: number) {
  if (index < stepIndex) return "done";
  if (index === stepIndex) return "active";
  return "pending";
}

function ProgressRail({ stepIndex }: { stepIndex: number }) {
  const steps = useTutorialSteps();
  return (
    <ol
      className="grid gap-0.5"
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((step, i) => {
        const state = stepState(i, stepIndex);
        return (
          <li key={step.id} className="flex min-w-0 flex-col items-center gap-1">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] tabular-nums ring-1 ring-inset",
                state === "pending"
                  ? "bg-muted text-muted-foreground ring-transparent"
                  : TONE_CLASSES[toneOf(state)],
              )}
            >
              {i + 1}
            </div>
            <span
              className={cn(
                "max-w-full truncate text-[9px] tracking-tight",
                state === "pending" ? "text-muted-foreground" : TONE_TEXT[toneOf(state)],
              )}
            >
              {step.shortLabel}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Section body, not a card. The rail always renders at the same height and the
 * instruction block sits below it, so advancing a step never resizes the panel
 * around the pointer.
 */
export function HudTutorialTracker() {
  const stepIndex = useTutorialStore((s) => s.stepIndex);
  const phaseIndex = useTutorialStore((s) => s.phaseIndex);
  const status = useTutorialStore((s) => s.status);
  const deviceMode = useSessionStore((s) => s.deviceMode);
  const focusCamera = useSessionStore((s) => s.focusCamera);
  const fullPanelOpen = useSessionStore((s) => s.fullPanelOpen);
  const setFullPanelOpen = useSessionStore((s) => s.setFullPanelOpen);
  const level = useLevelSession((s) => s.level);
  const restart = useLevelSession((s) => s.restart);
  // Live instructions ("Z is at -42.000") re-read the machine as it moves.
  const machine = useMachineStore((s) => s.machine);

  const currentStep = useCurrentStep();
  const currentPhase = useCurrentPhase();

  if (status === "complete") {
    return (
      <div className="space-y-3">
        <ProgressRail stepIndex={stepIndex} />
        <LevelComplete outro={level ? TUTORIALS[level.id]?.outro : undefined} />
      </div>
    );
  }

  if (!currentStep || !currentPhase) return null;

  const totalPhases = currentStep.phases.length;
  const keys = currentPhase.keys ?? [];

  return (
    <div className="space-y-3">
      <ProgressRail stepIndex={stepIndex} />

      <div className="space-y-1">
        <h4 className="text-sm font-semibold tracking-tight">
          Step {stepIndex + 1}: {currentStep.title}
          {totalPhases > 1 && (
            <span className="ml-2 font-mono text-xs font-normal tabular-nums text-muted-foreground">
              {phaseIndex + 1}/{totalPhases}
            </span>
          )}
        </h4>
        <p className="text-xs/relaxed text-muted-foreground">{instructionOf(currentPhase, machine)}</p>
        {keys.length > 0 && (
          <p className="flex flex-wrap items-center gap-1 pt-1">
            {keys.map((k) => (
              <kbd key={k} className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                {k.replace(/_/g, " ")}
              </kbd>
            ))}
            <span className="text-[11px] text-muted-foreground">on the full panel</span>
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {deviceMode === "desktop" && currentPhase.highlight.length > 0 && (
          <Button size="md" onClick={() => focusCamera(currentPhase.highlight[0])}>
            Show me
          </Button>
        )}
        {keys.length > 0 && !fullPanelOpen && (
          <Button size="md" onClick={() => setFullPanelOpen(true)}>
            Open full panel
          </Button>
        )}
        <Button size="md" variant="secondary" onClick={restart}>
          Restart
        </Button>
      </div>
    </div>
  );
}
