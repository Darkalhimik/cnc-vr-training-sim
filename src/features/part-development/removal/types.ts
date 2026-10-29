/**
 * The removal engine's public data. Plain data only, so the same definitions
 * serve the main thread, the worker and the Node checks in
 * tools/removal-check.
 */

/** Stock frame: millimetres, origin at the centre of the stock's bottom face,
 *  +X/+Y/+Z = the table's axes at B=0 C=0. The block spans
 *  x ∈ [-sx/2, sx/2], y ∈ [-sy/2, sy/2], z ∈ [0, sz]. */
export type StockSpec = { size: [number, number, number]; /** voxel edge, mm; default: auto */ voxel?: number };

export type CutterShape = {
  kind: "flat" | "ball" | "bull" | "drill" | "chamfer";
  diameter: number; // mm
  cornerRadius?: number; // bull nose
  tipAngle?: number; // deg, drill (118) / chamfer (90)
  fluteLength: number; // cutting length from the tip, mm
  shankDiameter?: number; // non-cutting shank above the flutes (default = diameter)
  holderDiameter?: number; // tool holder, starts at `stickout` from the tip (default 40)
  stickout: number; // tip to holder face, mm
  /** Holder length above its face, mm (default 60). Only matters near the part. */
  holderLength?: number;
};

/** Tool tip position and unit tool axis (pointing from the tip towards the
 *  spindle), both in the stock frame. */
export type ToolPose = { tip: [number, number, number]; axis: [number, number, number] };

export type CutReport = {
  removedMm3: number;
  /** Non-cutting geometry (shank above fluteLength, or holder) entered material. */
  collision: null | { kind: "shank" | "holder"; poseIndex: number };
};
