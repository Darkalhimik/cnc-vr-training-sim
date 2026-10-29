/**
 * Carousel tools as the removal engine sweeps them, and the positions a move
 * sweeps through — shared by the live machine and offline simulation.
 */
import { AXES, type AxisValues } from "@/entities/machine/machine-types";
import type { LibraryTool } from "@/entities/part/tool-library";
import type { CutterShape } from "./removal";

export function cutterOf(tool: LibraryTool): CutterShape {
  const kind = tool.kind === "spot" ? "chamfer" : tool.kind === "face" ? "flat" : tool.kind;
  return {
    kind,
    diameter: tool.diameter,
    tipAngle: tool.tipAngle,
    fluteLength: tool.fluteLength,
    stickout: tool.stickout,
    holderDiameter: tool.holderDiameter,
  };
}

/** Points every ≤ 0.5 mm / 1° from `from` to `to`, excluding `from`. */
export function segment(from: AxisValues, to: AxisValues): AxisValues[] {
  const lin = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  const rot = Math.max(Math.abs(to.b - from.b), Math.abs(to.c - from.c));
  const n = Math.ceil(Math.max(lin / 0.5, rot));
  const out: AxisValues[] = [];
  for (let k = 1; k <= n; k++) {
    const p = {} as AxisValues;
    for (const a of AXES) p[a] = from[a] + ((to[a] - from[a]) * k) / n;
    out.push(p);
  }
  return out;
}
