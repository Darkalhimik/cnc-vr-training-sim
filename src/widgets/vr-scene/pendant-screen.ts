import { HOMING_SEQUENCE, TOOL_COLS, TOOL_ROWS, sortedPrograms } from "@/entities/machine/machine-logic";
import {
  AXES,
  MODE_STATUS,
  WORK_OFFSET_IDS,
  type Axis,
  type AxisValues,
  type MachineState,
  airPressure,
  spindleRpm,
  workPosition,
} from "@/entities/machine/machine-types";

/**
 * The NGC control screen, painted onto the pendant's display — the one on the
 * machine and the one on the full panel, at their own sizes.
 *
 * Laid out like the real control (docs/haas-ngc/operation.md §2): mode bar,
 * program pane on the left, the page chosen with the display keys on the
 * right, spindle and override status, the icon bar, then the input bar and
 * messages along the bottom. These are the control's own colours, not the
 * app's tone scale — this is a piece of the machine.
 */
export type ScreenView = {
  machine: MachineState;
  message: string | null;
  /** Drawn axis positions, which lag the commanded ones while moving. */
  position: AxisValues;
  /** End of the move in progress, while a program runs. */
  moveEnd: AxisValues | null;
  rpm: number;
  bootProgress: number;
  blink: boolean;
};

const C = {
  bg: "#e9ecef",
  pane: "#ffffff",
  paneDim: "#f4f6f8",
  header: "#1d4f7a",
  headerText: "#ffffff",
  text: "#14181c",
  muted: "#5c6873",
  rule: "#c3cad1",
  select: "#2f6fdc",
  selectText: "#ffffff",
  current: "#ffe58a",
  alarm: "#c62828",
  ok: "#1b7f3b",
  warn: "#b8640a",
};

const MONO = '"JetBrains Mono", "Consolas", "Menlo", monospace';
const SANS = '"Open Sans", "Segoe UI", "Helvetica", sans-serif';

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/** Everything the screen shows, so it is only repainted when that changes. */
export function screenKey(v: ScreenView): string {
  const m = v.machine;
  if (m.control === "off") return "off";
  if (m.control === "booting") return `boot:${Math.floor(v.bootProgress * 40)}`;
  return JSON.stringify([
    m.mode,
    m.display,
    m.positionTab,
    m.offsetTab,
    m.offsetCursor,
    m.input,
    m.jogAxis,
    m.handleIncrement,
    m.alarms,
    m.homed,
    m.homingStage,
    AXES.map((a) => round(v.position[a], 2)),
    v.moveEnd && AXES.map((a) => round(v.moveEnd![a], 2)),
    v.rpm,
    m.coolantOn,
    m.overrides,
    m.singleBlock,
    m.optionStop,
    m.blockDelete,
    m.program,
    m.programLine,
    m.activeProgram,
    m.programs[m.activeProgram]?.length,
    m.mdi,
    m.toolInSpindle,
    m.display === "offset" ? [m.workOffsets, m.tools] : null,
    m.display === "commands" ? m.activeCodes : null,
    m.activeWorkOffset,
    m.workOffsets[m.activeWorkOffset],
    m.runSource,
    m.display === "list" ? Object.keys(m.programs) : null,
    m.doorOpen,
    v.message,
    m.homingStage !== null && v.blink,
  ]);
}

function homeStatus(m: MachineState): { text: string; color: string } {
  if (m.homingStage !== null) {
    const axes = HOMING_SEQUENCE[m.homingStage].axes
      .filter((a) => m.homingAxes.includes(a))
      .map((a) => a.toUpperCase())
      .join(" ");
    return { text: `ZERO RETURN ${axes}`, color: C.warn };
  }
  return m.homed ? { text: "HOMED", color: C.ok } : { text: "NOT HOMED", color: C.warn };
}

type Ctx = CanvasRenderingContext2D;

function box(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

function text(ctx: Ctx, s: string, x: number, y: number, size: number, color = C.text, opts: { align?: CanvasTextAlign; font?: string; weight?: number } = {}) {
  ctx.textAlign = opts.align ?? "left";
  ctx.fillStyle = color;
  ctx.font = `${opts.weight ?? 400} ${size}px ${opts.font ?? SANS}`;
  ctx.fillText(s, x, y);
}

/** A strip of tabs; the active one is highlighted. */
/** Text squeezed into `maxW`: a smaller size down to 70%, then cut with an ellipsis. */
function fitText(ctx: Ctx, s: string, x: number, y: number, maxW: number, size: number, color: string, opts: { align?: CanvasTextAlign; weight?: number } = {}) {
  const font = (px: number) => `${opts.weight ?? 400} ${px}px ${SANS}`;
  ctx.font = font(size);
  const width = ctx.measureText(s).width;
  const px = width > maxW ? Math.max(size * 0.7, (size * maxW) / width) : size;
  ctx.font = font(px);
  let shown = s;
  if (ctx.measureText(shown).width > maxW) {
    while (shown.length > 1 && ctx.measureText(`${shown}…`).width > maxW) shown = shown.slice(0, -1);
    shown = `${shown}…`;
  }
  text(ctx, shown, x, y, px, color, opts);
}

function tabs(ctx: Ctx, labels: string[], active: number, x: number, y: number, w: number, h: number) {
  const tw = w / labels.length;
  labels.forEach((label, i) => {
    box(ctx, x + i * tw + 1, y, tw - 2, h, i === active ? C.header : C.paneDim);
    text(ctx, label, x + i * tw + tw / 2, y + h / 2, h * 0.5, i === active ? C.headerText : C.muted, {
      align: "center",
      weight: 600,
    });
  });
}

function fmtAxis(axis: Axis, value: number) {
  return axis === "b" || axis === "c" ? `${value.toFixed(3)}` : `${value.toFixed(3)}`;
}

/** The program pane: the program around the executing line. */
function programPane(ctx: Ctx, m: MachineState, x: number, y: number, w: number, h: number, row: number) {
  const mdi = m.mode === "mdi";
  const name = mdi ? "MDI" : m.activeProgram;
  const source = mdi ? m.mdi : (m.programs[m.activeProgram] ?? "");
  box(ctx, x, y, w, h, C.pane);
  box(ctx, x, y, w, row, C.header);
  text(ctx, name, x + 8, y + row / 2, row * 0.55, C.headerText, { weight: 700 });
  const lines = source.split("\n");
  const visible = Math.floor((h - row) / (row * 0.8));
  const current = Math.max(0, m.programLine - 1);
  const first = Math.max(0, Math.min(lines.length - visible, current - Math.floor(visible / 3)));
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y + row, w, h - row);
  ctx.clip();
  for (let i = 0; i < visible && first + i < lines.length; i++) {
    const n = first + i;
    const ly = y + row + (i + 0.5) * row * 0.8;
    if (m.program !== "idle" && n === current) box(ctx, x, ly - row * 0.4, w, row * 0.8, C.current);
    text(ctx, lines[n], x + 8, ly, row * 0.42, C.text, { font: MONO });
  }
  if (mdi && !source.trim()) text(ctx, "Type blocks, then INSERT", x + 8, y + row * 1.5, row * 0.42, C.muted);
  ctx.restore();
}

function positionPage(ctx: Ctx, v: ScreenView, x: number, y: number, w: number, h: number, row: number) {
  const m = v.machine;
  const labels = ["OPERATOR", `WORK ${m.activeWorkOffset}`, "MACHINE", "DIST TO GO", "ALL"];
  const order = ["operator", "work", "machine", "togo", "all"] as const;
  tabs(ctx, labels, order.indexOf(m.positionTab), x, y, w, row);
  const work = workPosition({ ...m, position: v.position });
  const values: Record<(typeof order)[number], AxisValues> = {
    operator: Object.fromEntries(AXES.map((a) => [a, v.position[a] - m.operatorOrigin[a]])) as AxisValues,
    work,
    machine: v.position,
    togo: Object.fromEntries(AXES.map((a) => [a, v.moveEnd ? v.moveEnd[a] - v.position[a] : 0])) as AxisValues,
    all: v.position,
  };
  box(ctx, x, y + row, w, h - row, C.pane);
  if (m.positionTab === "all") {
    const cols = ["operator", "work", "machine", "togo"] as const;
    cols.forEach((tab, ci) => {
      const cx = x + 30 + ((w - 40) / 4) * (ci + 1) - 10;
      text(ctx, labels[order.indexOf(tab)], cx, y + row * 1.6, row * 0.38, C.muted, { align: "right", weight: 600 });
      AXES.forEach((a, i) => {
        text(ctx, fmtAxis(a, values[tab][a]), cx, y + row * (2.5 + i * 0.9), row * 0.5, C.text, { align: "right", font: MONO });
      });
    });
    AXES.forEach((a, i) => text(ctx, a.toUpperCase(), x + 12, y + row * (2.5 + i * 0.9), row * 0.55, C.text, { weight: 700 }));
    return;
  }
  const shown = values[m.positionTab];
  AXES.forEach((a, i) => {
    const ly = y + row * (1.9 + i * 1.15);
    const sel = m.mode === "jog" && m.jogAxis === a;
    if (sel) box(ctx, x + 4, ly - row * 0.5, w - 8, row, C.current);
    text(ctx, a.toUpperCase(), x + 14, ly, row * 0.8, C.text, { weight: 700 });
    text(ctx, fmtAxis(a, shown[a]), x + w - 16, ly, row * 0.8, C.text, { align: "right", font: MONO });
  });
}

function offsetPage(ctx: Ctx, m: MachineState, x: number, y: number, w: number, h: number, row: number) {
  tabs(ctx, ["TOOL", "WORK"], m.offsetTab === "tool" ? 0 : 1, x, y, w, row);
  box(ctx, x, y + row, w, h - row, C.pane);
  const r = row * 0.78;
  const top = y + row * 1.05;
  const cell = (s: string, cx: number, cy: number, selected: boolean, cw: number) => {
    if (selected) box(ctx, cx - cw + 4, cy - r / 2, cw - 4, r, C.select);
    text(ctx, s, cx - 4, cy, r * 0.55, selected ? C.selectText : C.text, { align: "right", font: MONO });
  };
  if (m.offsetTab === "tool") {
    const heads = ["TOOL", "LENGTH (H)", "L WEAR", "DIA (D)", "D WEAR"];
    const cw = (w - 8) / heads.length;
    heads.forEach((hd, i) => text(ctx, hd, x + 4 + cw * (i + 1) - 4, top + r / 2, r * 0.42, C.muted, { align: "right", weight: 600 }));
    const visible = Math.floor((h - row * 2) / r);
    const first = Math.max(0, Math.min(TOOL_ROWS - visible, m.offsetCursor.row - Math.floor(visible / 2)));
    for (let i = 0; i < visible; i++) {
      const t = first + i + 1;
      const ty = top + r * (i + 1.5);
      const off = m.tools[t] ?? { length: 0, lengthWear: 0, diameter: 0, diameterWear: 0 };
      const inSpindle = t === m.toolInSpindle;
      text(ctx, `${inSpindle ? "▶" : " "}${t}`, x + 4 + cw - 4, ty, r * 0.55, inSpindle ? C.ok : C.text, { align: "right", font: MONO, weight: 700 });
      TOOL_COLS.forEach((col, ci) => {
        const sel = m.offsetCursor.row === t - 1 && m.offsetCursor.col === ci;
        cell(off[col].toFixed(3), x + 4 + cw * (ci + 2), ty, sel, cw);
      });
    }
    return;
  }
  const heads = ["G CODE", ...AXES.map((a) => a.toUpperCase())];
  const cw = (w - 8) / heads.length;
  heads.forEach((hd, i) => text(ctx, hd, x + 4 + cw * (i + 1) - 4, top + r / 2, r * 0.42, C.muted, { align: "right", weight: 600 }));
  WORK_OFFSET_IDS.forEach((id, i) => {
    const ty = top + r * (i + 1.5);
    text(ctx, id, x + 4 + cw - 4, ty, r * 0.55, C.text, { align: "right", font: MONO, weight: 700 });
    AXES.forEach((a, ci) => {
      const sel = m.offsetCursor.row === i && m.offsetCursor.col === ci;
      cell(m.workOffsets[id][a].toFixed(3), x + 4 + cw * (ci + 2), ty, sel, cw);
    });
  });
  text(ctx, "Type a value: F1 sets it, ENTER adds it. PART ZERO SET takes the machine position.", x + 8, y + h - r * 0.6, r * 0.42, C.muted);
}

function listPage(ctx: Ctx, m: MachineState, x: number, y: number, w: number, h: number, row: number) {
  tabs(ctx, ["MEMORY", "USB", "NET SHARE"], 0, x, y, w, row);
  box(ctx, x, y + row, w, h - row, C.pane);
  sortedPrograms(m).forEach((name, i) => {
    const ly = y + row * (1.6 + i * 0.85);
    const sel = m.offsetCursor.row === i;
    if (sel) box(ctx, x + 4, ly - row * 0.4, w - 8, row * 0.8, C.select);
    const color = sel ? C.selectText : C.text;
    text(ctx, `${name === m.activeProgram ? "A " : "  "}${name}`, x + 12, ly, row * 0.5, color, { font: MONO, weight: 700 });
    const title = /\(([^)]*)\)/.exec(m.programs[name])?.[1] ?? "";
    text(ctx, title, x + w * 0.35, ly, row * 0.42, color);
  });
  text(ctx, "A = active. SELECT PROGRAM makes the highlighted one active.", x + 8, y + h - row * 0.5, row * 0.38, C.muted);
}

function commandsPage(ctx: Ctx, v: ScreenView, x: number, y: number, w: number, h: number, row: number) {
  const m = v.machine;
  const c = m.activeCodes;
  tabs(ctx, ["ACTIVE CODES", "TIMERS", "TOOL TABLE"], 0, x, y, w, row);
  box(ctx, x, y + row, w, h - row, C.pane);
  // The G-code groups on the left, as the control lists them.
  const groups: [string, string][] = [
    ["MOTION", c.motion],
    ["PLANE", c.plane],
    ["DISTANCE", c.distance],
    ["FEED MODE", c.feedMode],
    ["UNITS", c.units],
    ["CUTTER COMP", c.cutterComp],
    ["TOOL LENGTH", c.toolLength],
    ["CANNED CYCLE", c.cycle],
    ["RETURN", c.returnLevel],
    ["WORK OFFSET", c.workOffset],
    ["TILTED PLANE", c.dynamicWorkOffset],
    ["ROTATION / SCALE", `${c.rotation} ${c.scaling}`],
  ];
  const pad = (n: number) => String(n).padStart(2, "0");
  const spindle = c.spindle === "stop" ? "M05" : c.spindle === "cw" ? "M03" : "M04";
  const others: [string, string][] = [
    ["T / H / D", `T${c.tool}  H${pad(c.h)}  D${pad(c.d)}`],
    ["NEXT TOOL", `T${c.nextTool}`],
    ["SPINDLE", `${spindle} S${c.spindleSpeed}`],
    ["COOLANT", c.coolant ? "M08" : "M09"],
    ["FEED", `F${c.feed}`],
    ["PROGRAM", `${m.runSource === "mdi" ? "MDI" : m.activeProgram}  L${m.programLine}`],
    ["MODE", MODE_STATUS[m.mode]],
  ];
  const step = Math.min(row * 0.72, (h - row * 1.6) / groups.length);
  const col = (items: [string, string][], cx: number, cw: number) =>
    items.forEach(([k, val], i) => {
      const ly = y + row * 1.5 + i * step;
      text(ctx, k, cx + 10, ly, step * 0.5, C.muted, { weight: 600 });
      text(ctx, val, cx + cw - 10, ly, step * 0.62, C.text, { align: "right", font: MONO, weight: 700 });
    });
  col(groups, x, w * 0.5);
  ctx.fillStyle = C.rule;
  ctx.fillRect(x + w * 0.5, y + row * 1.15, 1, h - row * 1.4);
  col(others, x + w * 0.5, w * 0.5);
}

function alarmsPage(ctx: Ctx, m: MachineState, x: number, y: number, w: number, h: number, row: number) {
  tabs(ctx, ["ACTIVE ALARM", "MESSAGES", "ALARM HISTORY"], 0, x, y, w, row);
  box(ctx, x, y + row, w, h - row, C.pane);
  if (m.alarms.length === 0) {
    text(ctx, "NO ALARMS", x + 12, y + row * 1.8, row * 0.6, C.ok, { weight: 700 });
    return;
  }
  m.alarms.forEach((a, i) => text(ctx, a.text, x + 12, y + row * (1.8 + i * 0.95), row * 0.52, C.alarm, { weight: 700, font: MONO }));
}

function infoPage(ctx: Ctx, title: string, lines: string[], x: number, y: number, w: number, h: number, row: number) {
  tabs(ctx, [title], 0, x, y, w, row);
  box(ctx, x, y + row, w, h - row, C.pane);
  lines.forEach((l, i) => text(ctx, l, x + 12, y + row * (1.7 + i * 0.85), row * 0.45, C.text, { font: MONO }));
}

export function drawPendantScreen(canvas: HTMLCanvasElement, v: ScreenView) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width: W, height: H } = canvas;
  const m = v.machine;
  ctx.textBaseline = "middle";

  if (m.control === "off") {
    box(ctx, 0, 0, W, H, "#000");
    return;
  }
  if (m.control === "booting") {
    box(ctx, 0, 0, W, H, "#0d1319");
    text(ctx, "HAAS", W / 2, H * 0.38, H * 0.16, "#e6edf3", { align: "center", weight: 700 });
    text(ctx, "Next Generation Control — starting", W / 2, H * 0.52, H * 0.05, "#8a9aab", { align: "center" });
    const bw = W * 0.6;
    box(ctx, (W - bw) / 2, H * 0.64, bw, H * 0.03, "#2a3644");
    box(ctx, (W - bw) / 2, H * 0.64, bw * v.bootProgress, H * 0.03, C.header);
    return;
  }

  box(ctx, 0, 0, W, H, C.bg);
  const row = H * 0.058;

  // Mode bar.
  box(ctx, 0, 0, W, row * 1.15, C.header);
  text(ctx, MODE_STATUS[m.mode], 10, row * 0.6, row * 0.6, C.headerText, { weight: 700 });
  const home = homeStatus(m);
  const run = m.program === "running" ? "RUNNING" : m.program === "hold" ? (m.doorOpen ? "DOOR HOLD" : "FEED HOLD") : m.program === "stopped" ? "STOPPED" : "";
  text(ctx, run, W * 0.5, row * 0.6, row * 0.55, "#ffe58a", { align: "center", weight: 700 });
  text(ctx, home.text, W - 10, row * 0.6, row * 0.5, m.homed ? "#9ee7b4" : "#ffd28a", { align: "right", weight: 700 });

  // Program pane | main page.
  const top = row * 1.35;
  const bodyH = H - top - row * 3.4;
  const leftW = W * 0.36;
  programPane(ctx, m, 6, top, leftW - 10, bodyH, row);
  const mx = leftW + 2;
  const mw = W - mx - 6;
  switch (m.display) {
    case "offset":
      offsetPage(ctx, m, mx, top, mw, bodyH, row);
      break;
    case "list":
      listPage(ctx, m, mx, top, mw, bodyH, row);
      break;
    case "commands":
      commandsPage(ctx, v, mx, top, mw, bodyH, row);
      break;
    case "alarms":
      alarmsPage(ctx, m, mx, top, mw, bodyH, row);
      break;
    case "setting":
      infoPage(ctx, "SETTINGS", ["9   DIMENSIONING      MM", "40  TOOL OFFSET MEASURE DIAMETER", "64  T.OFS MEAS USES WORK  OFF", "22  CAN CYCLE DELTA Z   0.254", "52  G83 RETRACT ABOVE R  0."], mx, top, mw, bodyH, row);
      break;
    case "diagnostic":
      infoPage(ctx, "DIAGNOSTIC", [`AIR PRESSURE  ${airPressure(m).toFixed(1)} BAR`, `DOOR          ${m.doorOpen ? "OPEN" : "CLOSED"}`, `E-STOP        ${m.estopPressed ? "PRESSED" : "RELEASED"}`, `SPINDLE       ${spindleRpm(m)} RPM`], mx, top, mw, bodyH, row);
      break;
    case "help":
      infoPage(ctx, "HELP", ["Display keys pick this pane.", "Mode keys pick what the keys do.", "RESET clears alarms and stops.", "CYCLE START runs MEM or MDI."], mx, top, mw, bodyH, row);
      break;
    default:
      positionPage(ctx, v, mx, top, mw, bodyH, row);
  }

  // Spindle status and overrides.
  const sy = top + bodyH + 4;
  box(ctx, 6, sy, W - 12, row * 1.2, C.pane);
  const status = [
    `S ${v.rpm} RPM`,
    `T${m.toolInSpindle}`,
    `FEED ${m.overrides.feed}%`,
    `SPINDLE ${m.overrides.spindle}%`,
    `RAPID ${m.overrides.rapid}%`,
    m.coolantOn ? "COOLANT ON" : "COOLANT OFF",
  ];
  const cw = (W - 12) / status.length;
  status.forEach((s, i) => text(ctx, s, 6 + cw * i + cw / 2, sy + row * 0.6, row * 0.45, C.text, { align: "center", font: MONO, weight: 600 }));

  // Icon bar: the toggles and states the NGC shows as icons.
  const iy = sy + row * 1.3;
  const icons = [
    m.singleBlock && "SINGLE BLK",
    m.optionStop && "OPT STOP",
    m.blockDelete && "BLK DELETE",
    m.mode === "jog" && `JOG ${m.jogAxis?.toUpperCase() ?? "-"} ×${m.handleIncrement}`,
    m.doorOpen && "DOOR OPEN",
    !m.airValveOpen && "LOW AIR",
  ].filter(Boolean) as string[];
  icons.forEach((s, i) => {
    box(ctx, 6 + i * W * 0.16, iy, W * 0.155, row * 0.8, "#dde3e8");
    text(ctx, s, 6 + i * W * 0.16 + W * 0.0775, iy + row * 0.4, row * 0.36, C.text, { align: "center", weight: 700 });
  });

  // Input bar | messages | alarm status.
  const by = H - row * 1.1;
  box(ctx, 0, by, W, row * 1.1, "#d3d9de");
  text(ctx, `> ${m.input}${v.blink ? "_" : ""}`, 10, by + row * 0.55, row * 0.5, C.text, { font: MONO });
  if (v.message) fitText(ctx, v.message, W * 0.31, by + row * 0.55, W * 0.44, row * 0.38, C.warn);
  // The full alarm text is on the ALARMS page; the status bar names it.
  const alarm = m.alarms[0];
  const alarmStatus = !alarm ? "NO ALARMS" : m.alarms.length > 1 ? `${m.alarms.length} ALARMS` : alarm.text;
  fitText(ctx, alarmStatus, W - 10, by + row * 0.55, W * 0.22, row * 0.42, alarm ? C.alarm : C.ok, {
    align: "right",
    weight: 700,
  });
}
