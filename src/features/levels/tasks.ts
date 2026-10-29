/**
 * The task levels: a drawing (a designer part), a blank already clamped and
 * probed, and a program header to start from. The trainee writes the rest;
 * the part that comes off the machine is measured against the same design
 * cut by the CAM's own program (grading.ts).
 */
import type { PartDesign } from "@/entities/part/part-design";
import { toolByNumber } from "@/entities/part/tool-library";
import { PRACTICE_STOCK, readyMachine, startAt } from "./machine-setups";

export type TaskLevel = {
  design: PartDesign;
  /** What the drawing asks for, one requirement per line. */
  brief: string[];
  /** The tools to use, in the carousel and measured. */
  tools: number[];
  /** Below this deviation the part counts as on size, mm. */
  tolerance: number;
  template: string;
};

export const programNameOf = (design: PartDesign) => `O${String(design.programNumber).padStart(5, "0")}`;

function template(design: PartDesign, title: string, tools: number[]) {
  const { x, y, z } = design.stock;
  const list = tools.map((t) => `(T${t} ${toolByNumber(t)?.name.toUpperCase() ?? ""})`).join("\n");
  return `%
${programNameOf(design)} (${title.toUpperCase()})
(BLANK ${x} X ${y} X ${z} ALUMINIUM, G54 AT THE TOP-FACE CENTRE)
${list}
G00 G17 G21 G40 G49 G80 G90

(YOUR PROGRAM HERE)

G53 G49 Z0.
M30
%`;
}

function task(design: PartDesign, title: string, brief: string[], tools: number[], tolerance = 0.25): TaskLevel {
  return { design, brief, tools, tolerance, template: template(design, title, tools) };
}

const stock = PRACTICE_STOCK;

export const TASKS: Record<string, TaskLevel> = {
  "umc500.task.face": task(
    { name: "Faced blank", programNumber: 3001, stock, features: [{ id: "t-face", kind: "face", face: "top", depth: 1 }] },
    "Face the blank",
    ["Face the whole top 1.0 mm down: Z−1. from part zero.", "Clean the full 80 × 60 mm face — no ridges left."],
    [1],
  ),
  "umc500.task.holes": task(
    {
      name: "Hole pattern",
      programNumber: 3002,
      stock,
      features: [-1, 1].flatMap((sx) =>
        [-1, 1].map((sy) => ({
          id: `t-hole-${sx}${sy}`,
          kind: "hole" as const,
          face: "top" as const,
          center: [25 * sx, 15 * sy] as [number, number],
          diameter: 6.8,
          depth: 12,
        })),
      ),
    },
    "Hole pattern",
    ["Four Ø6.8 holes, 12 mm deep (full diameter).", "Centres at X±25, Y±15 from part zero.", "Spot each hole first."],
    [4, 6],
  ),
  "umc500.task.pocket": task(
    {
      name: "Pocket",
      programNumber: 3003,
      stock,
      features: [{ id: "t-pocket", kind: "pocket-rect", face: "top", center: [0, 0], size: [30, 20], cornerRadius: 5, depth: 6 }],
    },
    "Pocket",
    ["One pocket 30 × 20 mm, R5 corners, 6 mm deep, centred on part zero.", "Floor flat; walls straight."],
    [3],
  ),
  "umc500.task.profile": task(
    {
      name: "Profiled plate",
      programNumber: 3004,
      stock,
      features: [{ id: "t-contour", kind: "contour", face: "top", size: [70, 50], cornerRadius: 6, depth: 12 }],
    },
    "Outside profile",
    ["Profile the outside to 70 × 50 mm with R6 corners, 12 mm deep.", "Use G41 with D02 so the size comes from the offset."],
    [2],
  ),
  "umc500.task.side-slot": task(
    {
      name: "Side slot",
      programNumber: 3005,
      stock,
      features: [{ id: "t-slot", kind: "slot", face: "front", start: [-20, 4], end: [20, 4], width: 6, depth: 3 }],
    },
    "Side slot",
    [
      "A 6 mm slot, 3 mm deep, in the front face: from 20 mm left to 20 mm right of centre, 4 mm above mid-height.",
      "Index the part with B/C so the front face points up, and use G254 to keep part zero on the part.",
    ],
    [3],
  ),
};

/** The machine and job a task starts with: blank clamped, probed, door shut. */
export function prepareTask(level: TaskLevel, program?: string) {
  startAt(readyMachine({ stock: level.design.stock, probed: true }), level.design, program ?? level.template);
}
