"use client";

import { useMachineStore } from "@/entities/machine/machine-store";
import { STOCK_PRESETS, type Stock } from "@/entities/part/part-design";
import { useJobStore } from "@/features/part-development/job-store";
import { programName, setupSteps } from "@/features/part-development/setup";
import { PAD, StackBoard, buttonsRow, checklistRow, textRow, type Row } from "./board-kit";
import { MACHINES } from "@/entities/catalog/machines";
import { useBoardNavigation } from "./board-navigation";
import { useSavePart } from "./level-complete-3d";
import { PANEL, toneOf } from "./panel-theme";
import { MODE_BOARD_W } from "./tutorial-tracker-3d";

const INNER = MODE_BOARD_W - 2 * PAD;

/** The shop's blank sizes, a step smaller or larger than `stock`. */
function stepBlank(stock: Stock, step: 1 | -1): [number, number, number] | null {
  const volume = ([x, y, z]: [number, number, number]) => x * y * z;
  const here = volume([stock.x, stock.y, stock.z]);
  const sorted = [...STOCK_PRESETS].sort((a, b) => volume(a) - volume(b));
  return (step > 0 ? sorted.find((p) => volume(p) > here) : sorted.reverse().find((p) => volume(p) < here)) ?? null;
}

/**
 * Free play's job in the scene, for VR and AR where the side panel is not
 * visible: the blank (a size the shop stocks, stepped smaller or larger),
 * the setup checklist read off the machine with how to do the next step at
 * the machine, and the warehouse once something is cut. Designing and
 * editing stay on the desktop.
 */
export function JobBoard3D() {
  const machine = useMachineStore((s) => s.machine);
  const design = useJobStore((s) => s.design);
  const program = useJobStore((s) => s.program);
  const updateStock = useJobStore((s) => s.updateStock);
  const nav = useBoardNavigation();
  const save = useSavePart("umc500");
  const steps = setupSteps(machine, design, program);
  const next = steps.find((s) => !s.done);
  const smaller = stepBlank(design.stock, -1);
  const larger = stepBlank(design.stock, 1);
  const blankTo = (size: [number, number, number] | null) => () => {
    if (size) updateStock({ x: size[0], y: size[1], z: size[2] });
  };

  const rows: Row[] = [
    textRow(`FREE PLAY · ${MACHINES[0].name.toUpperCase()}`, "caption", INNER, { gap: 0.012 }),
    textRow(design.name, "title", INNER, { gap: 0.01 }),
    textRow(`${programName(design)} · blank ${design.stock.x} × ${design.stock.y} × ${design.stock.z} mm`, "muted", INNER),
    buttonsRow(
      [
        { label: "Smaller blank", onPress: blankTo(smaller), disabled: !smaller },
        { label: "Larger blank", onPress: blankTo(larger), disabled: !larger },
      ],
      INNER,
    ),
    checklistRow(
      steps.map((s) => {
        const state = s.done ? "done" : s === next ? "active" : "pending";
        return { label: s.title, color: toneOf(state), dim: state === "pending" };
      }),
      INNER,
    ),
    ...(next ? [textRow(next.detail, "muted", INNER, { color: PANEL.textMuted })] : []),
    buttonsRow([...(save ? [save] : []), { label: "Level map", onPress: () => void nav.toMap() }], INNER),
  ];

  return <StackBoard width={MODE_BOARD_W} rows={rows} />;
}
