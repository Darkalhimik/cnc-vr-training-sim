/**
 * Canned cycles, G12/G13 circular pockets and G70–G72 bolt patterns, as lists
 * of plain steps in absolute program coordinates (mm). The interpreter runs
 * the steps through the same path as any programmed move, so rotation,
 * scaling, work offsets and travel checks all apply to them.
 *
 * Hole sequence (docs/haas-ngc/gcode.md §3.25): rapid to X/Y at the current
 * height, rapid to the R plane, the cycle's own motion, then return to the
 * initial point (G98) or the R plane (G99).
 */
import type { AlarmKey } from "./alarms";
import type { CannedCycle } from "./types";

export type Step =
  /** `scale` multiplies the programmed feed (tap retract J). */
  | { kind: "rapid" | "feed"; x?: number; y?: number; z?: number; scale?: number }
  | { kind: "arc"; x: number; y: number; cx: number; cy: number; ccw: boolean }
  | { kind: "dwell"; seconds: number }
  /** orient: stop and orient (M19); restore: back to the commanded direction;
   *  tap: start in the tapping direction; reverse: opposite of it. */
  | { kind: "spindle"; action: "orient" | "restore" | "tap" | "reverse" }
  /** Program stop for a manual retract (G87/G88). */
  | { kind: "stop" };

export type Fail = (key: AlarmKey, detail: string) => never;

/** Heights of one hole, absolute program Z. */
export type CycleLevels = { initial: number; r: number; bottom: number; retract: number };

export type CycleParams = {
  q?: number;
  i?: number;
  j?: number;
  k?: number;
  /** Dwell at the bottom, seconds. */
  p?: number;
  /** G76/G77: tool shift away from the bore wall, X/Y (Setting 27 direction
   *  times Q, or I/J). */
  shift: [number, number];
  /** G74/G84 J: retract at this multiple of the in-feed. */
  retract?: number;
};

/**
 * Peck bottoms from the R plane down. With I the first peck is I, each next
 * one J shorter, never shorter than K; otherwise every peck is Q.
 */
function pecks(levels: CycleLevels, p: CycleParams, fail: Fail): number[] {
  if (p.i !== undefined && p.q !== undefined) fail("cycleIJKQ", "use Q or I/J/K for the peck, not both");
  for (const [name, v] of [["I", p.i], ["J", p.j], ["K", p.k]] as const) {
    if (v !== undefined && !(v > 0)) fail("cycleIJKQ", `${name} must be positive`);
  }
  const first = p.i ?? p.q;
  if (first === undefined) fail("cycleQ", "the peck depth Q (or I) is missing");
  if (!(first > 0)) fail("cycleQ", "Q must be positive");
  const out: number[] = [];
  let at = levels.r;
  let depth = first;
  while (at > levels.bottom + 1e-9) {
    at = Math.max(levels.bottom, at - depth);
    out.push(at);
    if (p.i !== undefined && p.j !== undefined) depth = Math.max(depth - p.j, p.k ?? p.j);
    if (out.length > 10000) fail("cycleIJKQ", "more than 10000 pecks");
  }
  return out;
}

/** Steps for one hole of a canned cycle at (x, y). */
export function holeSteps(
  code: Exclude<CannedCycle, "G80">,
  x: number,
  y: number,
  levels: CycleLevels,
  p: CycleParams,
  deltaZ: number,
  fail: Fail,
): Step[] {
  const { r, bottom, retract, initial } = levels;
  const dwell = (): Step[] => (p.p ? [{ kind: "dwell", seconds: p.p }] : []);
  const steps: Step[] = [{ kind: "rapid", x, y }];
  const shifted = (sign: number, z?: number): Step => ({ kind: "rapid", x: x + sign * p.shift[0], y: y + sign * p.shift[1], z });
  const centre: Step = { kind: "rapid", x, y };

  if (code === "G77") {
    // Back bore: R is under the part, Z the top of the counterbore. The bar
    // goes in shifted off centre, cuts on the way up, and always returns to
    // the initial point (gcode.md §3.29, recommended order).
    if (bottom < r) fail("cycle", "G77: Z must be above R (R is the start depth under the part)");
    steps.push(
      { kind: "spindle", action: "orient" },
      shifted(-1),
      shifted(-1, r),
      centre,
      { kind: "spindle", action: "restore" },
      { kind: "feed", z: bottom },
      ...dwell(),
      { kind: "spindle", action: "orient" },
      shifted(-1),
      shifted(-1, initial),
      centre,
      { kind: "spindle", action: "restore" },
    );
    return steps;
  }

  if (bottom > r) fail("cycle", "Z is above the R plane");
  steps.push({ kind: "rapid", z: r });
  switch (code) {
    case "G81":
      steps.push({ kind: "feed", z: bottom }, { kind: "rapid", z: retract });
      break;
    case "G82":
      steps.push({ kind: "feed", z: bottom }, ...dwell(), { kind: "rapid", z: retract });
      break;
    case "G73": {
      // Chip-break: back off by Setting 22 between pecks. With Q and K the
      // drill also goes back to R each time the depth reaches another K.
      const every = p.i === undefined ? p.k : undefined;
      if (every !== undefined && !(every > 0)) fail("cycleIJKQ", "K must be positive");
      let nextFull = every !== undefined ? r - every : -Infinity;
      for (const z of pecks(levels, every !== undefined ? { ...p, k: undefined } : p, fail)) {
        steps.push({ kind: "feed", z });
        if (z <= bottom) break;
        if (every !== undefined && z <= nextFull + 1e-9) {
          steps.push({ kind: "rapid", z: r }, { kind: "rapid", z: z + deltaZ });
          while (nextFull >= z - 1e-9) nextFull -= every;
        } else steps.push({ kind: "rapid", z: z + deltaZ });
      }
      steps.push(...dwell(), { kind: "rapid", z: retract });
      break;
    }
    case "G83": {
      // Full retract to R after each peck, then rapid back down to Setting 22
      // above the last peck bottom.
      let previous: number | null = null;
      for (const z of pecks(levels, p, fail)) {
        if (previous !== null) steps.push({ kind: "rapid", z: Math.min(r, previous + deltaZ) });
        steps.push({ kind: "feed", z });
        if (z > bottom) steps.push({ kind: "rapid", z: r });
        previous = z;
      }
      steps.push(...dwell(), { kind: "rapid", z: retract });
      break;
    }
    case "G74":
    case "G84":
      // Rigid tap: the cycle runs the spindle itself, reverses at the bottom
      // and feeds out at J times the in-feed; G98 then rapids to the initial point.
      steps.push(
        { kind: "spindle", action: "tap" },
        { kind: "feed", z: bottom },
        ...dwell(),
        { kind: "spindle", action: "reverse" },
        { kind: "feed", z: r, scale: p.retract && p.retract > 1 ? p.retract : undefined },
        { kind: "spindle", action: "tap" },
      );
      if (retract !== r) steps.push({ kind: "rapid", z: retract });
      break;
    case "G76":
      steps.push(
        { kind: "feed", z: bottom },
        ...dwell(),
        { kind: "spindle", action: "orient" },
        shifted(1),
        shifted(1, retract),
        centre,
        { kind: "spindle", action: "restore" },
      );
      break;
    case "G85":
    case "G89":
      steps.push({ kind: "feed", z: bottom }, ...(code === "G89" ? dwell() : []), { kind: "feed", z: r });
      if (retract !== r) steps.push({ kind: "rapid", z: retract });
      break;
    case "G86":
      steps.push(
        { kind: "feed", z: bottom },
        { kind: "spindle", action: "orient" },
        { kind: "rapid", z: retract },
        { kind: "spindle", action: "restore" },
      );
      break;
    case "G87":
    case "G88":
      // Classic Haas: stop at the bottom for the operator to jog the tool
      // out; the jog is shown as a rapid to the return level after the stop.
      steps.push(
        { kind: "feed", z: bottom },
        ...(code === "G88" ? dwell() : []),
        { kind: "spindle", action: "orient" },
        { kind: "stop" },
        { kind: "rapid", z: retract },
        { kind: "spindle", action: "restore" },
      );
      break;
  }
  return steps;
}

/**
 * G12 (CW, implied G42) / G13 (CCW, implied G41) circular pocket around the
 * current X/Y. Each ring is the programmed radius less the tool radius. Per
 * pass: feed to depth at the centre, a half-circle lead-in to the first ring,
 * a full circle, a straight step-over by Q to each next ring up to K, and a
 * half-circle lead-out back to the centre, where the tool stays at depth.
 * L repeats the pass, stepping Z each time in G91. The lead-in/out geometry
 * is not documented by Haas; this is the usual tangent half-circle.
 */
export function pocketSteps(
  center: [number, number],
  z0: number,
  w: { i: number; k?: number; q?: number; z?: number; loops: number; incremental: boolean; toolRadius: number; ccw: boolean },
  fail: Fail,
): Step[] {
  const [cx, cy] = center;
  if (!(w.i > 0)) fail("pocketIJK", "I (first radius) must be positive");
  const radii = [w.i];
  if (w.k !== undefined) {
    if (w.k < w.i) fail("pocketIJK", "K (finish radius) must not be smaller than I");
    if (w.k > w.i) {
      if (!(w.q !== undefined && w.q > 0)) fail("pocketIJK", "Q (step-over) must be positive when K is given");
      for (let r = w.i + w.q; r < w.k - 1e-9; r += w.q) radii.push(r);
      radii.push(w.k);
    }
  }
  const rings = radii.map((r) => r - w.toolRadius);
  if (rings[0] <= 1e-6) fail("pocketIJK", `I ${w.i.toFixed(3)} must be larger than the tool radius ${w.toolRadius.toFixed(3)}`);

  const steps: Step[] = [];
  for (let pass = 1; pass <= w.loops; pass++) {
    if (w.z !== undefined) steps.push({ kind: "feed", z: w.incremental ? z0 + w.z * pass : w.z });
    const first = rings[0];
    steps.push({ kind: "arc", x: cx + first, y: cy, cx: cx + first / 2, cy, ccw: w.ccw });
    rings.forEach((ring, index) => {
      if (index > 0) steps.push({ kind: "feed", x: cx + ring, y: cy });
      steps.push({ kind: "arc", x: cx + ring, y: cy, cx, cy, ccw: w.ccw });
    });
    const last = rings[rings.length - 1];
    steps.push({ kind: "arc", x: cx, y: cy, cx: cx + last / 2, cy, ccw: w.ccw });
  }
  return steps;
}

/**
 * Hole positions of a bolt pattern from the current X/Y (gcode.md §3.24):
 * - G70 circle round the current point: I radius, J start angle, L holes
 *   evenly spaced;
 * - G71 arc: I radius, J start angle, K angle between holes, L holes;
 * - G72 line: the first hole at the current point, then L-1 more, I apart
 *   at angle J.
 * Angles are CCW from 3 o'clock.
 */
export function boltHoles(
  code: 70 | 71 | 72,
  start: [number, number],
  w: { i: number; j: number; k: number; l: number },
): [number, number][] {
  const RAD = Math.PI / 180;
  const holes: [number, number][] = [];
  for (let n = 0; n < w.l; n++) {
    if (code === 72) {
      holes.push([start[0] + w.i * n * Math.cos(w.j * RAD), start[1] + w.i * n * Math.sin(w.j * RAD)]);
    } else {
      const a = (w.j + (code === 70 ? (360 * n) / w.l : w.k * n)) * RAD;
      holes.push([start[0] + w.i * Math.cos(a), start[1] + w.i * Math.sin(a)]);
    }
  }
  return holes;
}
