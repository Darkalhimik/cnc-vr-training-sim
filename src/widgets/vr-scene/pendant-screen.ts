import { HOMING_SEQUENCE, WARMUP_PROGRAM } from "@/entities/machine/machine-logic";
import {
  ALARM_TEXT,
  AXES,
  type Axis,
  type MachineState,
  airPressure,
} from "@/entities/machine/machine-types";

/**
 * The NGC control screen, painted onto the pendant's display.
 *
 * It is the trainee's only readout inside a headset that is attached to the
 * machine rather than floating beside it, so it carries what the real one
 * would: mode, alarms, machine position, spindle and the control's messages.
 * These are the control's own colours, not the app's tone scale — this is a
 * piece of the machine.
 */
export type ScreenView = {
  machine: MachineState;
  message: string | null;
  /** Drawn axis positions, which lag the commanded ones while moving. */
  position: Record<Axis, number>;
  rpm: number;
  bootProgress: number;
  blink: boolean;
};

const C = {
  bg: "#0d1319",
  panel: "#16202a",
  header: "#1d4f7a",
  text: "#e6edf3",
  muted: "#8a9aab",
  rule: "#2a3644",
  alarm: "#ff5050",
  ok: "#4ade80",
  warn: "#ffc43d",
  select: "#ffd84d",
};

const MONO = '"JetBrains Mono", "Consolas", "Menlo", monospace';
const SANS = '"Open Sans", "Segoe UI", "Helvetica", sans-serif';

/** Everything the screen shows, so it is only repainted when that changes. */
export function screenKey(v: ScreenView): string {
  const m = v.machine;
  if (m.control === "off") return "off";
  if (m.control === "booting") return `boot:${Math.floor(v.bootProgress * 40)}`;
  const pos = AXES.map((a) => v.position[a].toFixed(1)).join(",");
  return [
    m.mode, m.jogAxis, m.alarms.join("+"), m.homed, m.homingStage, pos, v.rpm, m.coolantOn,
    m.program, m.programBlock, m.warmupDone, m.doorOpen, m.airValveOpen, v.message,
    m.homingStage !== null && v.blink,
  ].join("|");
}

function homeStatus(m: MachineState): { text: string; color: string } {
  if (m.homingStage !== null) {
    const axes = HOMING_SEQUENCE[m.homingStage].axes.map((a) => a.toUpperCase()).join(" ");
    return { text: `ZERO RETURN ${axes}`, color: C.warn };
  }
  return m.homed ? { text: "HOMED", color: C.ok } : { text: "NOT HOMED", color: C.warn };
}

function programStatus(m: MachineState): { text: string; color: string } {
  if (m.program === "running") {
    return { text: `RUNNING  N${(m.programBlock + 1) * 10}`, color: C.ok };
  }
  if (m.program === "hold") return { text: m.doorOpen ? "DOOR HOLD" : "FEED HOLD", color: C.warn };
  return m.warmupDone ? { text: "COMPLETE", color: C.ok } : { text: "IDLE", color: C.muted };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function drawPendantScreen(canvas: HTMLCanvasElement, v: ScreenView) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width: W, height: H } = canvas;
  const m = v.machine;
  ctx.textBaseline = "middle";

  if (m.control === "off") {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    return;
  }

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  if (m.control === "booting") {
    ctx.fillStyle = C.text;
    ctx.textAlign = "center";
    ctx.font = `700 ${H * 0.16}px ${SANS}`;
    ctx.fillText("HAAS", W / 2, H * 0.38);
    ctx.font = `${H * 0.05}px ${SANS}`;
    ctx.fillStyle = C.muted;
    ctx.fillText("Next Generation Control — starting", W / 2, H * 0.52);
    const bw = W * 0.6;
    ctx.fillStyle = C.rule;
    ctx.fillRect((W - bw) / 2, H * 0.64, bw, H * 0.03);
    ctx.fillStyle = C.header;
    ctx.fillRect((W - bw) / 2, H * 0.64, bw * v.bootProgress, H * 0.03);
    return;
  }

  const pad = W * 0.025;
  const row = H * 0.075;

  // Header: mode left, zero-return state right.
  ctx.fillStyle = C.header;
  ctx.fillRect(0, 0, W, row * 1.3);
  ctx.font = `700 ${row * 0.62}px ${SANS}`;
  ctx.textAlign = "left";
  ctx.fillStyle = C.text;
  ctx.fillText(m.mode === "jog" ? "HANDLE JOG" : "MEMORY", pad, row * 0.65);
  const home = homeStatus(m);
  ctx.textAlign = "right";
  ctx.fillStyle = home.color;
  ctx.fillText(home.text, W - pad, row * 0.65);

  // Left: machine position.
  const colW = W * 0.52;
  let y = row * 2;
  ctx.textAlign = "left";
  ctx.fillStyle = C.muted;
  ctx.font = `600 ${row * 0.48}px ${SANS}`;
  ctx.fillText("MACHINE POSITION", pad, y);
  y += row * 0.9;
  ctx.font = `${row * 0.68}px ${MONO}`;
  for (const axis of AXES) {
    const selected = m.mode === "jog" && m.jogAxis === axis;
    if (selected) {
      ctx.fillStyle = C.panel;
      ctx.fillRect(pad * 0.5, y - row * 0.48, colW - pad, row * 0.96);
    }
    ctx.textAlign = "left";
    ctx.fillStyle = selected ? C.select : C.text;
    ctx.fillText(`${selected ? ">" : " "}${axis.toUpperCase()}`, pad, y);
    ctx.textAlign = "right";
    const unit = axis === "b" || axis === "c" ? "°" : " mm";
    ctx.fillText(`${v.position[axis].toFixed(axis === "b" || axis === "c" ? 2 : 3)}${unit}`, colW - pad, y);
    y += row;
  }

  // Right: spindle, program, coolant, services.
  const rx = colW + pad;
  y = row * 2;
  const field = (label: string, value: string, color = C.text) => {
    ctx.textAlign = "left";
    ctx.fillStyle = C.muted;
    ctx.font = `600 ${row * 0.42}px ${SANS}`;
    ctx.fillText(label, rx, y);
    ctx.textAlign = "right";
    ctx.fillStyle = color;
    ctx.font = `${row * 0.58}px ${MONO}`;
    ctx.fillText(value, W - pad, y);
    y += row * 0.92;
  };
  field("SPINDLE", `${v.rpm} RPM`, v.rpm > 0 ? C.ok : C.text);
  const program = programStatus(m);
  field("O09999 WARM-UP", program.text, program.color);
  const block = WARMUP_PROGRAM[m.programBlock];
  field("COMMANDED", m.program === "idle" ? "—" : `S${block.rpm} M03`);
  field("COOLANT", m.coolantOn ? "ON" : "OFF", m.coolantOn ? C.ok : C.text);
  field("DOOR", m.doorOpen ? "OPEN" : "CLOSED", m.doorOpen ? C.warn : C.text);
  field("AIR", `${airPressure(m).toFixed(1)} BAR`, m.airValveOpen ? C.text : C.alarm);

  // Alarms.
  y = row * 8.3;
  ctx.fillStyle = C.rule;
  ctx.fillRect(pad, y - row * 0.6, W - pad * 2, 2);
  ctx.textAlign = "left";
  ctx.font = `700 ${row * 0.5}px ${SANS}`;
  if (m.alarms.length === 0) {
    ctx.fillStyle = C.ok;
    ctx.fillText("NO ALARMS", pad, y);
  } else {
    ctx.fillStyle = C.alarm;
    ctx.fillText(`ALARMS (${m.alarms.length})`, pad, y);
    ctx.font = `${row * 0.5}px ${MONO}`;
    m.alarms.forEach((a, i) => {
      ctx.fillText(ALARM_TEXT[a], pad + W * 0.24 + (i % 2) * W * 0.36, y + Math.floor(i / 2) * row * 0.7);
    });
  }

  // Message line: the control's answer to the last thing pressed.
  if (v.message) {
    ctx.font = `${row * 0.46}px ${SANS}`;
    const lines = wrap(ctx, v.message, W - pad * 2).slice(0, 2);
    const top = H - row * 0.55 * (lines.length + 0.6);
    ctx.fillStyle = C.panel;
    ctx.fillRect(0, top - row * 0.3, W, H - top + row * 0.3);
    ctx.fillStyle = C.warn;
    ctx.textAlign = "left";
    lines.forEach((line, i) => ctx.fillText(line, pad, top + row * 0.55 * i + row * 0.2));
  }
}
