/**
 * Feature-based CAM: turns a PartDesign into a Haas NGC program.
 *
 * The output is written the way a Haas-trained programmer (or a Haas post)
 * would: one tool per operation group, G43 H on the first Z move, canned
 * cycles for holes on the top face, G41 cutter compensation on the outside
 * contour, and 3+2 indexing for the side faces — retract to machine Z home,
 * position B/C, then G254 (dynamic work offset) so the side features are
 * programmed in the same part frame as the top. G254 is cancelled with G255
 * before every re-index, as the UMC supplement requires.
 *
 * Shapes here are rectangles, circles and slots, so their offsets are
 * computed directly rather than with a general polygon library.
 */
import { anglesFacingUp } from "@/entities/machine/kinematics";
import {
  FACES,
  FACE_LABEL,
  type Face,
  type Feature,
  type PartDesign,
  type Vec3,
  facePoint,
  faceFrame,
  faceSize,
  validateDesign,
} from "./part-design";
import { MATERIALS, TOOL_LIBRARY, cuttingData, type LibraryTool } from "./tool-library";

/** Clearance above the face for rapids, and the plane rapids return to. */
const CLEARANCE = 25;
/** Rapid down to this far above the material before feeding. */
const R_PLANE = 2;

export type Operation = {
  face: Face;
  featureId: string;
  label: string;
  tool: LibraryTool;
};

export type CamResult = {
  text: string;
  operations: Operation[];
  /** Why a feature was left out, or anything else the trainee should know. */
  warnings: string[];
};

const fmt = (n: number) => {
  const s = (Math.round(n * 1000) / 1000).toFixed(3).replace(/0+$/, "");
  return s === "-0." ? "0." : s;
};

/** Writes G-code words, skipping axes that did not change. */
class Writer {
  lines: string[] = [];
  private last: Partial<Record<string, number>> = {};

  raw(line: string) {
    this.lines.push(line);
  }

  /** Controls take plain ASCII comments without nested parentheses. */
  comment(text: string) {
    const ascii = text
      .replace(/°/g, " DEG")
      .replace(/Ø/g, "DIA ")
      .replace(/[^ -~]/g, "")
      .replace(/[()]/g, "");
    this.lines.push(`(${ascii.toUpperCase()})`);
  }

  /** A motion block. `force` writes every given axis even if unchanged. */
  move(code: string, axes: Partial<Record<"X" | "Y" | "Z" | "I" | "J" | "K" | "F", number>>, extra = "", force = false) {
    const words: string[] = [code];
    for (const [k, v] of Object.entries(axes)) {
      if (v === undefined) continue;
      const isAxis = k === "X" || k === "Y" || k === "Z";
      if (isAxis && !force && this.last[k] !== undefined && Math.abs(this.last[k]! - v) < 5e-4) continue;
      words.push(`${k}${fmt(v)}`);
      if (isAxis) this.last[k] = v;
      if (k === "F") this.last.F = v;
    }
    if (extra) words.push(extra);
    if (words.length > 1 || extra) this.lines.push(words.join(" "));
  }

  /** Feed word only when it changes. */
  feed(f: number) {
    return this.last.F === f ? undefined : f;
  }

  forget() {
    this.last = {};
  }
}

/** Part-frame point as X/Y/Z words. */
const xyz = (p: Vec3) => ({ X: p[0], Y: p[1], Z: p[2] });

/** Plane and arc direction for a face: G17 on top, G18 front/back, G19 sides. */
function planeOf(face: Face): { code: string; arcCcwSeenFromOutside: "G2" | "G3"; ij: ("I" | "J" | "K")[] } {
  switch (face) {
    case "top":
      return { code: "G17", arcCcwSeenFromOutside: "G3", ij: ["I", "J", "K"] };
    // G18 arcs are judged looking from +Y: the front face is seen from -Y, so
    // what the operator sees as counter-clockwise is G2 there.
    case "front":
      return { code: "G18", arcCcwSeenFromOutside: "G2", ij: ["I", "J", "K"] };
    case "back":
      return { code: "G18", arcCcwSeenFromOutside: "G3", ij: ["I", "J", "K"] };
    // G19 is judged from +X.
    case "right":
      return { code: "G19", arcCcwSeenFromOutside: "G3", ij: ["I", "J", "K"] };
    case "left":
      return { code: "G19", arcCcwSeenFromOutside: "G2", ij: ["I", "J", "K"] };
  }
}

function pickEndMill(maxDiameter: number): LibraryTool | null {
  const mills = TOOL_LIBRARY.filter((t) => t.kind === "flat" && t.diameter <= maxDiameter + 1e-6);
  return mills.sort((a, b) => b.diameter - a.diameter)[0] ?? null;
}

const tool = (n: number) => TOOL_LIBRARY.find((t) => t.number === n)!;

/** Depth levels from 0 to `depth` in steps no larger than `step`. */
function levels(depth: number, step: number): number[] {
  const n = Math.max(1, Math.ceil(depth / step - 1e-6));
  return Array.from({ length: n }, (_, i) => (depth * (i + 1)) / n);
}

type Ctx = {
  w: Writer;
  design: PartDesign;
  face: Face;
  /** Face-local (u, v, depth) to part frame. */
  at: (u: number, v: number, depth?: number) => Vec3;
};

/** Rapid to above (u, v), then down to the R plane. */
function approach(c: Ctx, u: number, v: number) {
  c.w.move("G00", xyz(c.at(u, v, -CLEARANCE)));
  c.w.move("G00", xyz(c.at(u, v, -R_PLANE)));
}

function retract(c: Ctx, u: number, v: number) {
  c.w.move("G00", xyz(c.at(u, v, -CLEARANCE)));
}

/**
 * Arc in the face plane, from the current point to (u, v) around (cu, cv),
 * at the given depth. Centre offsets are written in the plane's own letters.
 */
function arc(c: Ctx, ccw: boolean, from: [number, number], to: [number, number], center: [number, number], depth: number, feed?: number) {
  const plane = planeOf(c.face);
  const code = ccw ? plane.arcCcwSeenFromOutside : plane.arcCcwSeenFromOutside === "G2" ? "G3" : "G2";
  const start = c.at(from[0], from[1], depth);
  const ctr = c.at(center[0], center[1], depth);
  const off = [ctr[0] - start[0], ctr[1] - start[1], ctr[2] - start[2]];
  const words: Partial<Record<"X" | "Y" | "Z" | "I" | "J" | "K" | "F", number>> = { ...xyz(c.at(to[0], to[1], depth)) };
  if (c.face === "top") Object.assign(words, { I: off[0], J: off[1] });
  else if (c.face === "front" || c.face === "back") Object.assign(words, { I: off[0], K: off[2] });
  else Object.assign(words, { J: off[1], K: off[2] });
  if (feed !== undefined) words.F = feed;
  c.w.move(code, words, "", true);
}

/**
 * Rounded rectangle centred on (cu, cv), half-sizes (hw, hh), corner radius r,
 * traced counter-clockwise (as seen from outside) starting mid-right.
 */
function roundedRect(c: Ctx, cu: number, cv: number, hw: number, hh: number, r: number, depth: number, feed: number) {
  r = Math.max(0, Math.min(r, hw, hh));
  const line = (u: number, v: number) => c.w.move("G01", { ...xyz(c.at(u, v, depth)), F: c.w.feed(feed) });
  line(cu + hw, cv);
  line(cu + hw, cv + hh - r);
  if (r > 0.01) arc(c, true, [cu + hw, cv + hh - r], [cu + hw - r, cv + hh], [cu + hw - r, cv + hh - r], depth);
  line(cu - hw + r, cv + hh);
  if (r > 0.01) arc(c, true, [cu - hw + r, cv + hh], [cu - hw, cv + hh - r], [cu - hw + r, cv + hh - r], depth);
  line(cu - hw, cv - hh + r);
  if (r > 0.01) arc(c, true, [cu - hw, cv - hh + r], [cu - hw + r, cv - hh], [cu - hw + r, cv - hh + r], depth);
  line(cu + hw - r, cv - hh);
  if (r > 0.01) arc(c, true, [cu + hw - r, cv - hh], [cu + hw, cv - hh + r], [cu + hw - r, cv - hh + r], depth);
  line(cu + hw, cv);
}

function facing(c: Ctx, f: Extract<Feature, { kind: "face" }>, t: LibraryTool) {
  const cut = cuttingData(t, c.design.stock.material);
  const [w, h] = faceSize(c.face, c.design.stock);
  const r = t.diameter / 2;
  const u0 = -w / 2 - r - 2;
  const u1 = w / 2 + r + 2;
  for (const depth of levels(f.depth, Math.min(cut.stepDown, 1.5))) {
    approach(c, u0, -h / 2 + r * 0.6);
    let dir = 1;
    for (let v = -h / 2 + r * 0.6; v < h / 2 + r * 0.6 - 0.01; v += cut.stepOver) {
      const vv = Math.min(v, h / 2 - r * 0.6);
      const [from, to] = dir > 0 ? [u0, u1] : [u1, u0];
      c.w.move("G01", { ...xyz(c.at(from, vv, depth)), F: c.w.feed(cut.feed) });
      c.w.move("G01", xyz(c.at(to, vv, depth)));
      dir = -dir;
    }
    retract(c, dir > 0 ? u0 : u1, h / 2);
  }
}

function pocketRect(c: Ctx, f: Extract<Feature, { kind: "pocket-rect" }>, t: LibraryTool) {
  const cut = cuttingData(t, c.design.stock.material);
  const r = t.diameter / 2;
  const [cu, cv] = f.center;
  const hw = f.size[0] / 2;
  const hh = f.size[1] / 2;
  // Loops at decreasing distance from the walls, worked inside out; the last
  // one, at exactly the tool radius, is the finish pass.
  const offsets: number[] = [];
  for (let d = r; hw - d > 0.05 && hh - d > 0.05; d += cut.stepOver) offsets.push(d);
  offsets.reverse();
  for (const depth of levels(f.depth, cut.stepDown)) {
    approach(c, cu, cv);
    c.w.move("G01", { ...xyz(c.at(cu, cv, depth)), F: cut.plunge });
    // Each loop starts with a straight step out to its own mid-right point.
    for (const d of offsets) roundedRect(c, cu, cv, hw - d, hh - d, f.cornerRadius - d, depth, cut.feed);
    retract(c, cu, cv);
  }
}

function pocketCircle(c: Ctx, f: Extract<Feature, { kind: "pocket-circle" }>, t: LibraryTool) {
  const cut = cuttingData(t, c.design.stock.material);
  const rTool = t.diameter / 2;
  const [cu, cv] = f.center;
  const radii: number[] = [];
  for (let rr = f.diameter / 2 - rTool; rr > 0.05; rr -= cut.stepOver) radii.push(rr);
  radii.reverse();
  for (const depth of levels(f.depth, cut.stepDown)) {
    approach(c, cu, cv);
    c.w.move("G01", { ...xyz(c.at(cu, cv, depth)), F: cut.plunge });
    for (const rr of radii) {
      c.w.move("G01", { ...xyz(c.at(cu + rr, cv, depth)), F: c.w.feed(cut.feed) });
      // Two halves rather than one full circle: unambiguous on any control.
      arc(c, true, [cu + rr, cv], [cu - rr, cv], [cu, cv], depth);
      arc(c, true, [cu - rr, cv], [cu + rr, cv], [cu, cv], depth);
    }
    c.w.move("G01", xyz(c.at(cu, cv, depth)));
    retract(c, cu, cv);
  }
}

function slot(c: Ctx, f: Extract<Feature, { kind: "slot" }>, t: LibraryTool) {
  const cut = cuttingData(t, c.design.stock.material);
  const [su, sv] = f.start;
  const [eu, ev] = f.end;
  const extra = f.width / 2 - t.diameter / 2;
  const len = Math.hypot(eu - su, ev - sv) || 1;
  // Unit normal to the slot's centre line, in the face.
  const nu = -(ev - sv) / len;
  const nv = (eu - su) / len;
  for (const depth of levels(f.depth, cut.stepDown)) {
    approach(c, su, sv);
    c.w.move("G01", { ...xyz(c.at(su, sv, depth)), F: cut.plunge });
    c.w.move("G01", { ...xyz(c.at(eu, ev, depth)), F: c.w.feed(cut.feed) });
    if (extra > 0.05) {
      // Widen with a loop at the wall offset around both ends.
      const a: [number, number] = [eu + nu * extra, ev + nv * extra];
      const b: [number, number] = [su + nu * extra, sv + nv * extra];
      const a2: [number, number] = [su - nu * extra, sv - nv * extra];
      const b2: [number, number] = [eu - nu * extra, ev - nv * extra];
      c.w.move("G01", xyz(c.at(b2[0], b2[1], depth)));
      arc(c, true, b2, a, [eu, ev], depth);
      c.w.move("G01", xyz(c.at(b[0], b[1], depth)));
      arc(c, true, b, a2, [su, sv], depth);
      c.w.move("G01", xyz(c.at(b2[0], b2[1], depth)));
    }
    retract(c, eu, ev);
  }
}

/** Outside profile to finished size with G41, climb milled (clockwise). */
function contour(c: Ctx, f: Extract<Feature, { kind: "contour" }>, t: LibraryTool, dNumber: number) {
  const cut = cuttingData(t, c.design.stock.material);
  const hw = f.size[0] / 2;
  const hh = f.size[1] / 2;
  const r = Math.min(f.cornerRadius, hw, hh);
  const rTool = t.diameter / 2;
  const { stock } = c.design;
  const excess = Math.max(stock.x / 2 - hw, stock.y / 2 - hh);
  const start: [number, number] = [-hw - rTool - 6, -hh - rTool - 6];
  for (const depth of levels(f.depth, cut.stepDown)) {
    approach(c, start[0], start[1]);
    c.w.move("G01", { ...xyz(c.at(start[0], start[1], depth)), F: cut.plunge });
    // Roughing rings without compensation when there is more stock than one
    // pass takes; the compensated pass then finishes to size.
    for (let d = excess - rTool * 0.8; d > rTool * 0.4; d -= cut.stepOver) {
      const ring = rTool + d;
      c.w.move("G01", { ...xyz(c.at(-hw - ring, -hh - ring, depth)), F: c.w.feed(cut.feed) });
      c.w.move("G01", xyz(c.at(-hw - ring, hh + ring, depth)));
      c.w.move("G01", xyz(c.at(hw + ring, hh + ring, depth)));
      c.w.move("G01", xyz(c.at(hw + ring, -hh - ring, depth)));
      c.w.move("G01", xyz(c.at(-hw - ring, -hh - ring, depth)));
    }
    c.w.move("G01", xyz(c.at(start[0], start[1], depth)));
    // Comp starts on the lead-in line to the left edge, below its middle.
    c.w.move("G01 G41", { ...xyz(c.at(-hw, -hh + r + 2, depth)), F: c.w.feed(cut.feed) }, `D${String(dNumber).padStart(2, "0")}`, true);
    c.w.move("G01", xyz(c.at(-hw, hh - r, depth)));
    if (r > 0.01) arc(c, false, [-hw, hh - r], [-hw + r, hh], [-hw + r, hh - r], depth);
    c.w.move("G01", xyz(c.at(hw - r, hh, depth)));
    if (r > 0.01) arc(c, false, [hw - r, hh], [hw, hh - r], [hw - r, hh - r], depth);
    c.w.move("G01", xyz(c.at(hw, -hh + r, depth)));
    if (r > 0.01) arc(c, false, [hw, -hh + r], [hw - r, -hh], [hw - r, -hh + r], depth);
    c.w.move("G01", xyz(c.at(-hw + r, -hh, depth)));
    if (r > 0.01) arc(c, false, [-hw + r, -hh], [-hw, -hh + r], [-hw + r, -hh + r], depth);
    c.w.move("G01", xyz(c.at(-hw, -hh + r + 4, depth)));
    // Leave outwards, then cancel comp.
    c.w.move("G01 G40", xyz(c.at(-hw - rTool - 6, -hh + r + 4, depth)), "", true);
    retract(c, -hw - rTool - 6, -hh + r + 4);
  }
}

/** Holes on the top face use canned cycles; on a side face, written out. */
function drill(c: Ctx, holes: Extract<Feature, { kind: "hole" }>[], t: LibraryTool, spot: boolean) {
  const cut = cuttingData(t, c.design.stock.material);
  const depthOf = (h: (typeof holes)[number]) =>
    spot ? Math.min(h.diameter / 2 + 0.3, t.diameter / 2) : h.depth + (t.diameter / 2) * 0.6;
  if (c.face === "top") {
    const first = holes[0];
    c.w.move("G00", xyz(c.at(first.center[0], first.center[1], -CLEARANCE)));
    holes.forEach((h, i) => {
      const depth = depthOf(h);
      const peck = !spot && depth > 3 * t.diameter;
      const words = { X: h.center[0], Y: h.center[1], Z: -depth };
      if (i === 0) {
        c.w.raw(
          `G98 ${peck ? "G83" : "G81"} X${fmt(words.X)} Y${fmt(words.Y)} Z${fmt(words.Z)} R${fmt(R_PLANE)}` +
            `${peck ? ` Q${fmt(cut.peck)}` : ""} F${fmt(cut.plunge)}`,
        );
      } else {
        c.w.raw(`X${fmt(words.X)} Y${fmt(words.Y)} Z${fmt(words.Z)}`);
      }
    });
    c.w.raw("G80");
    c.w.forget();
    return;
  }
  for (const h of holes) {
    const depth = depthOf(h);
    approach(c, h.center[0], h.center[1]);
    // Peck in steps, retracting to clear chips, like G83 would.
    let reached = 0;
    while (reached < depth - 1e-6) {
      const next = spot ? depth : Math.min(depth, reached + cut.peck);
      c.w.move("G01", { ...xyz(c.at(h.center[0], h.center[1], next)), F: cut.plunge }, "", true);
      reached = next;
      if (reached < depth) {
        c.w.move("G00", xyz(c.at(h.center[0], h.center[1], -R_PLANE)), "", true);
        c.w.move("G00", xyz(c.at(h.center[0], h.center[1], reached - 0.5)), "", true);
      }
    }
    retract(c, h.center[0], h.center[1]);
  }
}

/**
 * The CAM pass. Features that cannot be machined with the carousel are
 * reported, not silently dropped.
 */
export function generateProgram(design: PartDesign): CamResult {
  const w = new Writer();
  const operations: Operation[] = [];
  const warnings = validateDesign(design).map((i) => i.message);
  const { stock } = design;
  const oNumber = `O${String(design.programNumber).padStart(5, "0")}`;

  // Plan: per face, in a fixed order, the operations and their tools.
  type Step = { face: Face; label: string; tool: LibraryTool; run: (c: Ctx) => void; featureId: string };
  const steps: Step[] = [];
  for (const face of FACES) {
    const feats = design.features.filter((f) => f.face === face);
    if (feats.length === 0) continue;
    for (const f of feats) {
      if (f.kind === "face") {
        const t = tool(1);
        steps.push({ face, label: "Face", tool: t, featureId: f.id, run: (c) => facing(c, f, t) });
      }
    }
    for (const f of feats) {
      if (f.kind === "contour") {
        const t = tool(2);
        steps.push({ face, label: "Outside contour", tool: t, featureId: f.id, run: (c) => contour(c, f, t, t.number) });
      }
    }
    for (const f of feats) {
      if (f.kind === "pocket-rect") {
        const t = pickEndMill(Math.min(2 * f.cornerRadius, f.size[0] * 0.7, f.size[1] * 0.7));
        if (!t) warnings.push(`${FACE_LABEL[face]} pocket: no end mill small enough for its corners.`);
        else steps.push({ face, label: "Rectangular pocket", tool: t, featureId: f.id, run: (c) => pocketRect(c, f, t) });
      } else if (f.kind === "pocket-circle") {
        const t = pickEndMill(f.diameter * 0.7);
        if (!t) warnings.push(`${FACE_LABEL[face]} circular pocket: no end mill fits a ${f.diameter} mm bore.`);
        else steps.push({ face, label: "Circular pocket", tool: t, featureId: f.id, run: (c) => pocketCircle(c, f, t) });
      } else if (f.kind === "slot") {
        const t = pickEndMill(f.width);
        if (!t) warnings.push(`${FACE_LABEL[face]} slot: no end mill fits a ${f.width} mm slot.`);
        else steps.push({ face, label: "Slot", tool: t, featureId: f.id, run: (c) => slot(c, f, t) });
      }
    }
    const holes = feats.filter((f): f is Extract<Feature, { kind: "hole" }> => f.kind === "hole");
    const byDrill = new Map<LibraryTool, typeof holes>();
    for (const h of holes) {
      const d = TOOL_LIBRARY.find((t) => t.kind === "drill" && Math.abs(t.diameter - h.diameter) < 0.051);
      if (!d) {
        warnings.push(`${FACE_LABEL[face]} hole Ø${h.diameter}: no drill of that size in the carousel (5.0, 6.8, 8.5 mm).`);
        continue;
      }
      byDrill.set(d, [...(byDrill.get(d) ?? []), h]);
    }
    const drillable = [...byDrill.values()].flat();
    if (drillable.length > 0) {
      const spot = tool(4);
      steps.push({ face, label: "Spot drill", tool: spot, featureId: drillable[0].id, run: (c) => drill(c, drillable, spot, true) });
    }
    for (const [d, hs] of byDrill) {
      steps.push({ face, label: `Drill Ø${d.diameter}`, tool: d, featureId: hs[0].id, run: (c) => drill(c, hs, d, false) });
    }
  }

  // Header: what the setup sheet would say.
  w.raw("%");
  w.raw(`${oNumber} (${design.name.toUpperCase().replace(/[()]/g, "")})`);
  w.comment(`Stock ${stock.x} x ${stock.y} x ${stock.z} ${MATERIALS[stock.material].label}`);
  w.comment("G54 = top face centre of the stock, set at B0 C0");
  for (const t of [...new Set(steps.map((s) => s.tool))].sort((a, b) => a.number - b.number)) {
    w.comment(`T${t.number} ${t.name} H${t.number} D${t.number}`);
  }
  w.raw("G00 G17 G21 G40 G49 G80 G90");
  w.raw("G53 G00 Z0.");

  let currentTool = 0;
  let currentFace: Face | null = null;
  for (const step of steps) {
    const toolChange = step.tool.number !== currentTool;
    const reindex = step.face !== currentFace;
    const cut = cuttingData(step.tool, stock.material);
    w.raw("");
    w.comment(`${FACE_LABEL[step.face]}: ${step.label} - T${step.tool.number}`);
    if (toolChange || reindex) {
      if (currentTool) w.raw("M09");
      w.raw("G53 G00 Z0.");
      if (currentFace && currentFace !== "top") w.raw("G255");
      w.forget();
    }
    if (toolChange) {
      w.raw(`T${step.tool.number} M06`);
      currentTool = step.tool.number;
    }
    if (toolChange || reindex) {
      const { b, c } = anglesFacingUp(faceFrame(step.face, stock).n);
      w.raw(`G00 G90 G54 B${fmt(b)} C${fmt(c)}`);
      if (step.face !== "top") w.raw("G254");
      w.raw(planeOf(step.face).code);
      w.raw(`S${cut.rpm} M03`);
      currentFace = step.face;
      // First positioning move carries G43 so length comp is on before Z.
      const ctx: Ctx = { w, design, face: step.face, at: (u, v, d = 0) => facePoint(step.face, stock, u, v, d) };
      const firstApproach = ctx.at(0, 0, -CLEARANCE);
      w.move("G00", xyz(firstApproach), `G43 H${String(step.tool.number).padStart(2, "0")} M08`, true);
    } else {
      w.raw(`S${cut.rpm} M03`);
    }
    const ctx: Ctx = { w, design, face: step.face, at: (u, v, d = 0) => facePoint(step.face, stock, u, v, d) };
    step.run(ctx);
    operations.push({ face: step.face, featureId: step.featureId, label: step.label, tool: step.tool });
  }

  w.raw("");
  w.raw("M09");
  w.raw("M05");
  w.raw("G53 G00 Z0.");
  if (currentFace && currentFace !== "top") w.raw("G255");
  w.raw("G00 G90 G54 B0. C0.");
  w.raw("G53 G00 Y0.");
  w.raw("M30");
  w.raw("%");

  return { text: w.lines.join("\n"), operations, warnings };
}
