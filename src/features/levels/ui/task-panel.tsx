"use client";

import { useMachineStore } from "@/entities/machine/machine-store";
import { FACE_LABEL } from "@/entities/part/part-design";
import { toolByNumber } from "@/entities/part/tool-library";
import { SavePartButton } from "@/features/warehouse/save-part-button";
import { useJobStore } from "@/features/part-development/job-store";
import { useSessionStore } from "@/features/session/session-store";
import { cn } from "@/shared/lib/cn";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { useProgramEditor } from "@/widgets/gcode-editor";
import { useLevelSession } from "../level-session";
import { TASKS, programNameOf } from "../tasks";
import { LevelComplete } from "./level-complete";

const mm3 = (v: number) => (v < 10 ? v.toFixed(1) : Math.round(v).toString());

/**
 * Section body for a task: the drawing's requirements, the tools, how far
 * the job has got, and — once the program has run — measuring the part.
 */
export function TaskPanel() {
  const level = useLevelSession((s) => s.level);
  const phase = useLevelSession((s) => s.phase);
  const result = useLevelSession((s) => s.result);
  const error = useLevelSession((s) => s.error);
  const inspect = useLevelSession((s) => s.inspectTask);
  const restart = useLevelSession((s) => s.restart);
  const machine = useMachineStore((s) => s.machine);
  const program = useJobStore((s) => s.program);
  const setWorkspaceOpen = useJobStore((s) => s.setWorkspaceOpen);
  const setTab = useJobStore((s) => s.setTab);
  const openEditor = useProgramEditor((s) => s.open);
  const device = useSessionStore((s) => s.deviceMode);
  const task = level && TASKS[level.id];
  if (!level || !task) return null;

  const name = programNameOf(task.design);
  const sent = machine.programs[name] === program && machine.activeProgram === name;
  const ran = machine.lastProgramDone === name;
  const crashed = machine.alarms.some((a) => a.code === "crash");
  const status = [
    { label: "Program written", done: program !== task.template },
    { label: `${name} sent to the control`, done: sent },
    { label: "Run to M30", done: ran },
  ];

  if (phase === "complete" && result) {
    const m = result.measurement;
    return (
      <LevelComplete>
        {m && (
          <ul className="space-y-1 text-xs">
            <li className="flex justify-between">
              <span className="text-muted-foreground">Material left on</span>
              <span className="font-mono">{mm3(m.leftMm3)} mm³</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">Over-cut</span>
              <span className="font-mono">{mm3(m.overcutMm3)} mm³</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">To remove</span>
              <span className="font-mono">{mm3(m.toRemoveMm3)} mm³</span>
            </li>
            {result.crashed && <li className="text-rose-700 dark:text-rose-300">A crash caps the score at 50 %.</li>}
          </ul>
        )}
        <SavePartButton machineId={level.machineId} levelId={level.id} score={result.score ?? null} />
      </LevelComplete>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold tracking-tight">{level.title}</h4>
        <ul className="list-disc space-y-1 pl-4 text-xs/relaxed text-muted-foreground">
          {task.brief.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {task.tools.map((t) => (
          <Badge key={t} qualifier>
            T{t} {toolByNumber(t)?.name}
          </Badge>
        ))}
        {task.design.features.some((f) => f.face !== "top") && (
          <Badge qualifier>{task.design.features.map((f) => FACE_LABEL[f.face]).join(", ")} face</Badge>
        )}
      </div>
      <p className="text-xs/relaxed text-muted-foreground">
        The blank is clamped, G54 is at its top-face centre and the tools are measured. Tolerance ±{task.tolerance} mm.
      </p>

      <ol className="space-y-1">
        {status.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-xs">
            <span className={cn("size-2 rounded-full", s.done ? "bg-emerald-500" : "bg-muted-foreground/30")} />
            <span className={cn(!s.done && "text-muted-foreground")}>{s.label}</span>
          </li>
        ))}
      </ol>

      {error && <p className="text-xs text-amber-700 dark:text-amber-300">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {device === "desktop" && (
          <Button
            size="md"
            variant={ran ? "secondary" : "primary"}
            onClick={() => {
              setTab("program");
              setWorkspaceOpen(true);
              openEditor();
            }}
          >
            Write program
          </Button>
        )}
        <Button size="md" variant={ran ? "primary" : "secondary"} disabled={!ran || phase === "measuring"} onClick={inspect}>
          {phase === "measuring" ? "Measuring…" : "Measure part"}
        </Button>
        {(ran || crashed) && (
          <Button size="md" variant="ghost" onClick={restart}>
            New blank
          </Button>
        )}
      </div>
    </div>
  );
}
