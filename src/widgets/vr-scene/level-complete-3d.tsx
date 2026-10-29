"use client";

import { useState } from "react";
import type { MachineId } from "@/entities/catalog/machines";
import { useMachineStore } from "@/entities/machine/machine-store";
import { savePart } from "@/features/warehouse/warehouse-api";
import { useLevelSession } from "@/features/levels/level-session";
import { useJobStore } from "@/features/part-development/job-store";
import { useStockRegistry } from "@/features/part-development/stock-registry";
import { showToast } from "@/shared/lib/notifications";
import { buttonsRow, statsRow, textRow, type ButtonVariant, type Row } from "./board-kit";
import { useBoardNavigation, useNextLevel } from "./board-navigation";

const time = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

type Button = { label: string; onPress: () => void; disabled?: boolean; variant?: ButtonVariant };

/**
 * Save to warehouse, for a board: the same as the side panel's button — the
 * stock in the vise as it is now, under the job's name.
 */
export function useSavePart(machineId: MachineId, levelId: string | null = null, score: number | null = null): Button | null {
  const stock = useMachineStore((s) => s.machine.stock);
  const removal = useStockRegistry((s) => s.removal);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  if (!stock) return null;
  return {
    label: state === "saved" ? "In the warehouse" : state === "saving" ? "Saving…" : "Save to warehouse",
    disabled: !removal || state !== "idle",
    onPress: async () => {
      if (!removal) return;
      setState("saving");
      const { design, program } = useJobStore.getState();
      const field = await removal.exportField().catch(() => null);
      if (!field) {
        setState("idle");
        return showToast("The part could not be read from the machine.", "error");
      }
      const result = await savePart({
        machineId,
        name: design.name,
        material: stock.material,
        stock: stock.size,
        program,
        design,
        levelId,
        score,
        field,
      });
      if ("error" in result) {
        setState("idle");
        return showToast(result.error, "warning");
      }
      setState("saved");
      showToast(`"${result.part.name}" is on a shelf in your warehouse.`, "success");
    },
  };
}

/**
 * The end of a level as board rows: how it went, the caller's own lines
 * (a task's measurement), then where to go — next level, again, the map.
 */
export function useCompletionRows(width: number, opts: { outro?: string; extra?: Row[]; actions?: Button[] }): Row[] {
  const level = useLevelSession((s) => s.level);
  const result = useLevelSession((s) => s.result);
  const error = useLevelSession((s) => s.error);
  const restart = useLevelSession((s) => s.restart);
  const next = useNextLevel();
  const nav = useBoardNavigation();
  if (!level || !result) return [];

  const stats = [
    { label: "Time", value: time(result.seconds) },
    ...(result.score !== undefined ? [{ label: "Score", value: `${result.score}%` }] : []),
    { label: "Stars", value: { stars: result.stars } },
  ];
  return [
    textRow(level.kind === "task" ? "Part measured" : "Tutorial complete", "title", width),
    ...(opts.outro ? [textRow(opts.outro, "muted", width)] : []),
    statsRow(stats, width),
    ...(opts.extra ?? []),
    ...(error ? [textRow(error, "muted", width)] : []),
    ...(opts.actions?.length ? [buttonsRow(opts.actions, width)] : []),
    buttonsRow(
      [
        ...(next ? [{ label: `Next: ${next.title}`, onPress: () => nav.toLevel(next), variant: "primary" as const }] : []),
        { label: "Play again", onPress: restart },
        { label: "Level map", onPress: () => void nav.toMap() },
      ],
      width,
    ),
  ];
}
