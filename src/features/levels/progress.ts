"use client";

import { useEffect, useMemo } from "react";
import { create } from "zustand";
import type { MachineId } from "@/entities/catalog/machines";
import { levelsFor, unlockedLevels } from "@/entities/catalog/levels";
import { ensureSession, useSession } from "@/shared/lib/auth-client";

/** A row of /api/progress, as JSON. */
export type LevelProgress = {
  levelId: string;
  completedAt: string | null;
  bestSeconds: number | null;
  bestScore: number | null;
  stars: number;
  attempts: number;
};

type Entry = { rows: LevelProgress[]; loaded: boolean; user: string | null };

type ProgressStore = {
  byMachine: Partial<Record<MachineId, Entry>>;
  load: (machineId: MachineId, user: string | null) => Promise<void>;
  upsert: (machineId: MachineId, row: LevelProgress) => void;
};

const useProgressStore = create<ProgressStore>((set, get) => ({
  byMachine: {},
  load: async (machineId, user) => {
    const entry = get().byMachine[machineId];
    if (entry?.loaded && entry.user === user) return;
    const response = await fetch(`/api/progress?machine=${machineId}`).catch(() => null);
    const rows: LevelProgress[] = response?.ok ? (await response.json()).progress : [];
    set((s) => ({ byMachine: { ...s.byMachine, [machineId]: { rows, loaded: true, user } } }));
  },
  upsert: (machineId, row) =>
    set((s) => {
      const entry = s.byMachine[machineId] ?? { rows: [], loaded: true, user: null };
      const rows = [...entry.rows.filter((r) => r.levelId !== row.levelId), row];
      return { byMachine: { ...s.byMachine, [machineId]: { ...entry, rows } } };
    }),
}));

/**
 * One machine's progress for the signed-in user (or guest), refetched when
 * the user changes, with what the level map and the machine page derive
 * from it.
 */
export function useProgress(machineId: MachineId) {
  const { data, isPending } = useSession();
  const user = data?.user.id ?? null;
  const entry = useProgressStore((s) => s.byMachine[machineId]);
  const load = useProgressStore((s) => s.load);

  useEffect(() => {
    if (!isPending) void load(machineId, user);
  }, [machineId, user, isPending, load]);

  return useMemo(() => {
    const rows = entry?.rows ?? [];
    const byLevel = new Map(rows.map((r) => [r.levelId, r]));
    const completed = new Set(rows.filter((r) => r.completedAt).map((r) => r.levelId));
    const unlocked = unlockedLevels(machineId, completed);
    const levels = levelsFor(machineId);
    const stars = rows.reduce((sum, r) => sum + r.stars, 0);
    return {
      loaded: entry?.loaded ?? false,
      byLevel,
      completed,
      unlocked,
      stars,
      maxStars: levels.length * 3,
      /** The first open level not done yet, tutorials before tasks. */
      next: levels.find((l) => unlocked.has(l.id) && !completed.has(l.id)) ?? null,
    };
  }, [entry, machineId]);
}

/**
 * Report an attempt. Signs the visitor in as a guest if nobody is, so a
 * first finished level is never lost. Returns the stars the server gave.
 */
export async function recordAttempt(
  machineId: MachineId,
  attempt: { levelId: string; completed: boolean; seconds?: number; score?: number },
): Promise<{ stars: number } | { error: string }> {
  if (!(await ensureSession())) return { error: "Could not start a guest session." };
  const response = await fetch("/api/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(attempt),
  }).catch(() => null);
  if (!response?.ok) {
    const body = await response?.json().catch(() => null);
    return { error: body?.error ?? "Progress could not be saved." };
  }
  const body = (await response.json()) as { progress: LevelProgress; stars: number };
  useProgressStore.getState().upsert(machineId, body.progress);
  return { stars: body.stars };
}
