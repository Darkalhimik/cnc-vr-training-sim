/**
 * The levels of each machine: tutorials, which teach one procedure step by
 * step, and tasks, which hand over a drawing and a blank and score the part
 * that comes off the machine.
 *
 * Plain data, shared by the level map, the play screen and the API (which
 * only accepts progress for a level listed here). What a level does — its
 * steps, its part, its scoring — lives with the feature that runs it and is
 * looked up by id: src/features/levels/.
 */
import type { MachineId } from "./machines";

export type LevelKind = "tutorial" | "task";

export type LevelInfo = {
  /** Unique across machines: `<machine>.<kind>.<name>`. */
  id: string;
  machineId: MachineId;
  kind: LevelKind;
  title: string;
  /** One sentence: what the trainee will be able to do after it. */
  goal: string;
  /** What it practises, as short tags on the detail card. */
  skills: string[];
  /** Expected time for a first attempt, minutes. */
  minutes: number;
  /** Time for full marks, seconds. */
  parSeconds: number;
  /** Levels that must be completed first (besides the previous one in its track). */
  requires?: string[];
};

export const LEVELS: LevelInfo[] = [
  // ------------------------------------------------------------ tutorials
  {
    id: "umc500.tutorial.startup",
    machineId: "umc500",
    kind: "tutorial",
    title: "Machine startup",
    goal: "Bring the machine from a cold shift start to homed and warmed up.",
    skills: ["Air and mains", "E-stop and RESET", "Zero return", "Warm-up"],
    minutes: 6,
    parSeconds: 240,
  },
  {
    id: "umc500.tutorial.jog",
    machineId: "umc500",
    kind: "tutorial",
    title: "Jogging",
    goal: "Move every axis with the handwheel at the increment the job needs.",
    skills: ["HANDLE JOG", "Axis select", "Increments", "Trunnion B/C"],
    minutes: 4,
    parSeconds: 150,
  },
  {
    id: "umc500.tutorial.work-offset",
    machineId: "umc500",
    kind: "tutorial",
    title: "Part zero (G54)",
    goal: "Clamp a blank and set G54 at its top-face centre.",
    skills: ["Vise", "OFFSET page", "PART ZERO SET", "F1 / ENTER"],
    minutes: 6,
    parSeconds: 300,
  },
  {
    id: "umc500.tutorial.tool-length",
    machineId: "umc500",
    kind: "tutorial",
    title: "Tool lengths",
    goal: "Touch tools off on the part and store their length offsets.",
    skills: ["NEXT TOOL", "Fine increments", "TOOL OFFSET MEASURE"],
    minutes: 6,
    parSeconds: 300,
  },
  {
    id: "umc500.tutorial.mdi",
    machineId: "umc500",
    kind: "tutorial",
    title: "MDI commands",
    goal: "Type blocks at the control and run them: move, start and stop the spindle.",
    skills: ["MDI", "G00 G90 G54", "S M03 / M05", "CYCLE START"],
    minutes: 5,
    parSeconds: 240,
  },
  {
    id: "umc500.tutorial.first-program",
    machineId: "umc500",
    kind: "tutorial",
    title: "Running a program",
    goal: "Load a program, prove it out block by block, then run it.",
    skills: ["LIST PROGRAM", "SINGLE BLOCK", "FEED HOLD", "Rapid override"],
    minutes: 8,
    parSeconds: 420,
  },
  {
    id: "umc500.tutorial.gcode-basics",
    machineId: "umc500",
    kind: "tutorial",
    title: "Lines and arcs",
    goal: "Write a program with G01, G02 and G03 and cut it.",
    skills: ["Program structure", "G01", "G02 / G03", "Tool and spindle"],
    minutes: 10,
    parSeconds: 600,
  },

  // ------------------------------------------------------------ tasks
  {
    id: "umc500.task.face",
    machineId: "umc500",
    kind: "task",
    title: "Face the blank",
    goal: "Take 1 mm off the top of the blank with the face mill.",
    skills: ["T1 face mill", "Step-over", "G01"],
    minutes: 8,
    parSeconds: 480,
    requires: ["umc500.tutorial.startup"],
  },
  {
    id: "umc500.task.holes",
    machineId: "umc500",
    kind: "task",
    title: "Hole pattern",
    goal: "Spot and drill four holes on a rectangular pattern.",
    skills: ["G81 / G83", "Spot drill", "Hole positions"],
    minutes: 10,
    parSeconds: 600,
  },
  {
    id: "umc500.task.pocket",
    machineId: "umc500",
    kind: "task",
    title: "Pocket",
    goal: "Mill a 30 × 20 mm pocket with 5 mm corners, 6 mm deep.",
    skills: ["Step-down", "Arcs in corners", "Ramping in"],
    minutes: 15,
    parSeconds: 900,
  },
  {
    id: "umc500.task.profile",
    machineId: "umc500",
    kind: "task",
    title: "Outside profile",
    goal: "Profile the outside to 70 × 50 mm with R6 corners using cutter compensation.",
    skills: ["G41 / G40", "D offset", "Lead-in arcs"],
    minutes: 15,
    parSeconds: 900,
  },
  {
    id: "umc500.task.side-slot",
    machineId: "umc500",
    kind: "task",
    title: "Side slot (3+2)",
    goal: "Tilt the part and cut a slot in its front face.",
    skills: ["B / C indexing", "G254", "Side features"],
    minutes: 15,
    parSeconds: 900,
  },
];

export const levelById = (id: string) => LEVELS.find((l) => l.id === id) ?? null;
export const levelsFor = (machineId: MachineId, kind?: LevelKind) =>
  LEVELS.filter((l) => l.machineId === machineId && (!kind || l.kind === kind));

/** Short name for a node on the level map. */
export const levelShortTitle = (l: LevelInfo) => l.title.replace(/\s*\(.*\)$/, "");

/**
 * Which levels are open, given the ids completed: a track is played in order,
 * and `requires` adds prerequisites from the other track.
 */
export function unlockedLevels(machineId: MachineId, completed: ReadonlySet<string>): Set<string> {
  const open = new Set<string>();
  for (const kind of ["tutorial", "task"] as const) {
    const track = levelsFor(machineId, kind);
    track.forEach((level, i) => {
      const previous = i === 0 || completed.has(track[i - 1].id);
      const requires = (level.requires ?? []).every((id) => completed.has(id));
      if (previous && requires) open.add(level.id);
    });
  }
  return open;
}

/** Stars for a finished level: full marks for par or better, then by score. */
export function starsFor(level: LevelInfo, seconds: number, score: number | null): number {
  if (level.kind === "task") {
    if (score === null || score < 60) return score !== null && score >= 40 ? 1 : 0;
    return score >= 95 && seconds <= level.parSeconds * 1.5 ? 3 : score >= 85 ? 2 : 1;
  }
  return seconds <= level.parSeconds ? 3 : seconds <= level.parSeconds * 2 ? 2 : 1;
}
