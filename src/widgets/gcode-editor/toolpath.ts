/**
 * The interpreted program as line segments in the part frame, for the
 * backplot: where each real tool tip goes, relative to the stock, whatever
 * the trunnion does. Pure.
 *
 * Part frame: millimetres, origin at the top-face centre of the stock (G54 as
 * the design defines it), axes those of the table at B = C = 0. Points are
 * written in three.js order — x, z, −y — so Z is up on screen.
 */
import { toolInStock, type MachinePosition } from "@/entities/machine/kinematics";
import { AXES } from "@/entities/machine/machine-types";
import type { NcResult } from "@/entities/nc";
import type { Stock } from "@/entities/part/part-design";
import { toolByNumber } from "@/entities/part/tool-library";

/** Largest rotary step drawn as one straight segment, degrees: a B/C move
 *  without TCPC is a curve relative to the part. */
const ROTARY_STEP_DEG = 2;

export type SegmentSet = {
  /** Two points (six floats) per segment. */
  positions: Float32Array;
  /** Source line of each segment. */
  lines: Int32Array;
  /** O-number of each segment's subprogram; undefined for the main program. */
  programs: (string | undefined)[];
};

export type Toolpath = {
  rapids: SegmentSet;
  /** Feed moves, one set per tool, in the order the tools are first used. */
  feeds: { tool: number; set: SegmentSet }[];
};

type Builder = { positions: number[]; lines: number[]; programs: (string | undefined)[] };

const builder = (): Builder => ({ positions: [], lines: [], programs: [] });
const finish = (b: Builder): SegmentSet => ({
  positions: new Float32Array(b.positions),
  lines: new Int32Array(b.lines),
  programs: b.programs,
});

/** The tool tip at a machine position, in three.js part-frame order. */
function tipAt(p: MachinePosition, length: number, stockZ: number): [number, number, number] {
  const [x, y, z] = toolInStock(p, length).tip;
  return [x, z - stockZ, -y];
}

/**
 * `startTool` is in the spindle before the first M06 (0 = none: the gauge
 * line is drawn). Tool lengths are the real tools', not the offsets — the
 * backplot shows where the cutting edge goes, which is what crashes.
 */
export function buildToolpath(result: NcResult, stock: Stock, startTool: number): Toolpath {
  const rapids = builder();
  const feeds = new Map<number, Builder>();
  let tool = startTool;
  let length = toolByNumber(tool)?.length ?? 0;

  for (const m of result.motions) {
    if (m.kind === "toolChange") {
      tool = m.tool;
      length = toolByNumber(tool)?.length ?? 0;
      continue;
    }
    if (m.kind !== "rapid" && m.kind !== "feed") continue;
    let target = rapids;
    if (m.kind === "feed") {
      target = feeds.get(tool) ?? builder();
      feeds.set(tool, target);
    }
    const rotary = Math.max(Math.abs(m.to.b - m.from.b), Math.abs(m.to.c - m.from.c));
    const n = m.tcp ? 1 : Math.max(1, Math.ceil(rotary / ROTARY_STEP_DEG));
    let prev = tipAt(m.from, length, stock.z);
    for (let k = 1; k <= n; k++) {
      const p = {} as MachinePosition;
      for (const a of AXES) p[a] = m.from[a] + ((m.to[a] - m.from[a]) * k) / n;
      const next = tipAt(p, length, stock.z);
      target.positions.push(...prev, ...next);
      target.lines.push(m.line);
      target.programs.push(m.program);
      prev = next;
    }
  }

  return {
    rapids: finish(rapids),
    feeds: [...feeds.entries()].map(([t, b]) => ({ tool: t, set: finish(b) })),
  };
}

/** The segments of `set` that come from `line` of the main program, as positions. */
export function segmentsOnLine(set: SegmentSet, line: number): number[] {
  const out: number[] = [];
  for (let s = 0; s < set.lines.length; s++) {
    if (set.lines[s] !== line || set.programs[s] !== undefined) continue;
    for (let k = 0; k < 6; k++) out.push(set.positions[s * 6 + k]);
  }
  return out;
}
