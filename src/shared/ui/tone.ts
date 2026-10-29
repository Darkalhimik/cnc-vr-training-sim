/**
 * The app's one tone scale. A tone is a *state*, never a kind — hue here
 * always answers "what condition is this in", so the same six tones can be
 * read the same way in the HUD, in a toast, and on a machine indicator.
 *
 * Translucent fill at /15 and ring at /30 read on either theme; the text takes
 * a light/dark shade pair (`-700` on white, `-300` on near-black) so a pill
 * stays legible in both without ever getting bright enough to compete with the
 * 3D scene behind it.
 *
 * Every status string in the product maps to a tone in exactly one place —
 * `TONE_OF` below. Add a state here, not at the call site.
 */
export type Tone = "emerald" | "amber" | "sky" | "rose" | "violet" | "zinc";

export const TONE_CLASSES: Record<Tone, string> = {
  emerald: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300",
  amber: "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300",
  sky: "bg-sky-500/15 text-sky-700 ring-sky-500/30 dark:text-sky-300",
  rose: "bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300",
  violet: "bg-violet-500/15 text-violet-700 ring-violet-500/30 dark:text-violet-300",
  zinc: "bg-zinc-500/15 text-zinc-700 ring-zinc-500/30 dark:text-zinc-300",
};

/** The same tones as text alone — for a label beside a pill, never instead
 *  of one: a coloured word still says which state it is in. */
export const TONE_TEXT: Record<Tone, string> = {
  emerald: "text-emerald-700 dark:text-emerald-300",
  amber: "text-amber-700 dark:text-amber-300",
  sky: "text-sky-700 dark:text-sky-300",
  rose: "text-rose-700 dark:text-rose-300",
  violet: "text-violet-700 dark:text-violet-300",
  zinc: "text-zinc-700 dark:text-zinc-300",
};

/** Tone as an outline only — for a panel that must keep its own themed
 *  background (anything floating over the dark 3D stage, where a /15 tint
 *  would leave the tone's text colour stranded on the wrong surface). */
export const TONE_RING: Record<Tone, string> = {
  emerald: "ring-emerald-500/40",
  amber: "ring-amber-500/40",
  sky: "ring-sky-500/40",
  rose: "ring-rose-500/40",
  violet: "ring-violet-500/40",
  zinc: "ring-zinc-500/40",
};

/** Machine and tutorial states, mapped once. */
export const TONE_OF: Record<string, Tone> = {
  // machine indicators (entities/machine/machine-indicators.ts)
  on: "emerald",
  off: "zinc",
  boot: "amber",
  free: "emerald",
  lock: "rose",
  clear: "emerald",
  alarm: "rose",
  shut: "emerald",
  open: "amber",
  homed: "emerald",
  homing: "sky",
  lost: "amber",
  mem: "zinc",
  jog: "sky",
  run: "emerald",
  hold: "amber",
  stop: "zinc",
  // tutorial progress
  done: "emerald",
  active: "sky",
  pending: "zinc",
  // notification kinds
  success: "emerald",
  info: "sky",
  warning: "amber",
  error: "rose",
};

export function toneOf(state: string): Tone {
  return TONE_OF[state.toLowerCase()] ?? "zinc";
}
