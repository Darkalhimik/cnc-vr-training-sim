"use client";

import {
  type NotificationVariant,
  useNotifications,
} from "@/shared/lib/notifications";
import { PAD, StackBoard, linesHeight, wrap, type Row } from "./board-kit";
import { TONE } from "./panel-theme";

const PANEL_W = 1.6;
const BAR = 0.02;
const TEXT_W = PANEL_W - 2 * PAD - BAR - 0.04;

/** Same mapping the DOM tones use, resolved to hex for three.js materials. */
const TONE_FOR: Record<NotificationVariant, string> = {
  success: TONE.emerald,
  info: TONE.sky,
  warning: TONE.amber,
  error: TONE.rose,
};

/**
 * The in-scene counterpart of the DOM toasts.
 *
 * In an immersive session the DOM HUD is invisible, so a rejected interaction
 * or a tutorial safety violation reached the trainee in no modality at all.
 * This board shows the most recent one over the door, in the tone the DOM
 * surface would have used. Centred on its position, sized to the message.
 */
export function WarningBoard3D() {
  const items = useNotifications((s) => s.items);
  const latest = items[items.length - 1];

  if (!latest) return null;

  const tone = TONE_FOR[latest.variant] ?? TONE.amber;
  const h = Math.max(linesHeight(wrap(latest.message, TEXT_W, "body").length, "body"), 0.08);
  // The tone rides the rim and a bar, not the text background — the same
  // rule the DOM pills follow, so the message itself stays readable.
  const message: Row = {
    h,
    paint: (p, x, y) => {
      p.rect(x, y, BAR, h, tone, { radius: 0.005 });
      p.text(latest.message, x + BAR + 0.04, y, "body", { width: TEXT_W });
    },
  };

  return <StackBoard width={PANEL_W} rows={[message]} edge={tone} anchor="center" />;
}
