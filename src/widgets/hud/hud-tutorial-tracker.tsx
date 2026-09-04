"use client";

import { Button } from "@/shared/ui/button";
import {
  useCurrentPhase,
  useCurrentStep,
  useTutorialStore,
} from "@/features/tutorial/tutorial-store";
import { cncTutorialSteps } from "@/features/cnc-tutorial/steps";
import { cn } from "@/shared/lib/cn";
import { TONE_CLASSES, TONE_TEXT, toneOf } from "@/shared/ui/tone";

/** done / active / pending — the same three states the 3D tracker uses. */
function stepState(index: number, stepIndex: number) {
  if (index < stepIndex) return "done";
  if (index === stepIndex) return "active";
  return "pending";
}

function ProgressRail({ stepIndex }: { stepIndex: number }) {
  return (
    <div className="flex items-start">
      {cncTutorialSteps.map((step, i) => {
        const state = stepState(i, stepIndex);
        return (
          <div key={step.id} className="flex items-start">
            <div className="flex w-9 flex-col items-center gap-1">
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
                  "text-[10px] uppercase tracking-wide",
                  state === "pending"
                    ? "text-muted-foreground"
                    : TONE_TEXT[toneOf(state)],
                )}
              >
                {step.shortLabel}
              </span>
            </div>
            {i < cncTutorialSteps.length - 1 && (
              <div
                className={cn(
                  "mt-3 h-px w-3",
                  state === "done" ? "bg-emerald-500/40" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
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
  const celebrationDismissed = useTutorialStore((s) => s.celebrationDismissed);
  const reset = useTutorialStore((s) => s.reset);
  const dismiss = useTutorialStore((s) => s.dismissCelebration);

  const currentStep = useCurrentStep();
  const currentPhase = useCurrentPhase();

  if (status === "complete") {
    return (
      <div className="space-y-3">
        <ProgressRail stepIndex={stepIndex} />
        <div className="space-y-1">
          <h4 className="text-sm font-semibold tracking-tight">Machine ready</h4>
          <p className="text-xs/relaxed text-muted-foreground">
            The startup sequence for the HAAS UMC-500 is complete.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="md" variant="secondary" onClick={reset}>
            Restart tutorial
          </Button>
          {!celebrationDismissed && (
            <Button size="md" onClick={dismiss}>
              Continue
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!currentStep || !currentPhase) return null;

  const totalPhases = currentStep.phases.length;

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
        <p className="text-xs/relaxed text-muted-foreground">{currentPhase.instruction}</p>
      </div>

      <Button size="md" variant="secondary" onClick={reset}>
        Reset
      </Button>
    </div>
  );
}
