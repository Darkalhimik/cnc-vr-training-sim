"use client";

import { useMachineStore } from "@/entities/machine/machine-store";
import { useJobStore } from "@/features/part-development/job-store";
import { programName, setupSteps } from "@/features/part-development/setup";
import { showToast } from "@/shared/ui/toast";
import { PAD, StackBoard, buttonsRow, checklistRow, textRow, type Row } from "./board-kit";
import { MACHINES } from "@/entities/catalog/machines";
import { useBoardNavigation } from "./board-navigation";
import { useSavePart } from "./level-complete-3d";
import { PANEL, toneOf } from "./panel-theme";
import { MODE_BOARD_W } from "./tutorial-tracker-3d";

const INNER = MODE_BOARD_W - 2 * PAD;

/**
 * Free play's job in the scene, for VR and AR where the side panel is not
 * visible: the setup checklist read off the machine, the shortcut for the
 * next step, and the warehouse once something is cut. Designing and editing
 * stay on the desktop.
 */
export function JobBoard3D() {
  const machine = useMachineStore((s) => s.machine);
  const design = useJobStore((s) => s.design);
  const program = useJobStore((s) => s.program);
  const nav = useBoardNavigation();
  const save = useSavePart("umc500");
  const steps = setupSteps(machine, design, program);
  const next = steps.find((s) => !s.done);

  const rows: Row[] = [
    textRow(`FREE PLAY · ${MACHINES[0].name.toUpperCase()}`, "caption", INNER, { gap: 0.012 }),
    textRow(design.name, "title", INNER, { gap: 0.01 }),
    textRow(`${programName(design)} · blank ${design.stock.x} × ${design.stock.y} × ${design.stock.z}`, "muted", INNER),
    checklistRow(
      steps.map((s) => {
        const state = s.done ? "done" : s === next ? "active" : "pending";
        return { label: s.title, color: toneOf(state), dim: state === "pending" };
      }),
      INNER,
    ),
    ...(next ? [textRow(next.detail, "muted", INNER, { color: PANEL.textMuted })] : []),
    buttonsRow(
      [
        ...(next?.action
          ? [
              {
                label: next.action.label,
                variant: "primary" as const,
                onPress: () => {
                  const refused = next.action!.run();
                  if (refused) showToast(refused, "warning");
                },
              },
            ]
          : []),
        ...(save ? [save] : []),
        { label: "Level map", onPress: () => void nav.toMap() },
      ],
      INNER,
    ),
  ];

  return <StackBoard width={MODE_BOARD_W} rows={rows} />;
}
