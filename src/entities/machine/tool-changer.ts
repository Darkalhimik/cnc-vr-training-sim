/**
 * The UMC-500's 30+1 side-mount tool changer (SMTC): which tool is in which
 * pocket, how far the carousel turns, and where every moving part of the
 * changer is at any moment of an M06 — for the interpreter (what a change
 * costs), the reducer (the pocket table after the swap) and the rig (what to
 * draw). docs/haas-ngc/smtc.md has the sources and what is assumed.
 *
 * Pure, and free of `@/` imports, so the interpreter's checks compile it as is.
 */
import { TOOL_CHANGE_SECONDS } from "../nc/machine-data";

export const POCKETS = 30;

/** Machine X/Y the head goes to for the arm, after Z has retracted to machine
 *  zero (Setting 247 OFF). The arm's spindle end is at the −X end of travel:
 *  measured off the CAD in tools/blender/build_umc500.py. */
export const TOOL_CHANGE_XY = { x: -610, y: -82 };

/** Carousel indexing time per pocket. Haas does not publish it. */
export const INDEX_SECONDS_PER_POCKET = 0.12;

/** Tool in each pocket, pocket 1 first; 0 is an empty pocket. */
export type PocketTable = number[];

/** Tool N in pocket N, as the carousel is loaded at the start of a shift; the
 *  spindle tool's own pocket is the empty one. */
export function loadedPockets(tools: number[], toolInSpindle: number): PocketTable {
  const pockets: PocketTable = new Array(POCKETS).fill(0);
  for (const t of tools) if (t >= 1 && t <= POCKETS && t !== toolInSpindle) pockets[t - 1] = t;
  return pockets;
}

/** The pocket a tool is in, 1-based; 0 if it is in none. */
export const pocketOf = (pockets: PocketTable, tool: number) => pockets.indexOf(tool) + 1;

/** Pockets the carousel turns from `from` to `to` the short way round; the
 *  sign is the direction. */
export function indexSteps(from: number, to: number): number {
  const d = (((to - from) % POCKETS) + POCKETS) % POCKETS;
  return d > POCKETS / 2 ? d - POCKETS : d;
}

/** The double arm swaps through one pocket: the incoming tool comes out of
 *  it, and the outgoing tool goes into it. */
export function afterSwap(pockets: PocketTable, pocket: number, outgoing: number): PocketTable {
  const next = [...pockets];
  next[pocket - 1] = outgoing;
  return next;
}

/** What an M06 to `tool` takes: the pocket it is in, how far the carousel
 *  turns to bring that pocket to the arm, and how long the whole change is. */
export function planChange(pockets: PocketTable, station: number, tool: number) {
  const pocket = pocketOf(pockets, tool);
  const index = pocket ? indexSteps(station, pocket) : 0;
  const indexSeconds = Math.abs(index) * INDEX_SECONDS_PER_POCKET;
  return { pocket, index, indexSeconds, seconds: indexSeconds + TOOL_CHANGE_SECONDS };
}

/**
 * The swap, as shares of TOOL_CHANGE_SECONDS, in the order mcode.md §5.3
 * gives it: pocket down, arm grips both tools, drawbar unclamps, arm pulls
 * them out, turns 180°, pushes them in, drawbar clamps, arm returns, pocket up.
 */
const SWAP: [phase: SwapPhase, share: number][] = [
  ["pocketDown", 0.12],
  ["grip", 0.16],
  ["unclamp", 0.06],
  ["extract", 0.12],
  ["swing", 0.2],
  ["insert", 0.12],
  ["clamp", 0.06],
  ["return", 0.1],
  ["pocketUp", 0.06],
];

export type SwapPhase =
  | "index"
  | "pocketDown"
  | "grip"
  | "unclamp"
  | "extract"
  | "swing"
  | "insert"
  | "clamp"
  | "return"
  | "pocketUp";

/** Where a tool taking part in the change is. */
export type ToolPlace = "spindle" | "arm" | "pocket";

export type ChangerPose = {
  phase: SwapPhase;
  /** Pockets turned so far from where the carousel started, signed, fractional. */
  indexed: number;
  /** The station pocket's tilt: 0 level in the carousel, 1 hanging down. */
  pocketDown: number;
  /** Arm turn about its vertical axis, degrees from home; at −90 end A is
   *  under the spindle and end B under the pocket. */
  arm: number;
  /** Arm drop: 0 up, 1 down with both tools pulled out. */
  armDown: number;
  /** The spindle's tool, carried out by end A. */
  outgoing: ToolPlace;
  /** The pocket's tool, carried in by end B. */
  incoming: ToolPlace;
};

const smooth = (u: number) => u * u * (3 - 2 * u);

/** The changer `elapsed` seconds into a change of `indexSeconds` + swap. */
export function changerPose(change: { index: number; indexSeconds: number }, elapsed: number): ChangerPose {
  const rest = { pocketDown: 0, arm: 0, armDown: 0, outgoing: "spindle", incoming: "pocket" } as const;
  if (elapsed < change.indexSeconds) {
    return { phase: "index", indexed: change.index * smooth(elapsed / change.indexSeconds), ...rest };
  }
  let t = Math.min(1, Math.max(0, (elapsed - change.indexSeconds) / TOOL_CHANGE_SECONDS));
  let phase: SwapPhase = "pocketUp";
  let u = 1;
  for (const [name, share] of SWAP) {
    phase = name;
    if (t <= share) {
      u = smooth(t / share);
      break;
    }
    t -= share;
  }
  const at = SWAP.findIndex(([name]) => name === phase);
  const after = (name: SwapPhase) => at > SWAP.findIndex(([n]) => n === name);
  // The arm holds both tools from the drawbar letting go to it clamping again.
  const carried = after("unclamp") && !after("clamp");
  const done = after("clamp");
  return {
    phase,
    indexed: change.index,
    pocketDown: phase === "pocketDown" ? u : phase === "pocketUp" ? 1 - u : 1,
    arm:
      phase === "pocketDown"
        ? 0
        : phase === "grip"
          ? -90 * u
          : phase === "swing"
            ? -90 - 180 * u
            : phase === "return"
              ? -270 + 90 * u
              : phase === "pocketUp"
                ? -180
                : after("swing")
                  ? -270
                  : -90,
    armDown: phase === "extract" ? u : phase === "swing" ? 1 : phase === "insert" ? 1 - u : 0,
    outgoing: carried ? "arm" : done ? "pocket" : "spindle",
    incoming: carried ? "arm" : done ? "spindle" : "pocket",
  };
}
