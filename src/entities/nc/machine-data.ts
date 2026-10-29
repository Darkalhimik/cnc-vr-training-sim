/**
 * The UMC-500 and NGC numbers the interpreter needs (docs/haas-ngc/umc500.md
 * §3, §7, §8; settings-alarms.md). Travel comes from machine-logic.ts so
 * there is one source for it.
 */
import type { Axis } from "../machine/machine-types";

/** Rapid rates: mm/min for X/Y/Z (900 in/min = 22,860 mm/min), deg/min for
 *  B/C (50 °/s). The UMC-500SS is faster (1,200 in/min, 179 °/s). */
export const RAPID_RATE: Record<Axis, number> = {
  x: 22860,
  y: 22860,
  z: 22860,
  b: 3000,
  c: 3000,
};

/** Maximum cutting feed, mm/min (650 in/min). A faster F raises alarm 309. */
export const MAX_FEED = 16510;

/** Largest G93 inverse-time F. */
export const MAX_INVERSE_TIME_F = 45000;

/** SMTC tool-to-tool time, average. The Z retract to machine zero before it
 *  is a separate rapid. */
export const TOOL_CHANGE_SECONDS = 2.8;

/** UMC-500 standard spindle. */
export const MAX_SPINDLE_RPM = 8100;

/** Tool numbers and H/D offset rows run 1–200. */
export const MAX_TOOL_NUMBER = 200;

/** Linearisation chord tolerance, mm. */
export const CHORD_TOLERANCE = 0.01;

/** Alarm 304/302 tolerance: start and end radius (or 2R and the chord) may
 *  differ by 0.01 mm in metric, 0.001 in in inch. */
export const ARC_TOLERANCE = { metric: 0.01, inch: 0.0254 };

/** Setting 22, CAN CYCLE DELTA Z: the G73 chip-break back-off and the G83
 *  re-entry clearance above the last peck. The factory value is not
 *  documented; 0.05 in is the classic Haas figure. */
export const CAN_CYCLE_DELTA_Z = 1.27;

/** M98/M97/G65 calls may nest this deep. */
export const MAX_CALL_DEPTH = 9;

/** Executed blocks before the run is stopped as a runaway loop. */
export const MAX_BLOCKS = 500_000;
/** Motions before the run is stopped. */
export const MAX_MOTIONS = 2_000_000;

export const MM_PER_INCH = 25.4;
