/**
 * Measuring a task's part: the trainee's stock against the drawing, cut by
 * the CAM's own program on the same lattice. Comparing two distance fields
 * sample by sample is a CMM that measures everywhere at once, and a band of
 * tolerance around the reference surface forgives the difference between two
 * correct toolpaths.
 */
import { toolInStock } from "@/entities/machine/kinematics";
import { interpret } from "@/entities/nc";
import { generateProgram } from "@/entities/part/cam";
import type { PartDesign } from "@/entities/part/part-design";
import { toolByNumber, type LibraryTool } from "@/entities/part/tool-library";
import type { PartField } from "@/features/warehouse/part-field";
import { cutterOf, segment } from "@/features/part-development/cutter";
import { idealSetup } from "@/features/part-development/program-check";
import { createStockRemoval, type ToolPose } from "@/features/part-development/removal";
import { FILL, STEPS } from "@/features/part-development/removal/grid";

/**
 * The design as the CAM would cut it, with the probed setup, on a lattice of
 * `voxel` — the trainee's stock's — so the two can be compared sample for
 * sample. Runs in its own worker; a few seconds for a training part.
 */
export async function referenceField(design: PartDesign, voxel: number): Promise<PartField> {
  const result = interpret(generateProgram(design).text, idealSetup(design));
  const removal = createStockRemoval();
  try {
    await removal.reset({ size: [design.stock.x, design.stock.y, design.stock.z], voxel });
    let tool: LibraryTool | null = null;
    let poses: ToolPose[] = [];
    const flush = async () => {
      if (tool && poses.length > 1) await removal.cut(cutterOf(tool), poses);
      poses = [];
    };
    for (const m of result.motions) {
      if (m.kind === "toolChange") {
        await flush();
        tool = toolByNumber(m.tool);
        continue;
      }
      if ((m.kind !== "rapid" && m.kind !== "feed") || !tool) continue;
      if (poses.length === 0) poses.push(toolInStock(m.from, tool.length));
      for (const p of segment(m.from, m.to)) poses.push(toolInStock(p, tool.length));
    }
    await flush();
    const { info, data } = await removal.exportField();
    return { info, data };
  } finally {
    removal.dispose();
  }
}

export type Measurement = {
  /** Material still there that the drawing removes, beyond tolerance, mm³. */
  leftMm3: number;
  /** Material gone that the drawing keeps, beyond tolerance, mm³. */
  overcutMm3: number;
  /** What the drawing removes from the blank, mm³. */
  toRemoveMm3: number;
  /** 0–100. */
  score: number;
};

/**
 * Sample-by-sample comparison. Left material counts once, an over-cut twice:
 * material can still come off, but not go back on. `blankMm3` is the uncut
 * blank's volume, so what the drawing removes is the blank less the target.
 */
export function measure(actual: PartField, reference: PartField, tolerance: number, blankMm3: number): Measurement {
  const a = actual.info;
  const t = reference.info;
  if (a.dims.some((n, i) => n !== t.dims[i]) || Math.abs(a.voxel - t.voxel) > 1e-6) {
    throw new Error("The part and the reference are on different lattices.");
  }
  const band = (tolerance / a.voxel) * STEPS;
  let left = 0;
  let over = 0;
  let kept = 0;
  for (let n = 0; n < actual.data.length; n++) {
    const qa = actual.data[n];
    const qt = reference.data[n];
    kept += FILL[qt + 128];
    if (qt > band) left += FILL[qa + 128];
    else if (qt < -band) over += 1 - FILL[qa + 128];
  }
  const cell = a.voxel ** 3;
  const leftMm3 = left * cell;
  const overcutMm3 = over * cell;
  const toRemoveMm3 = Math.max(1, blankMm3 - kept * cell);
  const score = Math.round(100 * Math.max(0, Math.min(1, 1 - (leftMm3 + 2 * overcutMm3) / Math.max(toRemoveMm3, 50))));
  return { leftMm3, overcutMm3, toRemoveMm3, score };
}
