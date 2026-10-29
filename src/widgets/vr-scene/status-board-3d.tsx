"use client";

import { useMachineStore } from "@/entities/machine/machine-store";
import { machineIndicators } from "@/entities/machine/machine-indicators";
import { PAD, StackBoard, linesHeight, pill, textRow, type Row } from "./board-kit";
import { PANEL, toneOf } from "./panel-theme";

export const STATUS_BOARD_W = 1.3;
const INNER = STATUS_BOARD_W - 2 * PAD;
const COL_GAP = 0.08;
const COL_W = (INNER - COL_GAP) / 2;
const ROW_H = 0.075;
const PILL_W = 0.19;

/**
 * The machine at a glance, beside the machine: the side panel's status rows,
 * in the same order, in two columns so the board stays short enough to sit
 * above the full pendant when that is open.
 */
export function StatusBoard3D() {
  const machine = useMachineStore((s) => s.machine);
  const indicators = machineIndicators(machine);
  const perColumn = Math.ceil(indicators.length / 2);

  const grid: Row = {
    h: perColumn * ROW_H,
    paint: (p, x, y) =>
      indicators.forEach((ind, i) => {
        const cx = x + Math.floor(i / perColumn) * (COL_W + COL_GAP);
        const cy = y + (i % perColumn) * ROW_H;
        p.text(ind.label, cx, cy + (ROW_H - linesHeight(1, "muted")) / 2, "muted", { color: PANEL.textMuted });
        pill(p, ind.state, toneOf(ind.state), cx + COL_W - PILL_W, cy + (ROW_H - 0.052) / 2, PILL_W);
      }),
  };

  return <StackBoard width={STATUS_BOARD_W} rows={[textRow("MACHINE STATUS", "caption", INNER), grid]} />;
}
