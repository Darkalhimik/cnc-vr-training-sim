"use client";

import { levelsFor, type LevelInfo } from "@/entities/catalog/levels";
import { MACHINES, type MachineInfo } from "@/entities/catalog/machines";
import { useWarehouseStore } from "@/features/warehouse/warehouse-api";
import { useLevelSession } from "@/features/levels/level-session";
import { useProgress } from "@/features/levels/progress";
import { startLevel } from "@/features/world/world-session";
import { PANEL, TONE } from "@/widgets/vr-scene/panel-theme";
import { BUTTON_H, PAD, StackBoard, linesHeight, textRow, type Row } from "@/widgets/vr-scene/board-kit";

const TERMINAL_W = 1.6;
const TERMINAL_INNER = TERMINAL_W - 2 * PAD;
const LEVEL_ROW_H = BUTTON_H;
const STAR_R = 0.016;

type Progress = ReturnType<typeof useProgress>;

/** One level: a state dot, its title, its stars, and Start. */
function levelRow(level: LevelInfo, index: number, progress: Progress, active: string | null): Row {
  const done = progress.completed.has(level.id);
  const open = progress.unlocked.has(level.id);
  const next = progress.next?.id === level.id;
  const stars = progress.byLevel.get(level.id)?.stars ?? 0;
  const playing = active === level.id;
  const color = playing ? TONE.sky : done ? TONE.emerald : next ? PANEL.text : open ? PANEL.textMuted : PANEL.controlHover;
  const buttonW = 0.26;
  return {
    h: LEVEL_ROW_H,
    gap: 0.016,
    paint: (p, x, y) => {
      const mid = y + LEVEL_ROW_H / 2;
      p.circle(x + 0.018, mid, 0.014, color);
      p.text(`${index + 1}. ${level.title}`, x + 0.05, mid - linesHeight(1, "body") / 2, "body", {
        color: open ? PANEL.text : PANEL.textMuted,
      });
      const starsX = x + TERMINAL_INNER - buttonW - 0.04 - 3 * 0.04;
      if (done) for (let i = 0; i < 3; i++) p.star(starsX + i * 0.04 + STAR_R, mid, STAR_R, i < stars);
      p.button(playing ? "Playing" : done ? "Again" : "Start", x + TERMINAL_INNER - buttonW, y, buttonW, () => startLevel(level.id), {
        variant: next && !playing ? "primary" : "secondary",
        disabled: !open || playing,
      });
    },
  };
}

function machineRows(machine: MachineInfo, progress: Progress, active: string | null): Row[] {
  const rows: Row[] = [textRow(`${machine.maker} ${machine.name}`.toUpperCase(), "caption", TERMINAL_INNER, { gap: 0.02 })];
  for (const kind of ["tutorial", "task"] as const) {
    const levels = levelsFor(machine.id, kind);
    const done = levels.filter((l) => progress.completed.has(l.id)).length;
    rows.push(textRow(`${kind === "tutorial" ? "Tutorials" : "Tasks"}  ${done}/${levels.length}`, "muted", TERMINAL_INNER, { gap: 0.014 }));
    levels.forEach((l, i) => rows.push(levelRow(l, i, progress, active)));
  }
  return rows;
}

/**
 * The level terminal in the lobby: every level of every machine, with Start.
 * Starting one takes the trainee to its machine without leaving the headset
 * session. Free play ends whatever level is running.
 */
export function LevelTerminalBoard() {
  // One machine today; a hook per machine would need a fixed count anyway.
  const machine = MACHINES[0];
  const progress = useProgress(machine.id);
  const active = useLevelSession((s) => s.level?.id ?? null);
  const rows: Row[] = [
    textRow("Levels", "title", TERMINAL_INNER, { gap: 0.012 }),
    textRow("Tutorials teach one procedure; tasks measure the part you make.", "muted", TERMINAL_INNER, { gap: 0.04 }),
    ...machineRows(machine, progress, active),
    {
      h: BUTTON_H,
      paint: (p, x, y) =>
        p.button("Free play", x, y, 0.4, () => startLevel(null), { variant: active ? "primary" : "secondary" }),
    },
  ];
  return <StackBoard width={TERMINAL_W} rows={rows} />;
}

/** The terminal: a pedestal with the board angled back on top of it. */
export function LevelTerminal() {
  return (
    <group>
      <mesh position={[0, 0.5, -0.05]}>
        <boxGeometry args={[0.7, 1, 0.45]} />
        <meshStandardMaterial color="#2c3036" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.02, -0.05]}>
        <boxGeometry args={[0.78, 0.04, 0.5]} />
        <meshStandardMaterial color="#3a3f46" metalness={0.5} roughness={0.45} />
      </mesh>
      {/* The board hangs from its top edge, tilted back like a lectern. */}
      <group position={[0, 2.55, -0.18]} rotation={[-0.12, 0, 0]}>
        <LevelTerminalBoard />
      </group>
    </group>
  );
}

const WALL_W = 2.6;
const WALL_INNER = WALL_W - 2 * PAD;

/** The progress wall by the shop door: how far the trainee is, at a glance. */
export function ProgressWall() {
  const machine = MACHINES[0];
  const progress = useProgress(machine.id);
  const parts = useWarehouseStore((s) => s.parts);
  const tutorials = levelsFor(machine.id, "tutorial");
  const tasks = levelsFor(machine.id, "task");
  const count = (levels: LevelInfo[]) => levels.filter((l) => progress.completed.has(l.id)).length;
  const meter = (label: string, done: number, total: number): Row => ({
    h: 0.1,
    paint: (p, x, y) => {
      p.text(label, x, y, "muted");
      p.text(`${done}/${total}`, x + WALL_INNER, y, "value", { align: "right" });
      p.rect(x, y + 0.072, WALL_INNER, 0.016, PANEL.control, { radius: 0.008 });
      if (done > 0) p.rect(x, y + 0.072, (WALL_INNER * done) / total, 0.016, PANEL.text, { radius: 0.008 });
    },
  });
  const rows: Row[] = [
    textRow(`${machine.maker} ${machine.name}`.toUpperCase(), "caption", WALL_INNER, { gap: 0.012 }),
    textRow("Your progress", "title", WALL_INNER, { gap: 0.04 }),
    meter("Tutorials", count(tutorials), tutorials.length),
    meter("Tasks", count(tasks), tasks.length),
    {
      h: 0.06,
      paint: (p, x, y) => {
        p.text("Stars", x, y, "muted");
        p.text(`${progress.stars} / ${progress.maxStars}`, x + WALL_INNER, y, "value", { align: "right" });
      },
    },
    textRow(progress.next ? `Next up: ${progress.next.title}` : "Every level done.", "body", WALL_INNER, { gap: 0.04 }),
    textRow(
      parts.length ? `In the warehouse: ${parts.slice(0, 3).map((p) => p.name).join(", ")}${parts.length > 3 ? ` and ${parts.length - 3} more` : ""}` : "The warehouse is empty: cut a part and put it on a shelf.",
      "muted",
      WALL_INNER,
    ),
  ];
  return <StackBoard width={WALL_W} rows={rows} anchor="center" />;
}
