"use client";

import { useRouter } from "next/navigation";
import { useXR } from "@react-three/xr";
import { levelsFor, type LevelInfo } from "@/entities/catalog/levels";
import { machineById } from "@/entities/catalog/machines";
import { useLevelSession } from "@/features/levels/level-session";
import { useProgress } from "@/features/levels/progress";
import { startLevel } from "@/features/world/world-session";

/**
 * Leaving a level from a board. Another level keeps the immersive session —
 * the workshop stays mounted and just loads it. The level map is a page
 * without a canvas, so the session is ended first; otherwise the headset
 * keeps showing the last frame of a scene that no longer exists.
 */
export function useBoardNavigation() {
  const router = useRouter();
  const session = useXR((s) => s.session);
  const level = useLevelSession((s) => s.level);
  const slug = machineById(level?.machineId ?? "umc500")?.slug ?? "umc-500";

  return {
    toLevel: (next: LevelInfo) => startLevel(next.id),
    toMap: async () => {
      if (session) await session.end().catch(() => {});
      router.push(`/machines/${slug}/levels${level ? `?level=${encodeURIComponent(level.id)}` : ""}`);
    },
  };
}

/** The next open level after the current one that is not done yet. */
export function useNextLevel(): LevelInfo | null {
  const level = useLevelSession((s) => s.level);
  const progress = useProgress(level?.machineId ?? "umc500");
  if (!level) return null;
  const all = levelsFor(level.machineId);
  return all.slice(all.indexOf(level) + 1).find((l) => progress.unlocked.has(l.id) && !progress.completed.has(l.id)) ?? null;
}
