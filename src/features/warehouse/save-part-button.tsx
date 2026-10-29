"use client";

import Link from "next/link";
import { useState } from "react";
import type { MachineId } from "@/entities/catalog/machines";
import { useMachineStore } from "@/entities/machine/machine-store";
import { useJobStore } from "@/features/part-development/job-store";
import { useStockRegistry } from "@/features/part-development/stock-registry";
import { Button } from "@/shared/ui/button";
import { showToast } from "@/shared/lib/notifications";
import { savePart } from "./warehouse-api";

/**
 * Puts the stock in the vise on a shelf in the warehouse, as it is now. The
 * name starts as the job's; a task's part keeps its level and score.
 */
export function SavePartButton({
  machineId,
  levelId = null,
  score = null,
  size = "md",
}: {
  machineId: MachineId;
  levelId?: string | null;
  score?: number | null;
  size?: "sm" | "md";
}) {
  const stock = useMachineStore((s) => s.machine.stock);
  const removal = useStockRegistry((s) => s.removal);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  if (state === "saved") {
    return (
      <Link href="/warehouse" className="inline-flex h-7 items-center rounded-md border px-3 text-xs font-medium hover:bg-accent">
        In the warehouse →
      </Link>
    );
  }

  const save = async () => {
    if (!stock || !removal) return;
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
  };

  return (
    <Button size={size} variant="secondary" onClick={save} disabled={!stock || !removal || state === "saving"}>
      {state === "saving" ? "Saving…" : "Save to warehouse"}
    </Button>
  );
}
