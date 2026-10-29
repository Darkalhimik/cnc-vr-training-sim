"use client";

import { machineById } from "@/entities/catalog/machines";
import { useMachineStore } from "@/entities/machine/machine-store";
import { toolByNumber } from "@/entities/part/tool-library";
import { useLevelSession } from "@/features/levels/level-session";
import { TASKS, programNameOf } from "@/features/levels/tasks";
import { useJobStore } from "@/features/part-development/job-store";
import { useSessionStore } from "@/features/session/session-store";
import { PAD, StackBoard, buttonsRow, checklistRow, pairsRow, textRow, type Row } from "./board-kit";
import { useBoardNavigation } from "./board-navigation";
import { useCompletionRows, useSavePart } from "./level-complete-3d";
import { PANEL, TONE, toneOf } from "./panel-theme";
import { MODE_BOARD_W } from "./tutorial-tracker-3d";

const INNER = MODE_BOARD_W - 2 * PAD;
const mm3 = (v: number) => `${v < 10 ? v.toFixed(1) : Math.round(v)} mm³`;

/**
 * A task in the scene: the drawing's requirements, the tools, how far the
 * job has got, and measuring the part once the program has run. Programs are
 * written at a desk; in a headset the trainee runs and measures them.
 */
export function TaskBoard3D() {
  const level = useLevelSession((s) => s.level);
  const phase = useLevelSession((s) => s.phase);
  const result = useLevelSession((s) => s.result);
  const error = useLevelSession((s) => s.error);
  const inspect = useLevelSession((s) => s.inspectTask);
  const restart = useLevelSession((s) => s.restart);
  const machine = useMachineStore((s) => s.machine);
  const program = useJobStore((s) => s.program);
  const device = useSessionStore((s) => s.deviceMode);
  const nav = useBoardNavigation();
  const save = useSavePart(level?.machineId ?? "umc500", level?.id ?? null, result?.score ?? null);
  const m = result?.measurement;
  const completion = useCompletionRows(INNER, {
    extra: m
      ? [
          pairsRow(
            [
              { label: "Material left on", value: mm3(m.leftMm3) },
              { label: "Over-cut", value: mm3(m.overcutMm3), color: m.overcutMm3 > 1 ? TONE.amber : undefined },
              { label: "To remove", value: mm3(m.toRemoveMm3) },
            ],
            INNER,
          ),
          ...(result?.crashed ? [textRow("A crash caps the score at 50 %.", "muted", INNER, { color: TONE.rose })] : []),
        ]
      : [],
    actions: save ? [save] : [],
  });

  const task = level && TASKS[level.id];
  if (!level || !task) return null;

  const name = programNameOf(task.design);
  const written = program !== task.template;
  const sent = machine.programs[name] === program && machine.activeProgram === name;
  const ran = machine.lastProgramDone === name;
  const crashed = machine.alarms.some((a) => a.code === "crash");
  const machineName = machineById(level.machineId)?.name ?? "";

  const header: Row[] = [
    textRow(`TASK · ${machineName.toUpperCase()}`, "caption", INNER, { gap: 0.012 }),
    textRow(level.title, "title", INNER),
  ];

  if (phase === "complete" && result) return <StackBoard width={MODE_BOARD_W} rows={[...header, ...completion]} />;

  const rows: Row[] = [
    ...header,
    ...task.brief.map((line, i) =>
      textRow(`• ${line}`, "body", INNER, { color: PANEL.textMuted, gap: i < task.brief.length - 1 ? 0.01 : undefined }),
    ),
    textRow(`Tools: ${task.tools.map((t) => `T${t} ${toolByNumber(t)?.name ?? ""}`).join(", ")}`, "muted", INNER),
    checklistRow(
      [
        { label: written ? "Program written" : "Program written — at a desk, in the editor", done: written },
        { label: `${name} sent to the control`, done: sent },
        { label: "Run to M30: door shut, MEMORY, CYCLE START", done: ran },
      ].map((s) => ({ label: s.label, color: toneOf(s.done ? "done" : "pending"), dim: !s.done })),
      INNER,
    ),
    ...(error ? [textRow(error, "muted", INNER, { color: TONE.amber })] : []),
    ...(device !== "desktop" && !written
      ? [textRow("Write the program on a desktop, then come back to run it here.", "muted", INNER)]
      : []),
    buttonsRow(
      [
        {
          label: phase === "measuring" ? "Measuring…" : "Measure part",
          onPress: () => void inspect(),
          disabled: !ran || phase === "measuring",
          variant: "primary" as const,
        },
        ...(ran || crashed ? [{ label: "New blank", onPress: restart }] : []),
        { label: "Level map", onPress: () => void nav.toMap() },
      ],
      INNER,
    ),
  ];
  return <StackBoard width={MODE_BOARD_W} rows={rows} />;
}
