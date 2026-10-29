"use client";

import { levelById } from "@/entities/catalog/levels";
import { MACHINES } from "@/entities/catalog/machines";
import { useLevelSession } from "@/features/levels/level-session";
import { machineStation, useWorldStore } from "./world-store";

/**
 * Start a level — or free play, with null — from inside the workshop. The
 * page does not change: a headset session would end with it. The URL is
 * rewritten in place so a reload comes back to the same level, and the
 * trainee is taken to the level's machine.
 */
export function startLevel(levelId: string | null) {
  const level = levelId ? levelById(levelId) : null;
  useLevelSession.getState().enter(level ? level.kind : "freeplay", level?.id ?? null);

  const url = new URL(window.location.href);
  if (level) url.searchParams.set("level", level.id);
  else url.searchParams.delete("level");
  url.searchParams.delete("at");
  window.history.replaceState(window.history.state, "", url);

  const station = machineStation(level?.machineId ?? MACHINES[0].id);
  if (station) useWorldStore.getState().goTo(station.id);
}
