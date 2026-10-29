/**
 * Sweeping a cutter through the stock: stock = max(stock, −flutes) everywhere
 * the flutes pass.
 *
 * The path is split into straight runs — consecutive poses on one line with
 * one tool axis. Nearly every run in a program moves either across the axis
 * (all 3-axis and 3+2 feed moves) or along it (plunges, retracts, drilling),
 * and both have exact swept volumes, so each sample a run passes is visited
 * once:
 * - across: a revolved convex profile only grows with r at any height, so the
 *   closest the moving cutter comes to a sample is the profile at the sample's
 *   height, at its distance from the swept axis segment;
 * - along: the cutter at the lower end, with flutes lengthened by the move.
 * Anything else (a tilting axis, a ramp) is cut as stamps placed so no cutting
 * point travels more than half a voxel between them, which leaves cusps of
 * step²/8R — microns.
 *
 * Either way only the samples within the band of the flutes are visited, row
 * by row, so the cost follows the tool's volume, not its bounding box.
 *
 * Shank and holder are checked at every stamp position (half a voxel apart)
 * against the material left at that moment, and count as touching within half
 * a voxel. That is what makes a shank as wide as the flutes rub the wall of
 * its own hole once it plunges past the flute length, however the plunge is
 * fed, while a necked shank slides down the hole freely.
 *
 * Pure: runs in the worker and in Node.
 */
import { BAND, FILL, STEPS, markDirty, type Grid } from "./grid";
import { POSE_STRIDE } from "./protocol";
import { fluteDistance, withFlute, type Tool } from "./tool";
import type { CutReport } from "./types";

/** Largest movement of any cutting point between two stamps, in voxels. */
const STAMP_STEP = 0.5;
/** Contact tolerance for shank and holder, in voxels. */
const CONTACT = 0.5;
/** Axes this close (cos of ~0.001°) are one axis. */
const SAME_AXIS = 1 - 1e-10;
/** Guards against a runaway move (a bad coordinate) freezing the worker. */
const MAX_STAMPS_PER_MOVE = 200_000;

// Interval results, kept outside so the row loops allocate nothing.
let spanLo = 0;
let spanHi = 0;
let boxLo = 0;
let boxHi = 0;

/**
 * Where a row of samples along X crosses a cylinder about the tool axis: the
 * x offsets from the tip with r ≤ rho and a0 ≤ a ≤ a1. `aRow` and `wRow` are
 * the row's axial coordinate and squared distance from the tip at x = 0.
 */
function rowSpan(ax: number, aRow: number, wRow: number, rho: number, a0: number, a1: number): boolean {
  let lo = -Infinity;
  let hi = Infinity;
  if (ax > 1e-12 || ax < -1e-12) {
    const s0 = (a0 - aRow) / ax;
    const s1 = (a1 - aRow) / ax;
    lo = s0 < s1 ? s0 : s1;
    hi = s0 < s1 ? s1 : s0;
  } else if (aRow < a0 || aRow > a1) {
    return false;
  }
  // r²(x) = x² + wRow − (aRow + ax·x)² ≤ rho²
  const qa = 1 - ax * ax;
  const qc = wRow - aRow * aRow - rho * rho;
  if (qa > 1e-12) {
    const qb = -2 * ax * aRow;
    const disc = qb * qb - 4 * qa * qc;
    if (disc < 0) return false;
    const root = Math.sqrt(disc);
    const r0 = (-qb - root) / (2 * qa);
    const r1 = (-qb + root) / (2 * qa);
    if (r0 > lo) lo = r0;
    if (r1 < hi) hi = r1;
  } else if (qc > 0) {
    return false;
  }
  if (lo > hi) return false;
  spanLo = lo;
  spanHi = hi;
  return true;
}

/** Narrows [boxLo, boxHi] to the x offsets with lo ≤ c0 + c1·x ≤ hi. */
function slab(c0: number, c1: number, lo: number, hi: number): boolean {
  if (c1 > 1e-12 || c1 < -1e-12) {
    const s0 = (lo - c0) / c1;
    const s1 = (hi - c0) / c1;
    if (s0 < s1) {
      if (s0 > boxLo) boxLo = s0;
      if (s1 < boxHi) boxHi = s1;
    } else {
      if (s1 > boxLo) boxLo = s1;
      if (s0 < boxHi) boxHi = s0;
    }
  } else if (c0 < lo || c0 > hi) {
    return false;
  }
  return boxLo <= boxHi;
}

/** Sample index range along one axis covered by a cylinder's bounding box. */
function axisRange(g: Grid, d: 0 | 1 | 2, tip: number, axis: number, rho: number, a0: number, a1: number, skin: number) {
  const e0 = tip + a0 * axis;
  const e1 = tip + a1 * axis;
  const ext = rho * Math.sqrt(Math.max(0, 1 - axis * axis));
  const from = Math.ceil(((e0 < e1 ? e0 : e1) - ext - g.origin[d]) / g.voxel);
  const to = Math.floor(((e0 < e1 ? e1 : e0) + ext - g.origin[d]) / g.voxel);
  return [Math.max(skin, from), Math.min(g.dims[d] - 1 - skin, to)] as const;
}

/**
 * Subtracts the flutes moved from tip t straight across axis u by r (r ⊥ u;
 * zero for a single stamp). Returns the material removed, mm³.
 */
function carve(
  g: Grid,
  tool: Tool,
  tx: number,
  ty: number,
  tz: number,
  ux: number,
  uy: number,
  uz: number,
  rx: number,
  ry: number,
  rz: number,
): number {
  const h = g.voxel;
  const data = g.data;
  const [nx, ny] = g.dims;
  const [ox, oy, oz] = g.origin;
  // Farther than the band from the flutes, max(stock, −flutes) cannot change
  // a sample, so only the swept flutes grown by the band are visited. The air
  // skin (index 0 and n − 1) is never touched.
  const margin = ((BAND + 1) / STEPS) * h;
  const rho = tool.radius + margin;
  const a0 = -margin;
  const a1 = tool.flute + margin;
  const len2 = rx * rx + ry * ry + rz * rz;
  const moves = len2 > 0;
  const len = Math.sqrt(len2);
  // Swept box frame: u, e along the move, f across both.
  const ex = moves ? rx / len : 0;
  const ey = moves ? ry / len : 0;
  const ez = moves ? rz / len : 0;
  const fx = uy * ez - uz * ey;
  const fy = uz * ex - ux * ez;
  const fz = ux * ey - uy * ex;

  const ks = axisRange(g, 2, tz, uz, rho, a0, a1, 1);
  const ke = axisRange(g, 2, tz + rz, uz, rho, a0, a1, 1);
  const js = axisRange(g, 1, ty, uy, rho, a0, a1, 1);
  const je = axisRange(g, 1, ty + ry, uy, rho, a0, a1, 1);
  const k0 = Math.min(ks[0], ke[0]);
  const k1 = Math.max(ks[1], ke[1]);
  const j0 = Math.min(js[0], je[0]);
  const j1 = Math.max(js[1], je[1]);
  if (k0 > k1 || j0 > j1) return 0;
  const toSteps = STEPS / h;
  const sx = moves ? rx / len2 : 0;

  let removed = 0;
  let ci0 = nx;
  let ci1 = -1;
  let cj0 = ny;
  let cj1 = -1;
  let ck0 = 0;
  let ck1 = -1;
  for (let k = k0; k <= k1; k++) {
    const dz = oz + k * h - tz;
    for (let j = j0; j <= j1; j++) {
      const dy = oy + j * h - ty;
      const aRow = uy * dy + uz * dz;
      const wRow = dy * dy + dz * dz;
      // The swept flutes are the cylinder at each end plus the box between;
      // their union is convex, so the row's span is the hull of the three.
      let lo = Infinity;
      let hi = -Infinity;
      if (rowSpan(ux, aRow, wRow, rho, a0, a1)) {
        lo = spanLo;
        hi = spanHi;
      }
      let sRow = 0;
      if (moves) {
        const ey0 = dy - ry;
        const ez0 = dz - rz;
        if (rowSpan(ux, uy * ey0 + uz * ez0, ey0 * ey0 + ez0 * ez0, rho, a0, a1)) {
          if (spanLo + rx < lo) lo = spanLo + rx;
          if (spanHi + rx > hi) hi = spanHi + rx;
        }
        boxLo = -Infinity;
        boxHi = Infinity;
        if (slab(aRow, ux, a0, a1) && slab(ey * dy + ez * dz, ex, 0, len) && slab(fy * dy + fz * dz, fx, -rho, rho)) {
          if (boxLo < lo) lo = boxLo;
          if (boxHi > hi) hi = boxHi;
        }
        sRow = (ry * dy + rz * dz) / len2;
      }
      if (lo > hi) continue;
      const i0 = Math.max(1, Math.ceil((tx + lo - ox) / h));
      const i1 = Math.min(nx - 2, Math.floor((tx + hi - ox) / h));
      let first = -1;
      let last = -1;
      let index = i0 + nx * (j + ny * k);
      for (let i = i0; i <= i1; i++, index++) {
        const old = data[index];
        if (old === BAND) continue; // already air, far from any surface
        const dx = ox + i * h - tx;
        const a = aRow + ux * dx;
        // Squared distance from the swept axis segment: from the axis line,
        // plus the overshoot past either end of the move.
        const along = sRow + sx * dx;
        const s = along < 0 ? 0 : along > 1 ? 1 : along;
        const r2 = dx * dx + wRow - a * a - len2 * s * (2 * along - s);
        let q = Math.round(-fluteDistance(tool, r2 > 0 ? Math.sqrt(r2) : 0, a) * toSteps);
        if (q <= old) continue;
        if (q > BAND) q = BAND;
        data[index] = q;
        removed += FILL[old + 128] - FILL[q + 128];
        if (first < 0) first = i;
        last = i;
      }
      if (first >= 0) {
        if (first < ci0) ci0 = first;
        if (last > ci1) ci1 = last;
        if (j < cj0) cj0 = j;
        if (j > cj1) cj1 = j;
        if (ck1 < 0) ck0 = k;
        ck1 = k;
      }
    }
  }
  if (ci1 >= 0) markDirty(g, ci0, ci1, cj0, cj1, ck0, ck1);
  return removed * h * h * h;
}

/** Whether any material sample lies within a cylinder about the tool axis. */
function touches(
  g: Grid,
  tx: number,
  ty: number,
  tz: number,
  ax: number,
  ay: number,
  az: number,
  rho: number,
  a0: number,
  a1: number,
): boolean {
  if (a1 <= a0 || rho <= 0) return false;
  const h = g.voxel;
  const data = g.data;
  const [nx, ny] = g.dims;
  const [ox, oy, oz] = g.origin;
  const [k0, k1] = axisRange(g, 2, tz, az, rho, a0, a1, 0);
  const [j0, j1] = axisRange(g, 1, ty, ay, rho, a0, a1, 0);
  for (let k = k0; k <= k1; k++) {
    const dz = oz + k * h - tz;
    for (let j = j0; j <= j1; j++) {
      const dy = oy + j * h - ty;
      if (!rowSpan(ax, ay * dy + az * dz, dy * dy + dz * dz, rho, a0, a1)) continue;
      const i0 = Math.max(0, Math.ceil((tx + spanLo - ox) / h));
      const i1 = Math.min(nx - 1, Math.floor((tx + spanHi - ox) / h));
      const row = nx * (j + ny * k);
      for (let i = i0; i <= i1; i++) if (data[row + i] < 0) return true;
    }
  }
  return false;
}

function contact(g: Grid, tool: Tool, tx: number, ty: number, tz: number, ax: number, ay: number, az: number) {
  const slack = CONTACT * g.voxel;
  if (touches(g, tx, ty, tz, ax, ay, az, tool.holderRadius + slack, tool.stickout, tool.holderTop)) return "holder";
  if (touches(g, tx, ty, tz, ax, ay, az, tool.shankRadius + slack, tool.flute, tool.stickout)) return "shank";
  return null;
}

/**
 * Cuts a tool path given as packed poses (POSE_STRIDE floats each). Tip and
 * axis are interpolated linearly between poses; the axis is renormalised, and
 * a zero axis keeps the previous one. A collision's poseIndex is the pose
 * being moved to when it happened (0 if the tool already touches at the first
 * pose); cutting carries on regardless.
 */
export function cutPath(g: Grid, tool: Tool, poses: Float64Array): CutReport {
  const count = Math.floor(poses.length / POSE_STRIDE);
  for (let n = 0; n < count * POSE_STRIDE; n++) {
    if (!Number.isFinite(poses[n])) throw new Error(`Pose ${Math.floor(n / POSE_STRIDE)} has a non-finite coordinate`);
  }
  if (count === 0) return { removedMm3: 0, collision: null };

  const tips = new Float64Array(count * 3);
  const axes = new Float64Array(count * 3);
  let fx = 0;
  let fy = 0;
  let fz = 1;
  for (let p = 0; p < count; p++) {
    const o = p * POSE_STRIDE;
    const [x, y, z] = [poses[o + 3], poses[o + 4], poses[o + 5]];
    const len = Math.sqrt(x * x + y * y + z * z);
    if (len > 1e-9) [fx, fy, fz] = [x / len, y / len, z / len];
    tips.set(poses.subarray(o, o + 3), 3 * p);
    axes.set([fx, fy, fz], 3 * p);
  }
  const axisDot = (p: number, q: number) =>
    axes[3 * p] * axes[3 * q] + axes[3 * p + 1] * axes[3 * q + 1] + axes[3 * p + 2] * axes[3 * q + 2];
  // Below this, a deviation is smaller than the field can store.
  const quantum = g.voxel / STEPS;
  const step = STAMP_STEP * g.voxel;

  let removed = 0;
  let collision: CutReport["collision"] = null;
  const touch = (tx: number, ty: number, tz: number, ax: number, ay: number, az: number, pose: number) => {
    if (collision !== null) return;
    const kind = contact(g, tool, tx, ty, tz, ax, ay, az);
    if (kind) collision = { kind, poseIndex: pose };
  };

  /** Sub-poses of move p − 1 → p, excluding its start. */
  const walk = (p: number, visit: (tx: number, ty: number, tz: number, ax: number, ay: number, az: number) => void) => {
    const a = 3 * (p - 1);
    const b = 3 * p;
    const travel = Math.hypot(tips[b] - tips[a], tips[b + 1] - tips[a + 1], tips[b + 2] - tips[a + 2]);
    const tilt = Math.acos(Math.min(1, Math.max(-1, axisDot(p - 1, p))));
    const stamps = Math.min(MAX_STAMPS_PER_MOVE, Math.max(1, Math.ceil((travel + tool.reach * tilt) / step)));
    for (let s = 1; s <= stamps; s++) {
      const t = s / stamps;
      let ax = axes[a] + (axes[b] - axes[a]) * t;
      let ay = axes[a + 1] + (axes[b + 1] - axes[a + 1]) * t;
      let az = axes[a + 2] + (axes[b + 2] - axes[a + 2]) * t;
      const len = Math.sqrt(ax * ax + ay * ay + az * az);
      if (len > 1e-9) {
        ax /= len;
        ay /= len;
        az /= len;
      } else {
        [ax, ay, az] = [axes[a], axes[a + 1], axes[a + 2]];
      }
      visit(
        tips[a] + (tips[b] - tips[a]) * t,
        tips[a + 1] + (tips[b + 1] - tips[a + 1]) * t,
        tips[a + 2] + (tips[b + 2] - tips[a + 2]) * t,
        ax,
        ay,
        az,
      );
    }
  };

  /** Last pose of the straight, single-axis run that starts at pose i. */
  const runEnd = (i: number) => {
    if (axisDot(i, i + 1) < SAME_AXIS) return i + 1;
    const a = 3 * i;
    const dx = tips[a + 3] - tips[a];
    const dy = tips[a + 4] - tips[a + 1];
    const dz = tips[a + 5] - tips[a + 2];
    const len = Math.hypot(dx, dy, dz);
    if (len <= quantum) return i + 1;
    let reach = len;
    let j = i + 1;
    while (j + 1 < count && axisDot(i, j + 1) >= SAME_AXIS) {
      const b = 3 * (j + 1);
      const wx = tips[b] - tips[a];
      const wy = tips[b + 1] - tips[a + 1];
      const wz = tips[b + 2] - tips[a + 2];
      const along = (wx * dx + wy * dy + wz * dz) / len;
      if (along < reach - quantum) break; // turns back
      if (wx * wx + wy * wy + wz * wz - along * along > quantum * quantum) break; // leaves the line
      if (along > reach) reach = along;
      j++;
    }
    return j;
  };

  const t0 = [tips[0], tips[1], tips[2]] as const;
  const u0 = [axes[0], axes[1], axes[2]] as const;
  // The first pose on its own: a cut may start inside material.
  touch(...t0, ...u0, 0);
  removed += carve(g, tool, ...t0, ...u0, 0, 0, 0);

  for (let i = 0; i < count - 1; ) {
    const j = runEnd(i);
    const a = 3 * i;
    const b = 3 * j;
    const [ux, uy, uz] = [axes[a], axes[a + 1], axes[a + 2]];
    const dx = tips[b] - tips[a];
    const dy = tips[b + 1] - tips[a + 1];
    const dz = tips[b + 2] - tips[a + 2];
    const da = dx * ux + dy * uy + dz * uz;
    const [rx, ry, rz] = [dx - da * ux, dy - da * uy, dz - da * uz];
    const across = Math.abs(da) <= quantum;
    const along = Math.hypot(rx, ry, rz) <= quantum;

    if (axisDot(i, j) >= SAME_AXIS && (across || along)) {
      if (!along) {
        // Across the axis no point changes height on the tool, so the flutes
        // never clear what the shank reaches later in the run: the material
        // before the run is exactly what the shank meets.
        if (collision === null) for (let p = i + 1; p <= j; p++) walk(p, (...pose) => touch(...pose, p));
        removed += carve(g, tool, tips[a], tips[a + 1], tips[a + 2], ux, uy, uz, rx, ry, rz);
      } else if (!across) {
        // On a plunge the flutes do clear the shank's way, so the material
        // before the run only screens for contact (a necked tool would be a
        // false alarm); on a hit, the plunge is replayed step by step.
        let suspect = false;
        for (let p = i + 1; p <= j && collision === null && !suspect; p++) {
          walk(p, (...pose) => {
            suspect ||= contact(g, tool, ...pose) !== null;
          });
        }
        if (!suspect) {
          const low = da < 0 ? b : a;
          const long = withFlute(tool, tool.flute + Math.abs(da));
          removed += carve(g, long, tips[low], tips[low + 1], tips[low + 2], ux, uy, uz, 0, 0, 0);
        } else {
          let [px, py, pz] = [tips[a], tips[a + 1], tips[a + 2]];
          for (let p = i + 1; p <= j; p++) {
            walk(p, (tx, ty, tz) => {
              touch(tx, ty, tz, ux, uy, uz, p);
              const rise = (tx - px) * ux + (ty - py) * uy + (tz - pz) * uz;
              const [lx, ly, lz] = rise < 0 ? [tx, ty, tz] : [px, py, pz];
              removed += carve(g, withFlute(tool, tool.flute + Math.abs(rise)), lx, ly, lz, ux, uy, uz, 0, 0, 0);
              [px, py, pz] = [tx, ty, tz];
            });
          }
        }
      } else if (collision === null) {
        // The tool stays put; where it is was cut by the last run.
        for (let p = i + 1; p <= j; p++) walk(p, (...pose) => touch(...pose, p));
      }
    } else {
      for (let p = i + 1; p <= j; p++) {
        walk(p, (tx, ty, tz, ax, ay, az) => {
          touch(tx, ty, tz, ax, ay, az, p);
          removed += carve(g, tool, tx, ty, tz, ax, ay, az, 0, 0, 0);
        });
      }
    }
    i = j;
  }
  return { removedMm3: removed, collision };
}
