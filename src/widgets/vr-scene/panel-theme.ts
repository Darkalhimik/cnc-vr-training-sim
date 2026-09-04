/**
 * The 3D boards' palette — the DOM token set, resolved to hex because a
 * three.js material cannot read a CSS variable.
 *
 * Keep this the single place the VR panels take colour from: the boards mirror
 * the DOM HUD, so a tone that drifts here makes the same machine state read
 * two different ways depending on which surface the operator is looking at.
 * Values track the dark theme in src/app/globals.css.
 */
export const PANEL = {
  /** --card */
  surface: "#18181b",
  /** --border, opened up enough for a wireframe edge to actually read */
  edge: "#3f3f46",
  /** --muted */
  control: "#27272a",
  controlHover: "#3f3f46",
  controlDisabled: "#1c1c1f",
  /** --foreground / --muted-foreground */
  text: "#fafafa",
  textMuted: "#a1a1aa",
} as const;

/** The tone scale from src/shared/ui/tone.ts, at *-400. */
export const TONE = {
  emerald: "#34d399",
  amber: "#fbbf24",
  sky: "#38bdf8",
  rose: "#fb7185",
  violet: "#a78bfa",
  zinc: "#71717a",
} as const;

export type PanelTone = keyof typeof TONE;

/** Machine and tutorial states, mapped once — mirrors TONE_OF on the DOM side. */
const TONE_OF: Record<string, PanelTone> = {
  on: "emerald",
  off: "zinc",
  free: "emerald",
  lock: "rose",
  shut: "emerald",
  open: "amber",
  done: "emerald",
  active: "sky",
  pending: "zinc",
};

export function toneOf(state: string): string {
  return TONE[TONE_OF[state.toLowerCase()] ?? "zinc"];
}
