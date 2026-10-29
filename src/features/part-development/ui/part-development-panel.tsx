"use client";

import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Field } from "@/shared/ui/field";
import { cn } from "@/shared/lib/cn";
import { showToast } from "@/shared/ui/toast";
import { useMachineStore } from "@/entities/machine/machine-store";
import { toneOf, TONE_CLASSES } from "@/shared/ui/tone";
import { useSessionStore } from "@/features/session/session-store";
import { useJobStore } from "../job-store";
import { programName, setupSteps } from "../setup";
import { useStockRegistry } from "../stock-registry";

/**
 * Section body, not a card. Part development's home in the side panel: the
 * job at a glance, the setup checklist read off the machine, and the way into
 * the workspace. Designing and editing are desktop work; on a headset this
 * section is what the trainee sees.
 */
export function PartDevelopmentPanel() {
  const machine = useMachineStore((s) => s.machine);
  const design = useJobStore((s) => s.design);
  const program = useJobStore((s) => s.program);
  const workspaceOpen = useJobStore((s) => s.workspaceOpen);
  const setWorkspaceOpen = useJobStore((s) => s.setWorkspaceOpen);
  const deviceMode = useSessionStore((s) => s.deviceMode);
  const focusCamera = useSessionStore((s) => s.focusCamera);
  const removal = useStockRegistry((s) => s.removal);

  const steps = setupSteps(machine, design, program);
  const next = steps.find((s) => !s.done);
  const machined = machine.lastProgramDone === programName(design);

  const exportStl = async () => {
    if (!removal) return;
    const blob = await removal.exportStl();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${programName(design)}-${design.name.replace(/\W+/g, "-").toLowerCase()}.stl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-1.5">
        <Field label="Part" value={design.name} />
        <Field label="Stock" mono value={`${design.stock.x} × ${design.stock.y} × ${design.stock.z}`} />
        <Field label="Program" mono value={`${programName(design)} · ${program.split("\n").length} lines`} />
      </div>

      <ol className="space-y-1.5">
        {steps.map((step, i) => {
          const state = step.done ? "done" : step === next ? "active" : "pending";
          return (
            <li key={step.id} className="flex items-start gap-2">
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] ring-1 ring-inset",
                  state === "pending" ? "bg-muted text-muted-foreground ring-transparent" : TONE_CLASSES[toneOf(state)],
                )}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className={cn("text-xs", state === "pending" && "text-muted-foreground")}>{step.title}</p>
                {step === next && <p className="text-xs/relaxed text-muted-foreground">{step.detail}</p>}
              </div>
              {step === next && step.action && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const refused = step.action!.run();
                    if (refused) showToast(refused, "warning");
                  }}
                >
                  {step.action.label}
                </Button>
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        {deviceMode === "desktop" ? (
          <Button size="md" onClick={() => setWorkspaceOpen(!workspaceOpen)}>
            {workspaceOpen ? "Close workspace" : "Open workspace"}
          </Button>
        ) : (
          <p className="text-xs/relaxed text-muted-foreground">Design and program on desktop; set up and run the job here.</p>
        )}
        {deviceMode === "desktop" && (
          <Button size="md" variant="secondary" onClick={() => focusCamera("vise")}>
            View vise
          </Button>
        )}
        {machine.stock && (
          <Button size="md" variant="secondary" onClick={exportStl} disabled={!removal}>
            Export STL
          </Button>
        )}
        {machined && <Badge tone="emerald">machined</Badge>}
      </div>
    </div>
  );
}
