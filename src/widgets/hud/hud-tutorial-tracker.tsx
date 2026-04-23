"use client";

import { GlassPanel } from "@/shared/ui/glass-panel";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { useTutorialStore } from "@/features/tutorial/tutorial-store";
import { cncTutorialSteps } from "@/features/cnc-tutorial/steps";
import { cn } from "@/shared/lib/cn";

const STEP_LABELS = ["Air", "Power", "E-Stop", "Door", "Jog"];

export function HudTutorialTracker() {
  const stepIndex = useTutorialStore((s) => s.stepIndex);
  const subStepIndex = useTutorialStore((s) => s.subStepIndex);
  const message = useTutorialStore((s) => s.message);
  const isComplete = useTutorialStore((s) => s.isComplete);
  const showCelebration = useTutorialStore((s) => s.showCelebration);
  const reset = useTutorialStore((s) => s.reset);
  const dismiss = useTutorialStore((s) => s.dismissCelebration);

  const currentStep = cncTutorialSteps[stepIndex];
  const currentSubStep = currentStep?.subSteps?.[subStepIndex];

  if (showCelebration) {
    return (
      <GlassPanel className="flex max-w-sm flex-col gap-4 p-6">
        <h3 className="text-xl font-bold text-accent">Machine Ready!</h3>
        <p className="text-sm text-text-secondary">
          You have successfully completed the startup sequence for the HAAS UMC-500.
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={reset}>
            Restart Tutorial
          </Button>
          <Button size="sm" variant="secondary" onClick={dismiss}>
            Continue
          </Button>
        </div>
      </GlassPanel>
    );
  }

  if (isComplete) return null;

  return (
    <GlassPanel className="flex max-w-md flex-col gap-4 p-4">
      {/* Step indicator */}
      <div className="flex items-center gap-1.5">
        {cncTutorialSteps.map((_, i) => (
          <div key={i} className="flex items-center">
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300",
                i < stepIndex
                  ? "bg-accent text-white shadow-[0_0_8px_var(--color-accent-glow)]"
                  : i === stepIndex
                    ? "border-2 border-cyan bg-cyan/20 text-cyan shadow-[0_0_12px_var(--color-cyan-glow)]"
                    : "border border-border bg-bg-elevated text-text-muted",
              )}
            >
              {i < stepIndex ? "\u2713" : i + 1}
            </div>
            {i < cncTutorialSteps.length - 1 && (
              <div
                className={cn(
                  "mx-0.5 h-0.5 w-6 rounded-full transition-colors duration-300",
                  i < stepIndex ? "bg-accent" : "bg-border",
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Labels under indicator */}
      <div className="flex items-center">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center">
            <span
              className={cn(
                "w-7 text-center text-[9px] font-semibold uppercase",
                i < stepIndex ? "text-accent" : i === stepIndex ? "text-cyan" : "text-text-muted",
              )}
            >
              {label}
            </span>
            {i < STEP_LABELS.length - 1 && <div className="mx-0.5 w-6" />}
          </div>
        ))}
      </div>

      {/* Current instruction */}
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-bold text-text-primary">
          Step {stepIndex + 1}: {currentStep?.title}
        </h4>
        <p className="text-xs leading-relaxed text-text-secondary">
          {currentSubStep?.instruction ?? currentStep?.description}
        </p>
        {currentStep?.actionLabel && (
          <Badge variant="active">{currentStep.actionLabel}</Badge>
        )}
      </div>

      {/* Feedback message */}
      {message && (
        <p className="text-xs font-medium text-cyan">{message}</p>
      )}

      <Button size="sm" variant="ghost" onClick={reset}>
        Reset
      </Button>
    </GlassPanel>
  );
}
