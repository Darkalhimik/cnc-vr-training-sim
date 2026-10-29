"use client";

import { machineById } from "@/entities/catalog/machines";
import { useMachineStore } from "@/entities/machine/machine-store";
import { instructionOf } from "@/features/cnc-tutorial/tutorial-types";
import { useLevelSession } from "@/features/levels/level-session";
import { TUTORIALS } from "@/features/levels/tutorials";
import { useSessionStore } from "@/features/session/session-store";
import {
  useCurrentPhase,
  useCurrentStep,
  useTutorialSteps,
  useTutorialStore,
} from "@/features/tutorial/tutorial-store";
import { PAD, StackBoard, buttonsRow, keysRow, linesHeight, textRow, type Row } from "./board-kit";
import { useBoardNavigation } from "./board-navigation";
import { useCompletionRows } from "./level-complete-3d";
import { PANEL, toneOf } from "./panel-theme";

export const MODE_BOARD_W = 1.5;
const INNER = MODE_BOARD_W - 2 * PAD;

/** One dot per step, its short label under it: the side panel's rail. */
function railRow(labels: string[], stepIndex: number): Row {
  const spacing = labels.length > 1 ? Math.min(0.17, (INNER - 0.06) / (labels.length - 1)) : 0;
  const start = (INNER - spacing * (labels.length - 1)) / 2;
  return {
    h: 0.06 + linesHeight(1, "caption"),
    paint: (p, x, y) =>
      labels.forEach((label, i) => {
        const tone = toneOf(i < stepIndex ? "done" : i === stepIndex ? "active" : "pending");
        const cx = x + start + i * spacing;
        p.circle(cx, y + 0.026, i === stepIndex ? 0.024 : 0.018, tone);
        p.text(label, cx, y + 0.058, "caption", { color: tone, align: "center" });
      }),
  };
}

/**
 * The tutorial in the scene, for VR and AR where the side panel is not
 * visible: any level's steps, the live instruction, the full-panel keys the
 * step needs, and the way on once it is done.
 */
export function TutorialTracker3D() {
  const steps = useTutorialSteps();
  const stepIndex = useTutorialStore((s) => s.stepIndex);
  const phaseIndex = useTutorialStore((s) => s.phaseIndex);
  const status = useTutorialStore((s) => s.status);
  const step = useCurrentStep();
  const phase = useCurrentPhase();
  const level = useLevelSession((s) => s.level);
  const restart = useLevelSession((s) => s.restart);
  // Live instructions ("Z is at −42.000") re-read the machine as it moves.
  const machine = useMachineStore((s) => s.machine);
  const fullPanelOpen = useSessionStore((s) => s.fullPanelOpen);
  const setFullPanelOpen = useSessionStore((s) => s.setFullPanelOpen);
  const nav = useBoardNavigation();
  const completion = useCompletionRows(INNER, { outro: level ? TUTORIALS[level.id]?.outro : undefined });

  const machineName = machineById(level?.machineId ?? "umc500")?.name ?? "";
  const header: Row[] = [
    textRow(`TUTORIAL · ${machineName.toUpperCase()}`, "caption", INNER, { gap: 0.012 }),
    textRow(level?.title ?? "Machine startup", "title", INNER),
    railRow(
      steps.map((s) => s.shortLabel),
      status === "complete" ? steps.length : stepIndex,
    ),
  ];

  let rows: Row[];
  if (status === "complete") {
    rows = [...header, ...completion];
  } else if (step && phase) {
    const keys = phase.keys ?? [];
    const phases = step.phases.length > 1 ? `  ${phaseIndex + 1}/${step.phases.length}` : "";
    rows = [
      ...header,
      textRow(`Step ${stepIndex + 1}: ${step.title}${phases}`, "body", INNER, { gap: 0.015 }),
      textRow(instructionOf(phase, machine), "body", INNER, { color: PANEL.textMuted }),
      ...(keys.length > 0
        ? [textRow("ON THE FULL PANEL", "caption", INNER, { gap: 0.012 }), keysRow(keys, INNER)]
        : []),
      buttonsRow(
        [
          ...(keys.length > 0 && !fullPanelOpen
            ? [{ label: "Open full panel", onPress: () => setFullPanelOpen(true), variant: "primary" as const }]
            : []),
          { label: "Restart", onPress: restart },
          { label: "Level map", onPress: () => void nav.toMap() },
        ],
        INNER,
      ),
    ];
  } else {
    return null;
  }

  return <StackBoard width={MODE_BOARD_W} rows={rows} />;
}
