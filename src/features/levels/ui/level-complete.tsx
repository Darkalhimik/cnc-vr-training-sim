"use client";

import Link from "next/link";
import { levelsFor } from "@/entities/catalog/levels";
import { machineById } from "@/entities/catalog/machines";
import { startLevel } from "@/features/world/world-session";
import { Button } from "@/shared/ui/button";
import { Stars } from "@/shared/ui/icons";
import { useLevelSession } from "../level-session";
import { useProgress } from "../progress";

const time = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/**
 * The end of a level: how it went, and where to go next — the next open
 * level, this one again, or the map.
 */
export function LevelComplete({ outro, children }: { outro?: string; children?: React.ReactNode }) {
  const level = useLevelSession((s) => s.level);
  const result = useLevelSession((s) => s.result);
  const error = useLevelSession((s) => s.error);
  const restart = useLevelSession((s) => s.restart);
  const progress = useProgress(level?.machineId ?? "umc500");
  if (!level || !result) return null;
  const machine = machineById(level.machineId)!;
  const track = levelsFor(level.machineId);
  const next = track.slice(track.indexOf(level) + 1).find((l) => progress.unlocked.has(l.id) && !progress.completed.has(l.id));

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold tracking-tight">{level.kind === "task" ? "Part measured" : "Tutorial complete"}</h4>
        {outro && <p className="text-xs/relaxed text-muted-foreground">{outro}</p>}
      </div>
      <dl className="grid grid-cols-3 gap-2 rounded-md border p-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Time</dt>
          <dd className="font-mono">{time(result.seconds)}</dd>
        </div>
        {result.score !== undefined && (
          <div>
            <dt className="text-muted-foreground">Score</dt>
            <dd className="font-mono">{result.score}%</dd>
          </div>
        )}
        <div>
          <dt className="text-muted-foreground">Stars</dt>
          <dd className="h-4">{result.stars === null ? <span className="text-muted-foreground">…</span> : <Stars value={result.stars} />}</dd>
        </div>
      </dl>
      {error && <p className="text-xs text-amber-700 dark:text-amber-300">{error}</p>}
      {children}
      <div className="flex flex-wrap gap-2">
        {next && (
          <Button size="md" onClick={() => startLevel(next.id)}>
            Next: {next.title}
          </Button>
        )}
        <Button size="md" variant="secondary" onClick={restart}>
          Play again
        </Button>
        <Link
          href={`/machines/${machine.slug}/levels?level=${encodeURIComponent(level.id)}`}
          className="inline-flex h-7 items-center rounded-md px-3 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          Level map
        </Link>
      </div>
    </div>
  );
}
