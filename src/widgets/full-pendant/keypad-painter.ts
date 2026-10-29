import {
  KEYS,
  LABELS,
  PANEL_H,
  PANEL_W,
  PHYSICAL,
  PLATES,
  SCREEN,
  SIDE_BOX,
  SIDE_CONTROLS,
  STRIP_BOX,
  KEYBOARD,
  type KeyGroup,
  type PanelKey,
} from "./ngc-layout";

/**
 * Paints the full pendant face — body, group plates, keys, legends — onto one
 * canvas. The real NGC keyboard is a flat membrane, so a texture is the
 * honest model of it, and one textured plane is one draw call in a headset
 * where 132 key meshes would not be.
 *
 * These are the pendant's own colours (docs/haas-ngc/pendant.md §4), not the
 * app's tone scale. The NGC has no key LEDs: modes and toggles show as icons
 * on the screen, so the keys only flash when pressed.
 */
export type KeypadView = {
  hovered: string | null;
  /** Briefly flashed on press. */
  pressed: string | null;
  /** SHIFT armed for the next key. */
  shift: boolean;
};

const PX_PER_MM = 2;
export const CANVAS_W = Math.round(PANEL_W * PX_PER_MM);
export const CANVAS_H = Math.round(PANEL_H * PX_PER_MM);

const PLATE: Record<Exclude<KeyGroup, "app">, string> = {
  function: "#6b7178",
  jog: "#1f4f8c",
  overrides: "#111214",
  display: "#111214",
  cursor: "#1f4f8c",
  mode: "#6b7178",
  alpha: "#6b7178",
  numeric: "#111214",
};

const KEYCAP = "#d3d6d9";
const KEYCAP_DARK = "#3a3f46";
const LEGEND = "#16181a";
const SHIFTED = "#f2c200";
const SANS = '"Open Sans", "Segoe UI", "Helvetica", sans-serif';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The mode keys are arrows pointing at their row. */
function arrowKey(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const tip = Math.min(8, w * 0.2);
  ctx.beginPath();
  ctx.moveTo(x + 2, y);
  ctx.lineTo(x + w - tip, y);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + w - tip, y + h);
  ctx.lineTo(x + 2, y + h);
  ctx.arcTo(x, y + h, x, y, 2);
  ctx.arcTo(x, y, x + w, y, 2);
  ctx.closePath();
}

function legend(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, size: number, weight = 600) {
  const lines = text.split("\n");
  ctx.font = `${weight} ${size}px ${SANS}`;
  lines.forEach((line, i) => ctx.fillText(line, cx, cy + (i - (lines.length - 1) / 2) * size * 1.08));
}

function fitSize(key: PanelKey): number {
  const lines = key.label.split("\n");
  const longest = Math.max(...lines.map((l) => l.length));
  if (longest <= 2 && lines.length === 1) return Math.min(11, key.h * 0.5);
  // Arrow-shaped mode keys lose their point to the legend.
  const usable = key.arrow ? key.w - 8 : key.w;
  const byWidth = (usable * 0.86) / (longest * 0.6);
  const byHeight = (key.h * 0.78) / (lines.length * 1.1);
  return Math.max(4.2, Math.min(7.5, byWidth, byHeight));
}

export function paintKeypad(canvas: HTMLCanvasElement, view: KeypadView) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(PX_PER_MM, PX_PER_MM);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Body.
  ctx.fillStyle = "#1c1e22";
  roundRect(ctx, 0, 0, PANEL_W, PANEL_H, 14);
  ctx.fill();

  // Left control strip with the logo; side-panel strip on the right.
  ctx.fillStyle = "#26292e";
  roundRect(ctx, STRIP_BOX.x, STRIP_BOX.y, STRIP_BOX.w, STRIP_BOX.h, 8);
  ctx.fill();
  roundRect(ctx, SIDE_BOX.x, SIDE_BOX.y, SIDE_BOX.w, SIDE_BOX.h, 8);
  ctx.fill();
  ctx.fillStyle = "#c8102e";
  legend(ctx, "HAAS", STRIP_BOX.x + STRIP_BOX.w / 2, 40, 22, 800);

  ctx.fillStyle = "#c9ccd0";
  const caption = (text: string, x: number, y: number) => legend(ctx, text, x, y, 7.5);
  caption("I", PHYSICAL.powerOn.x, PHYSICAL.powerOn.y - 27);
  caption("O", PHYSICAL.powerOff.x, PHYSICAL.powerOff.y - 27);
  caption("POWER ON", PHYSICAL.powerOn.x, PHYSICAL.powerOn.y + 27);
  caption("POWER OFF", PHYSICAL.powerOff.x, PHYSICAL.powerOff.y + 27);
  caption("EMERGENCY STOP", PHYSICAL.estop.x, PHYSICAL.estop.y + PHYSICAL.estop.r + 22);
  legend(ctx, "−", PHYSICAL.handwheel.x - PHYSICAL.handwheel.r - 10, PHYSICAL.handwheel.y, 16);
  legend(ctx, "+", PHYSICAL.handwheel.x + PHYSICAL.handwheel.r + 10, PHYSICAL.handwheel.y, 16);
  caption("HANDLE JOG", PHYSICAL.handwheel.x, PHYSICAL.handwheel.y - PHYSICAL.handwheel.r - 14);
  caption("CYCLE START", PHYSICAL.cycleStart.x, PHYSICAL.cycleStart.y - 33);
  caption("FEED HOLD", PHYSICAL.feedHold.x, PHYSICAL.feedHold.y - 33);
  for (const c of SIDE_CONTROLS) legend(ctx, c.label, c.x, c.y + c.r + 16, 6.5);

  // Screen recess (the live screen is a separate mesh laid over it).
  ctx.fillStyle = "#050607";
  roundRect(ctx, SCREEN.x - 4, SCREEN.y - 4, SCREEN.w + 8, SCREEN.h + 8, 6);
  ctx.fill();

  // Keyboard plate and the coloured group sub-panels.
  ctx.fillStyle = "#2a2d32";
  roundRect(ctx, KEYBOARD.x, KEYBOARD.y, KEYBOARD.w, KEYBOARD.h, 6);
  ctx.fill();
  for (const plate of PLATES) {
    ctx.fillStyle = PLATE[plate.group as Exclude<KeyGroup, "app">];
    roundRect(ctx, plate.x - 1.5, plate.y - 1.5, plate.w + 3, plate.h + 3, 3);
    ctx.fill();
    if (plate.title) {
      ctx.fillStyle = "#e6e8ea";
      legend(ctx, plate.title, plate.x + plate.w / 2, plate.y + 4, 6, 700);
    }
  }
  ctx.fillStyle = "#e6e8ea";
  for (const l of LABELS) legend(ctx, l.text, l.x + l.w / 2, l.y + l.h / 2, 6, 700);

  // Keys.
  for (const key of KEYS) {
    const pressed = view.pressed === key.id;
    const dark = key.group === "display";
    let fill = dark ? KEYCAP_DARK : KEYCAP;
    if (key.accent) fill = "#d23b2a";
    if (key.group === "app") fill = "#2f6fdc";
    if (pressed) fill = "#ffffff";
    if (key.id === "SHIFT" && view.shift) fill = "#fff2b3";
    ctx.fillStyle = fill;
    if (key.arrow) arrowKey(ctx, key.x, key.y, key.w, key.h);
    else roundRect(ctx, key.x, key.y, key.w, key.h, 2.2);
    ctx.fill();

    if (view.hovered === key.id) {
      ctx.strokeStyle = "#ffb020";
      ctx.lineWidth = 1.4;
      roundRect(ctx, key.x - 0.8, key.y - 0.8, key.w + 1.6, key.h + 1.6, 3);
      ctx.stroke();
    }

    const size = fitSize(key);
    const textColor = dark || key.accent || key.group === "app" ? "#f4f5f6" : key.id === "SHIFT" ? "#9a7400" : LEGEND;
    const weight = key.id === "SPINDLE_FWD" || key.id === "SPINDLE_STOP" || key.id === "SPINDLE_REV" ? 800 : 600;
    const cx = key.x + (key.arrow ? (key.w - 6) / 2 : key.w / 2);
    if (key.shifted) {
      ctx.fillStyle = key.group === "numeric" || key.group === "alpha" ? SHIFTED : "#5a6068";
      legend(ctx, key.shifted, key.x + key.w - 5, key.y + 5, 5.5, 700);
      ctx.fillStyle = textColor;
      legend(ctx, key.label, cx - 2, key.y + key.h / 2 + 2, size, weight);
    } else {
      ctx.fillStyle = textColor;
      legend(ctx, key.label, cx, key.y + key.h / 2 + 0.5, size, weight);
    }
  }
}
