"use client";

import type { MachineId } from "@/entities/catalog/machines";
import { levelsFor, type LevelKind } from "@/entities/catalog/levels";
import { useProgress } from "@/features/levels/progress";
import { cn } from "@/shared/lib/cn";
import { StarIcon } from "@/shared/ui/icons";

const TRACK_LABEL: Record<LevelKind, string> = { tutorial: "Tutorials", task: "Tasks" };

/** A thin meter: done over total, the fill in the foreground colour. */
export function Meter({ value, max, className }: { value: number; max: number; className?: string }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}>
      <div
        className="h-full rounded-full bg-foreground transition-[width]"
        style={{ width: `${max > 0 ? (100 * value) / max : 0}%` }}
      />
    </div>
  );
}

/**
 * How far the trainee is on one machine: each track as done/total with a
 * meter, and the stars earned. `compact` is the one-line version for a card.
 */
export function MachineProgress({ machineId, compact }: { machineId: MachineId; compact?: boolean }) {
  const progress = useProgress(machineId);
  const tracks = (["tutorial", "task"] as const).map((kind) => {
    const levels = levelsFor(machineId, kind);
    return { kind, total: levels.length, done: levels.filter((l) => progress.completed.has(l.id)).length };
  });

  if (compact) {
    const done = tracks.reduce((s, t) => s + t.done, 0);
    const total = tracks.reduce((s, t) => s + t.total, 0);
    return (
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-mono">
            {done}/{total} levels
          </span>
        </div>
        <Meter value={done} max={total} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tracks.map((t) => (
        <div key={t.kind} className="space-y-1.5">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">{TRACK_LABEL[t.kind]}</span>
            <span className="font-mono">
              {t.done}/{t.total}
            </span>
          </div>
          <Meter value={t.done} max={t.total} />
        </div>
      ))}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Stars</span>
        <span className="inline-flex items-center gap-1 font-mono">
          <StarIcon filled />
          {progress.stars}/{progress.maxStars}
        </span>
      </div>
    </div>
  );
}
