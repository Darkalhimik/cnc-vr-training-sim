"use client";

import {
  MACHINE_SCALE_MAX,
  MACHINE_SCALE_MIN,
  MACHINE_SCALE_STEP,
  useSessionStore,
} from "@/features/session/session-store";
import { BUTTON_H, PAD, StackBoard, buttonsRow, linesHeight, textRow, type Row } from "./board-kit";

export const VIEW_BOARD_W = 1.3;
const INNER = VIEW_BOARD_W - 2 * PAD;
const STEP_W = 0.16;

type Props = {
  value: number;
  onChange: (next: number) => void;
  /** Turn the machine a quarter turn; the way round to its rear panel. */
  onTurn: (direction: 1 | -1) => void;
};

/**
 * The side panel's View section in the scene: the machine's size, a quarter
 * turn either way to reach its back, and the full-size pendant. It does not
 * scale with the machine — a size control that shrinks with what it sizes
 * can end up too small to press.
 */
export function SizePanel3D({ value, onChange, onTurn }: Props) {
  const fullPanelOpen = useSessionStore((s) => s.fullPanelOpen);
  const setFullPanelOpen = useSessionStore((s) => s.setFullPanelOpen);

  const stepper: Row = {
    h: BUTTON_H,
    paint: (p, x, y) => {
      p.button("−", x, y, STEP_W, () => onChange(value - MACHINE_SCALE_STEP), { disabled: value <= MACHINE_SCALE_MIN });
      p.text(`${value.toFixed(2)}×`, x + INNER / 2, y + (BUTTON_H - linesHeight(1, "value")) / 2, "value", { align: "center" });
      p.button("+", x + INNER - STEP_W, y, STEP_W, () => onChange(value + MACHINE_SCALE_STEP), {
        disabled: value >= MACHINE_SCALE_MAX,
      });
    },
  };

  return (
    <StackBoard
      width={VIEW_BOARD_W}
      rows={[
        textRow("VIEW · SIZE", "caption", INNER, { gap: 0.015 }),
        stepper,
        textRow("TURN", "caption", INNER, { gap: 0.015 }),
        buttonsRow(
          [
            { label: "Left 90°", onPress: () => onTurn(-1) },
            { label: "Right 90°", onPress: () => onTurn(1) },
          ],
          INNER,
        ),
        textRow("PENDANT", "caption", INNER, { gap: 0.015 }),
        buttonsRow(
          [
            {
              label: fullPanelOpen ? "Close full panel" : "Open full panel",
              onPress: () => setFullPanelOpen(!fullPanelOpen),
              variant: fullPanelOpen ? "primary" : "secondary",
            },
          ],
          INNER,
        ),
      ]}
    />
  );
}
