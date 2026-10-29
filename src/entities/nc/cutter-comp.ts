/**
 * Cutter radius compensation (G41/G42/G40) in the XY plane, Fanuc type C as
 * Haas runs it with Setting 58 = FANUC.
 *
 * Compensation needs the next move to know where the current one ends, so
 * this is a one-move lookahead buffer between the interpreter and the motion
 * emitter. Z-only moves and events (spindle, coolant, stops) that arrive while
 * a move is held are queued behind it and released in order, at the corner.
 *
 * - Entry: the first XY move after G41/G42 runs from the uncompensated
 *   position to the point offset perpendicular to the start of the move
 *   after it.
 * - Exit: the first XY move after G40 starts at the point offset
 *   perpendicular to the end of the move before it and ends uncompensated.
 * - Inside corners stop at the intersection of the two offset paths.
 * - Outside corners up to 90° extend both paths to their intersection;
 *   sharper ones get the type C pair of extension points, one radius past
 *   each path's end along its tangent. Arcs take the same corner through
 *   their tangent lines and join it with a straight link.
 * - Arcs that cannot be offset (radius not larger than the tool radius on
 *   the inside) and trims that reverse a move are alarms.
 */
import type { AlarmKey } from "./alarms";
import {
  type Arc,
  type Vec3,
  add,
  arcFromCenter,
  dot,
  intersectCircles,
  intersectLineCircle,
  intersectLines,
  scale,
  sub,
  unit,
} from "./geometry";

/** A move in the compensation plane, with whatever the emitter needs riding along. */
export type PathSeg<P> = {
  from: Vec3;
  to: Vec3;
  /** Present for G02/G03; `from`/`to` repeat its endpoints. */
  arc?: Arc;
  line: number;
  data: P;
};

export type CompSink<P, E> = {
  seg(s: PathSeg<P>): void;
  event(e: E): void;
  alarm(key: AlarmKey, line: number, detail: string): never;
};

type Held<P> = { seg: PathSeg<P>; start: Vec3; offset: number; entry: boolean };
type Queued<P, E> = { seg: PathSeg<P> } | { event: E };

const EPS = 1e-6;

const xyMoves = (s: PathSeg<unknown>) => !!s.arc || Math.hypot(s.to[0] - s.from[0], s.to[1] - s.from[1]) > EPS;
const withZ = (p: Vec3, z: number): Vec3 => [p[0], p[1], z];
const left = (d: Vec3): Vec3 => [-d[1], d[0], 0];

export class CutterComp<P, E> {
  private mode: "off" | "entry" | "on" | "exit" = "off";
  /** Signed radius for moves from now on: + left (G41), - right (G42). */
  private offset = 0;
  private held: Held<P> | null = null;
  private queue: Queued<P, E>[] = [];

  constructor(private sink: CompSink<P, E>) {}

  /** True while G41/G42 is in force or a move is still held. */
  get active() {
    return this.mode !== "off" || this.held !== null;
  }

  /** G41/G42: compensation starts on the next XY move. */
  start(offset: number) {
    this.offset = offset;
    if (this.mode === "off") this.mode = "entry";
    else if (this.mode === "exit") this.mode = "on";
  }

  /** G40: compensation ends on the next XY move. */
  cancel() {
    if (this.mode === "entry") this.mode = "off";
    else if (this.mode === "on") this.mode = "exit";
  }

  event(e: E) {
    if (this.held) this.queue.push({ event: e });
    else this.sink.event(e);
  }

  move(seg: PathSeg<P>) {
    const xy = xyMoves(seg);
    switch (this.mode) {
      case "off":
        return this.sink.seg(seg);
      case "entry":
        if (!xy) return this.sink.seg(seg);
        if (seg.arc) this.sink.alarm("compBeginArc", seg.line, "the move after G41/G42 must be G00 or G01");
        this.held = { seg, start: seg.from, offset: this.offset, entry: true };
        this.mode = "on";
        return;
      case "on":
        if (xy) this.corner(seg);
        else this.queue.push({ seg });
        return;
      case "exit": {
        if (!xy) {
          this.queue.push({ seg });
          return;
        }
        if (seg.arc) this.sink.alarm("compEndArc", seg.line, "the move after G40 must be G00 or G01");
        const end = this.release();
        this.mode = "off";
        return this.sink.seg({ ...seg, from: withZ(end, seg.from[2]) });
      }
    }
  }

  /** Ends a held move at its perpendicular point — for program end, tool
   *  changes and anything else the lookahead cannot see past. With G41/G42
   *  still active, the next XY move is an entry move again. */
  flush() {
    if (this.held) this.release();
    if (this.mode === "on") this.mode = "entry";
    if (this.mode === "exit") this.mode = "off";
  }

  /** Emits the held move ending at its own perpendicular point. */
  private release(): Vec3 {
    const held = this.held!;
    const end = this.offsetPoint(held.seg, "end", held.offset);
    this.emitHeld(end);
    return end;
  }

  private corner(next: PathSeg<P>) {
    const a = this.held!;
    const b = { seg: next, offset: this.offset };
    const pB = this.offsetPoint(next, "start", b.offset);
    if (a.entry) {
      this.emitHeld(pB);
      return this.hold(next, pB);
    }
    const pA = this.offsetPoint(a.seg, "end", a.offset);
    if (Math.hypot(pA[0] - pB[0], pA[1] - pB[1]) < EPS) {
      this.emitHeld(pA);
      return this.hold(next, pB);
    }
    const tA = this.tangent(a.seg, "end");
    const tB = this.tangent(next, "start");
    const turn = tA[0] * tB[1] - tA[1] * tB[0];
    const side = Math.sign(a.offset || b.offset);
    const corner = a.seg.to;

    if (side * turn > 1e-9) {
      // Inside: both paths stop where they meet.
      const x = this.meet(a.seg, a.offset, pA, tA, next, b.offset, pB, tB, corner);
      if (!x) this.sink.alarm("compInterference", next.line, "the offset paths at this corner do not meet");
      this.emitHeld(x);
      return this.hold(next, withZ(x, next.from[2]));
    }

    // Outside: extend along the tangents.
    let points: Vec3[];
    const x = dot(tA, tB) >= 0 ? intersectLines(pA, tA, pB, tB) : null;
    if (x) points = [x];
    else if (dot(tA, tB) < 0) {
      points = [add(pA, scale(tA, Math.abs(a.offset))), sub(pB, scale(tB, Math.abs(b.offset)))];
    } else points = [pA, pB];
    const aEnd = a.seg.arc ? pA : points[0];
    const links = [...(a.seg.arc ? points : points.slice(1)), ...(next.arc ? [pB] : [])];
    this.emitHeld(aEnd);
    let at = withZ(aEnd, next.from[2]);
    for (const p of links) {
      const to = withZ(p, next.from[2]);
      if (Math.hypot(to[0] - at[0], to[1] - at[1]) > EPS) {
        this.sink.seg({ from: at, to, line: next.line, data: next.data });
      }
      at = to;
    }
    this.hold(next, at);
  }

  private hold(seg: PathSeg<P>, start: Vec3) {
    this.held = { seg, start: withZ(start, seg.from[2]), offset: this.offset, entry: false };
  }

  /** Emits the held move from its compensated start to `end`, then whatever queued behind it. */
  private emitHeld(endXY: Vec3) {
    const { seg, start, entry } = this.held!;
    const end = withZ(endXY, seg.to[2]);
    this.held = null;
    if (seg.arc) {
      const arc: Arc = arcFromCenter(start, end, seg.arc.center, seg.arc.n);
      const full = seg.arc.sweep > 2 * Math.PI - 1e-6;
      if (!full && arc.sweep > seg.arc.sweep + 1e-6) {
        this.sink.alarm("compInterference", seg.line, "the compensated arc would run backwards");
      }
      this.sink.seg({ ...seg, from: start, to: end, arc });
    } else {
      const programmed = sub(seg.to, seg.from);
      const compensated = sub(end, start);
      if (!entry && programmed[0] * compensated[0] + programmed[1] * compensated[1] <= 0) {
        this.sink.alarm("compInterference", seg.line, "the move is shorter than the tool radius needs");
      }
      this.sink.seg({ ...seg, from: start, to: end });
    }
    const at = endXY;
    for (const q of this.queue) {
      if ("event" in q) this.sink.event(q.event);
      else this.sink.seg({ ...q.seg, from: withZ(at, q.seg.from[2]), to: withZ(at, q.seg.to[2]) });
    }
    this.queue = [];
  }

  /** Unit XY tangent at the start or end of a move. */
  private tangent(seg: PathSeg<P>, which: "start" | "end"): Vec3 {
    if (!seg.arc) return unit([seg.to[0] - seg.from[0], seg.to[1] - seg.from[1], 0]);
    const p = which === "start" ? seg.from : seg.to;
    const r = sub(p, seg.arc.center);
    const nz = Math.sign(seg.arc.n[2]);
    return unit([-nz * r[1], nz * r[0], 0]);
  }

  /** The point `offset` to the left of a move's start or end. */
  private offsetPoint(seg: PathSeg<P>, which: "start" | "end", offset: number): Vec3 {
    const p = which === "start" ? seg.from : seg.to;
    if (seg.arc) {
      const radius = this.offsetRadius(seg, offset);
      const r = unit([p[0] - seg.arc.center[0], p[1] - seg.arc.center[1], 0]);
      return [seg.arc.center[0] + r[0] * radius, seg.arc.center[1] + r[1] * radius, p[2]];
    }
    return add(p, scale(left(this.tangent(seg, which)), offset));
  }

  /** Radius of the offset arc: on a counter-clockwise arc the left side is
   *  towards the centre. */
  private offsetRadius(seg: PathSeg<P>, offset: number): number {
    const arc = seg.arc!;
    if (Math.abs(arc.n[2]) < 0.999) {
      this.sink.alarm("compPlane", seg.line, "cutter compensation works in the XY plane only");
    }
    const r = (arc.r0 + arc.r1) / 2 - offset * Math.sign(arc.n[2]);
    if (r <= EPS) {
      this.sink.alarm(
        "compPathSmall",
        seg.line,
        `arc radius ${((arc.r0 + arc.r1) / 2).toFixed(3)} is not larger than the tool radius ${Math.abs(offset).toFixed(3)}`,
      );
    }
    return r;
  }

  /** Where two offset paths cross, nearest the programmed corner. */
  private meet(
    a: PathSeg<P>,
    oA: number,
    pA: Vec3,
    tA: Vec3,
    b: PathSeg<P>,
    oB: number,
    pB: Vec3,
    tB: Vec3,
    corner: Vec3,
  ): Vec3 | null {
    let found: Vec3[];
    if (!a.arc && !b.arc) {
      const x = intersectLines(pA, tA, pB, tB);
      found = x ? [x] : [];
    } else if (a.arc && b.arc) {
      found = intersectCircles(a.arc.center, this.offsetRadius(a, oA), b.arc.center, this.offsetRadius(b, oB));
    } else if (a.arc) {
      found = intersectLineCircle(pB, tB, a.arc.center, this.offsetRadius(a, oA));
    } else {
      found = intersectLineCircle(pA, tA, b.arc!.center, this.offsetRadius(b, oB));
    }
    if (found.length === 0) return null;
    const near = (p: Vec3) => Math.hypot(p[0] - corner[0], p[1] - corner[1]);
    const best = found.reduce((m, p) => (near(p) < near(m) ? p : m));
    // An inside corner never moves the tool further than a few radii from it.
    const reach = Math.max(Math.abs(oA), Math.abs(oB)) * 50 + 1;
    return near(best) <= reach ? best : null;
  }
}
