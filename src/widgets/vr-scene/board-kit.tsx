"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { RoundedBox } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { pulseFrom } from "@/features/xr/haptics";
import { PANEL } from "./panel-theme";

/**
 * The parts every in-scene board is made of, so the boards read as one
 * surface the way the side panel's sections do: a dark plate, text in five
 * roles, buttons, state pills, dots and stars.
 *
 * A board is painted, not built from text meshes: one canvas texture per
 * board, like the full pendant's keyboard. Troika text meshes (drei <Text>)
 * got the scene's WebGL context lost within seconds of the first board on
 * this machine's GPU; a painted board is one draw call, measures its text
 * exactly before laying it out, and uses the app's own faces — Inter for
 * headings, Open Sans for reading, JetBrains Mono for values — which troika
 * could only have done with font files of its own.
 *
 * Units are metres, origin at the board's top-left, y down. A board is read
 * at two to three metres, so body text is 4 cm.
 */
export const BOARD_DEPTH = 0.04;
/** Inner margin of a board. */
export const PAD = 0.09;
/** The board's front face, where the painted surface sits. */
export const FACE = BOARD_DEPTH / 2 + 0.001;
/** Canvas pixels per metre of board: 4 cm text is ~40 px. */
const PX_PER_M = 1000;
const MAX_CANVAS = 2048;

type Face = "heading" | "sans" | "mono";

export const TYPE = {
  /** A board's heading: the level title, the part's name. */
  title: { size: 0.056, face: "heading", weight: 600, color: PANEL.text },
  /** Instructions and names. */
  body: { size: 0.04, face: "sans", weight: 400, color: PANEL.text },
  /** Detail and hints. */
  muted: { size: 0.034, face: "sans", weight: 400, color: PANEL.textMuted },
  /** The overline above a title: mode and machine, section names. */
  caption: { size: 0.026, face: "mono", weight: 500, color: PANEL.textMuted },
  /** Precise values: times, scores, volumes, the scale factor. */
  value: { size: 0.044, face: "mono", weight: 500, color: PANEL.text },
} as const;

export type TextRole = keyof typeof TYPE;

const LINE_HEIGHT = 1.3;

// ---------------------------------------------------------------- fonts

const FALLBACK: Record<Face, string> = {
  heading: "Inter, 'Segoe UI', Helvetica, Arial, sans-serif",
  sans: "'Open Sans', 'Segoe UI', Helvetica, Arial, sans-serif",
  mono: "'JetBrains Mono', Consolas, 'Courier New', monospace",
};

/** The families next/font registered (layout.tsx puts them on <body>). */
function families(): Record<Face, string> {
  if (typeof document === "undefined") return FALLBACK;
  const style = getComputedStyle(document.body);
  const read = (name: string, face: Face) => style.getPropertyValue(name).trim() || FALLBACK[face];
  return {
    heading: read("--font-inter", "heading"),
    sans: read("--font-open-sans", "sans"),
    mono: read("--font-jetbrains-mono", "mono"),
  };
}

let FAMILY: Record<Face, string> = FALLBACK;

const fontOf = (role: TextRole, px = PX_PER_M) =>
  `${TYPE[role].weight} ${Math.round(TYPE[role].size * px)}px ${FAMILY[TYPE[role].face]}`;

/**
 * Re-renders once the web fonts have loaded, so text measured and painted
 * with a fallback face is measured and painted again with the real one.
 */
function useFontsReady() {
  const [ready, setReady] = useState(0);
  useEffect(() => {
    let live = true;
    FAMILY = families();
    document.fonts?.ready.then(() => {
      if (!live) return;
      FAMILY = families();
      setReady((n) => n + 1);
    });
    return () => {
      live = false;
    };
  }, []);
  return ready;
}

// ---------------------------------------------------------------- measuring

let measurer: CanvasRenderingContext2D | null = null;
function measureCtx() {
  if (!measurer && typeof document !== "undefined") measurer = document.createElement("canvas").getContext("2d");
  return measurer;
}

/** `text` broken into lines that fit `width` metres at `role`. */
export function wrap(text: string, width: number, role: TextRole): string[] {
  const ctx = measureCtx();
  if (!ctx) return text.split("\n");
  ctx.font = fontOf(role);
  const max = width * PX_PER_M;
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > max) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Width of one line of `text` at `role`, metres. */
export function textWidth(text: string, role: TextRole): number {
  const ctx = measureCtx();
  if (!ctx) return text.length * TYPE[role].size * 0.55;
  ctx.font = fontOf(role);
  return ctx.measureText(text).width / PX_PER_M;
}

/** Height of `lines` lines of `role` text, metres. */
export const linesHeight = (lines: number, role: TextRole) => lines * TYPE[role].size * LINE_HEIGHT;

// ---------------------------------------------------------------- painting

type Op =
  | { kind: "text"; lines: string[]; x: number; y: number; role: TextRole; color: string; align: "left" | "center" | "right" }
  | { kind: "rect"; x: number; y: number; w: number; h: number; color: string; radius: number; alpha: number }
  | { kind: "circle"; x: number; y: number; r: number; color: string }
  | { kind: "star"; x: number; y: number; r: number; color: string }
  | { kind: "button"; id: string; label: string; x: number; y: number; w: number; h: number; variant: ButtonVariant; disabled: boolean };

export type ButtonVariant = "primary" | "secondary";

type Hit = { id: string; x: number; y: number; w: number; h: number; onPress: () => void; disabled: boolean };

/**
 * What a row draws with. Coordinates are metres from the board's top-left,
 * y down; text hangs from its top.
 */
export class Painter {
  ops: Op[] = [];
  hits: Hit[] = [];

  /** Wrapped text; returns its height. */
  text(text: string, x: number, y: number, role: TextRole, opts: { width?: number; color?: string; align?: "left" | "center" | "right" } = {}) {
    const lines = opts.width ? wrap(text, opts.width, role) : text.split("\n");
    this.ops.push({ kind: "text", lines, x, y, role, color: opts.color ?? TYPE[role].color, align: opts.align ?? "left" });
    return linesHeight(lines.length, role);
  }

  rect(x: number, y: number, w: number, h: number, color: string, opts: { radius?: number; alpha?: number } = {}) {
    this.ops.push({ kind: "rect", x, y, w, h, color, radius: opts.radius ?? 0.012, alpha: opts.alpha ?? 1 });
  }

  circle(x: number, y: number, r: number, color: string) {
    this.ops.push({ kind: "circle", x, y, r, color });
  }

  star(x: number, y: number, r: number, filled: boolean) {
    this.ops.push({ kind: "star", x, y, r, color: filled ? PANEL.text : PANEL.controlHover });
  }

  button(label: string, x: number, y: number, w: number, onPress: () => void, opts: { variant?: ButtonVariant; disabled?: boolean } = {}) {
    const id = `${label}@${x.toFixed(3)},${y.toFixed(3)}`;
    const disabled = opts.disabled ?? false;
    this.ops.push({ kind: "button", id, label, x, y, w, h: BUTTON_H, variant: opts.variant ?? "secondary", disabled });
    this.hits.push({ id, x, y, w, h: BUTTON_H, onPress, disabled });
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function paint(ctx: CanvasRenderingContext2D, ops: Op[], scale: number, hovered: string | null) {
  const s = (m: number) => m * scale;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = PANEL.surface;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.textBaseline = "top";
  for (const op of ops) {
    switch (op.kind) {
      case "text": {
        ctx.font = fontOf(op.role, scale);
        ctx.fillStyle = op.color;
        ctx.textAlign = op.align;
        const lh = TYPE[op.role].size * LINE_HEIGHT;
        // Half the leading above the glyphs, as CSS line-height does.
        const lead = (lh - TYPE[op.role].size) / 2;
        op.lines.forEach((line, i) => ctx.fillText(line, s(op.x), s(op.y + lead + i * lh)));
        break;
      }
      case "rect":
        ctx.globalAlpha = op.alpha;
        ctx.fillStyle = op.color;
        roundRect(ctx, s(op.x), s(op.y), s(op.w), s(op.h), s(op.radius));
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      case "circle":
        ctx.fillStyle = op.color;
        ctx.beginPath();
        ctx.arc(s(op.x), s(op.y), s(op.r), 0, Math.PI * 2);
        ctx.fill();
        break;
      case "star": {
        ctx.fillStyle = op.color;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const r = i % 2 === 0 ? op.r : op.r * 0.45;
          const px = s(op.x + Math.cos(a) * r);
          const py = s(op.y + Math.sin(a) * r);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "button": {
        const hot = hovered === op.id && !op.disabled;
        const primary = op.variant === "primary";
        ctx.fillStyle = op.disabled
          ? PANEL.controlDisabled
          : primary
            ? hot
              ? PANEL.text
              : PANEL.primary
            : hot
              ? PANEL.controlHover
              : PANEL.control;
        roundRect(ctx, s(op.x), s(op.y), s(op.w), s(op.h), s(0.014));
        ctx.fill();
        ctx.font = `500 ${Math.round(0.032 * scale)}px ${FAMILY.sans}`;
        ctx.fillStyle = op.disabled ? PANEL.textMuted : primary ? PANEL.primaryText : PANEL.text;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(op.label, s(op.x + op.w / 2), s(op.y + op.h / 2), s(op.w - 0.02));
        ctx.textBaseline = "top";
        break;
      }
    }
  }
}

export const noRaycast: THREE.Object3D["raycast"] = () => {};

// ---------------------------------------------------------------- rows

/**
 * One row of a stacked board: its height, and how to paint it given the
 * row's top-left (x, y) in board metres.
 */
export type Row = { h: number; gap?: number; paint: (p: Painter, x: number, y: number) => void };

const ROW_GAP = 0.03;

export const stackHeight = (rows: Row[]) =>
  rows.reduce((sum, r, i) => sum + r.h + (i < rows.length - 1 ? (r.gap ?? ROW_GAP) : 0), 0);

export const BUTTON_H = 0.085;
const GAP = 0.03;

/** Width a button needs for its label. */
export const buttonWidth = (label: string) => Math.max(0.24, textWidth(label, "body") * 0.85 + 0.08);

function layoutButtons(labels: string[], width: number) {
  let x = 0;
  let y = 0;
  return labels.map((label) => {
    const w = Math.min(width, buttonWidth(label));
    if (x > 0 && x + w > width) {
      x = 0;
      y += BUTTON_H + GAP;
    }
    const at = { x, y, w };
    x += w + GAP;
    return at;
  });
}

/** A row of one text role, wrapped to `width`. */
export function textRow(text: string, role: TextRole, width: number, opts: { color?: string; gap?: number } = {}): Row {
  const lines = wrap(text, width, role);
  return {
    h: linesHeight(lines.length, role),
    gap: opts.gap,
    paint: (p, x, y) => p.text(text, x, y, role, { width, color: opts.color }),
  };
}

type ButtonSpec = { label: string; onPress: () => void; disabled?: boolean; variant?: ButtonVariant };

/** Buttons laid left to right, wrapping at `width`. */
export function buttonsRow(buttons: ButtonSpec[], width: number): Row {
  const placed = layoutButtons(buttons.map((b) => b.label), width);
  const h = placed.length ? placed[placed.length - 1].y + BUTTON_H : 0;
  return {
    h,
    paint: (p, x, y) =>
      buttons.forEach((b, i) =>
        p.button(b.label, x + placed[i].x, y + placed[i].y, placed[i].w, b.onPress, { variant: b.variant, disabled: b.disabled }),
      ),
  };
}

/** Key caps, not pressable — the full-panel keys a tutorial step asks for. */
export function keysRow(keys: string[], width: number): Row {
  const labels = keys.map((k) => k.replace(/_/g, " "));
  const widths = labels.map((l) => Math.max(0.12, textWidth(l, "caption") + 0.05));
  let cx = 0;
  let cy = 0;
  const placed = widths.map((w) => {
    if (cx > 0 && cx + w > width) {
      cx = 0;
      cy += 0.07;
    }
    const at = { x: cx, y: cy, w };
    cx += w + 0.02;
    return at;
  });
  const h = placed.length ? placed[placed.length - 1].y + 0.055 : 0;
  return {
    h,
    paint: (p, x, y) =>
      labels.forEach((label, i) => {
        p.rect(x + placed[i].x, y + placed[i].y, placed[i].w, 0.055, PANEL.control, { radius: 0.008 });
        p.text(label, x + placed[i].x + placed[i].w / 2, y + placed[i].y + 0.01, "caption", { color: PANEL.text, align: "center" });
      }),
  };
}

/** Label over value, side by side: Time · Score · Stars. */
export function statsRow(stats: { label: string; value: string | { stars: number | null } }[], width: number): Row {
  const col = width / Math.max(1, stats.length);
  return {
    h: linesHeight(1, "caption") + 0.012 + linesHeight(1, "value"),
    paint: (p, x, y) =>
      stats.forEach((s, i) => {
        const cx = x + i * col;
        p.text(s.label.toUpperCase(), cx, y, "caption");
        const vy = y + linesHeight(1, "caption") + 0.012;
        if (typeof s.value === "string") p.text(s.value, cx, vy, "value");
        else if (s.value.stars === null) p.text("…", cx, vy, "value", { color: PANEL.textMuted });
        else for (let k = 0; k < 3; k++) p.star(cx + 0.028 + k * 0.065, vy + 0.03, 0.028, k < (s.value.stars ?? 0));
      }),
  };
}

/** Lines with a state dot: a checklist, a job's stages. */
export function checklistRow(items: { label: string; color: string; dim?: boolean }[], width: number): Row {
  const inner = width - 0.06;
  const heights = items.map((it) => linesHeight(wrap(it.label, inner, "body").length, "body"));
  const h = heights.reduce((a, b) => a + b, 0) + Math.max(0, items.length - 1) * 0.012;
  return {
    h,
    paint: (p, x, y) => {
      let at = y;
      items.forEach((it, i) => {
        p.circle(x + 0.018, at + TYPE.body.size * LINE_HEIGHT * 0.5, 0.016, it.color);
        p.text(it.label, x + 0.06, at, "body", { width: inner, color: it.dim ? PANEL.textMuted : undefined });
        at += heights[i] + 0.012;
      });
    },
  };
}

/** Label on the left, value on the right, one line each. */
export function pairsRow(pairs: { label: string; value: string; color?: string }[], width: number): Row {
  const lh = linesHeight(1, "body");
  return {
    h: pairs.length * lh + Math.max(0, pairs.length - 1) * 0.006,
    paint: (p, x, y) =>
      pairs.forEach((pair, i) => {
        const py = y + i * (lh + 0.006);
        p.text(pair.label, x, py, "body", { color: PANEL.textMuted });
        p.text(pair.value, x + width, py, "body", { color: pair.color, align: "right" });
      }),
  };
}

/** The 3D counterpart of the DOM status pill: a tinted plate carrying the
 *  state word, so hue and text always arrive together. */
export function pill(p: Painter, state: string, tone: string, x: number, y: number, w: number) {
  p.rect(x, y, w, 0.052, tone, { radius: 0.01, alpha: 0.2 });
  p.text(state, x + w / 2, y + 0.008, "caption", { color: tone, align: "center" });
}

// ---------------------------------------------------------------- boards

function useBoardCanvas(width: number, height: number) {
  const scale = Math.min(PX_PER_M, MAX_CANVAS / Math.max(width, height));
  const [surface] = useState(() => {
    const canvas = document.createElement("canvas");
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.generateMipmaps = true;
    return { canvas, texture };
  });
  useEffect(() => () => surface.texture.dispose(), [surface]);
  return { ...surface, scale };
}

const INSET = 0.015;

/** The signature of a paint list: what changed, without the callbacks. */
const signature = (ops: Op[]) => JSON.stringify(ops);

/**
 * A board: a plate with a painted face and a pressable area over each
 * button. `anchor` "top" hangs it from its top edge at the group's origin —
 * a board that grows (a longer instruction, a measured part) grows towards
 * the floor, never into the board above; "center" centres it.
 */
export function StackBoard({
  width,
  rows,
  edge = PANEL.edge,
  anchor = "top",
}: {
  width: number;
  rows: Row[];
  /** A tone for the rim — only for a board whose whole content is one state. */
  edge?: string;
  anchor?: "top" | "center";
}) {
  useFontsReady();
  const height = stackHeight(rows) + 2 * PAD;
  const painter = new Painter();
  let y = PAD;
  for (const r of rows) {
    r.paint(painter, PAD, y);
    y += r.h + (r.gap ?? ROW_GAP);
  }
  const [hovered, setHovered] = useState<string | null>(null);
  const { canvas, texture, scale } = useBoardCanvas(width, height);
  const sig = signature(painter.ops);

  // The face plane is inset 1.5 cm a side so the plate's corners stay round;
  // the texture is cropped to match, so a painted pixel lands where the
  // layout put it.
  useLayoutEffect(() => {
    texture.repeat.set((width - 2 * INSET) / width, (height - 2 * INSET) / height);
    texture.offset.set(INSET / width, INSET / height);
  }, [texture, width, height]);

  useLayoutEffect(() => {
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      // WebGL2 textures get immutable storage at their first upload; a canvas
      // that grows has to be uploaded as a new texture, or it is squeezed
      // into the old one's size.
      texture.dispose();
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    paint(ctx, painter.ops, scale, hovered);
    texture.needsUpdate = true;
    // `sig` stands for the paint list; the painter itself is new every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, hovered, width, height, scale, canvas, texture]);

  const offsetY = anchor === "top" ? -height / 2 : 0;
  return (
    <group position={[0, offsetY, 0]}>
      <RoundedBox args={[width, height, BOARD_DEPTH]} radius={0.03} raycast={noRaycast}>
        <meshStandardMaterial color={PANEL.surface} roughness={0.65} metalness={0.05} />
      </RoundedBox>
      <RoundedBox args={[width + 0.01, height + 0.01, BOARD_DEPTH * 0.95]} radius={0.03} raycast={noRaycast}>
        <meshBasicMaterial color={edge} wireframe />
      </RoundedBox>
      <mesh position={[0, 0, FACE]} raycast={noRaycast}>
        <planeGeometry args={[width - 2 * INSET, height - 2 * INSET]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {painter.hits.map((hit) => (
        <mesh
          key={hit.id}
          position={[-width / 2 + hit.x + hit.w / 2, height / 2 - hit.y - hit.h / 2, FACE + 0.004]}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            if (hit.disabled) return;
            pulseFrom(e, "tap");
            hit.onPress();
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(hit.id);
          }}
          onPointerOut={() => setHovered((h) => (h === hit.id ? null : h))}
        >
          <planeGeometry args={[hit.w, hit.h]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
