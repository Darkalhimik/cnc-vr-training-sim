/**
 * Plays an interpreted program in time: where the axes are after `dt`, what
 * happened on the way (spindle, coolant, tool change, stops), and which
 * positions the tool swept through — for the material-removal engine.
 *
 * Pure, like the reducer: the scene feeds it frame time, a test feeds it
 * whatever it likes. Feed hold is the caller simply not advancing it.
 */
import type { Motion, NcResult } from "@/entities/nc/types";
import { AXES, type Axis } from "./machine-types";
import type { MachinePosition } from "./kinematics";

export type Overrides = {
  /** Feed override, percent. */
  feed: number;
  /** Rapid override, percent: 5, 25, 50 or 100. */
  rapid: number;
};

export type PlaybackCursor = {
  /** Index into `motions` of the motion in progress. */
  index: number;
  /** Seconds already spent in it, at the override in force when spent. */
  elapsed: number;
};

export type PlaybackOptions = {
  overrides: Overrides;
  singleBlock: boolean;
  optionalStop: boolean;
  /** Largest gap between swept samples: linear mm and rotary degrees. */
  sampleMm?: number;
  sampleDeg?: number;
};

export type SweptSample = { position: MachinePosition; rapid: boolean };

export type Halt = "stop" | "optionalStop" | "singleBlock" | "end";

export type PlaybackStep = {
  cursor: PlaybackCursor;
  position: MachinePosition;
  /** Instant motions crossed this step, in order; a tool change is reported
   *  when it completes. */
  events: Motion[];
  samples: SweptSample[];
  /** Source of the motion the cursor is in (or just finished). */
  line: number;
  program?: string;
  /** Its executed-block counter, for the active codes (codesAt). */
  block: number;
  halt: Halt | null;
};

export const startCursor: PlaybackCursor = { index: 0, elapsed: 0 };

type Timed = Extract<Motion, { kind: "rapid" | "feed" | "dwell" | "toolChange" }>;

const isTimed = (m: Motion): m is Timed =>
  m.kind === "rapid" || m.kind === "feed" || m.kind === "dwell" || m.kind === "toolChange";

/** Single block stops after motion `i` when the next belongs to another block. */
function endsBlock(motions: Motion[], i: number): boolean {
  const next = motions[i + 1];
  return next !== undefined && next.block !== motions[i].block;
}

/** How long a motion takes at the given overrides. */
function durationOf(m: Timed, o: Overrides): number {
  if (m.kind === "feed") return (m.seconds * 100) / Math.max(1, o.feed);
  if (m.kind === "rapid") return (m.seconds * 100) / Math.max(1, o.rapid);
  return m.seconds;
}

function lerp(from: MachinePosition, to: MachinePosition, t: number): MachinePosition {
  const p = {} as MachinePosition;
  for (const a of AXES) p[a] = from[a] + (to[a] - from[a]) * t;
  return p;
}

/** Samples along a move between fractions t0 and t1, excluding t0. */
function sweep(
  m: Extract<Motion, { kind: "rapid" | "feed" }>,
  t0: number,
  t1: number,
  sampleMm: number,
  sampleDeg: number,
): SweptSample[] {
  const d = (a: Axis) => Math.abs(m.to[a] - m.from[a]) * (t1 - t0);
  const linear = Math.hypot(d("x"), d("y"), d("z"));
  const rotary = Math.max(d("b"), d("c"));
  const n = Math.max(1, Math.ceil(Math.max(linear / sampleMm, rotary / sampleDeg)));
  const out: SweptSample[] = [];
  for (let k = 1; k <= n; k++) {
    out.push({ position: lerp(m.from, m.to, t0 + ((t1 - t0) * k) / n), rapid: m.kind === "rapid" });
  }
  return out;
}

/**
 * Advance the program by `dt` seconds from `cursor`, starting at `position`
 * (where the axes are now). Stops early at a halt.
 */
export function advance(
  result: NcResult,
  cursor: PlaybackCursor,
  position: MachinePosition,
  dt: number,
  options: PlaybackOptions,
): PlaybackStep {
  const { motions } = result;
  const sampleMm = options.sampleMm ?? 0.5;
  const sampleDeg = options.sampleDeg ?? 1;
  let { index, elapsed } = cursor;
  let budget = dt;
  let pos = position;
  const events: Motion[] = [];
  const samples: SweptSample[] = [];
  let halt: Halt | null = null;
  let source: Motion | undefined = motions[Math.min(index, motions.length - 1)];

  while (index < motions.length && halt === null) {
    const m = motions[index];
    source = m;

    if (!isTimed(m)) {
      events.push(m);
      index += 1;
      elapsed = 0;
      if (m.kind === "end") halt = "end";
      else if (m.kind === "stop") {
        if (!m.optional) halt = "stop";
        else if (options.optionalStop) halt = "optionalStop";
      }
      // A block with no motion (S1000 M03, G10…) is a block too.
      if (halt === null && options.singleBlock && endsBlock(motions, index - 1)) halt = "singleBlock";
      continue;
    }

    if (budget <= 0) break;
    const duration = durationOf(m, options.overrides);
    const t0 = duration > 0 ? elapsed / duration : 1;
    const remaining = duration - elapsed;

    if (budget >= remaining) {
      budget -= Math.max(0, remaining);
      if (m.kind === "rapid" || m.kind === "feed") {
        samples.push(...sweep(m, t0, 1, sampleMm, sampleDeg));
        pos = m.to;
      }
      if (m.kind === "toolChange") events.push(m);
      index += 1;
      elapsed = 0;
      if (options.singleBlock && endsBlock(motions, index - 1)) halt = "singleBlock";
    } else {
      elapsed += budget;
      if (m.kind === "rapid" || m.kind === "feed") {
        const t1 = elapsed / duration;
        samples.push(...sweep(m, t0, t1, sampleMm, sampleDeg));
        pos = lerp(m.from, m.to, t1);
      }
      budget = 0;
    }
  }

  // Ran off the end without M30: the interpreter stopped early (an alarm).
  if (index >= motions.length && halt === null) halt = "end";

  return {
    cursor: { index, elapsed },
    position: pos,
    events,
    samples,
    line: source?.line ?? 0,
    program: source?.program,
    block: source?.block ?? 0,
    halt,
  };
}

/** The diagnostic that stopped the program, if it stopped on an alarm. */
export function stoppingAlarm(result: NcResult) {
  return result.diagnostics.find((d) => d.severity === "alarm") ?? null;
}
