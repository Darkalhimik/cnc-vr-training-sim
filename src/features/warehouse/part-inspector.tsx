"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { levelById } from "@/entities/catalog/levels";
import { machineById } from "@/entities/catalog/machines";
import type { PartDesign } from "@/entities/part/part-design";
import { MATERIALS, type StockMaterial } from "@/entities/part/tool-library";
import { useLevelSession } from "@/features/levels/level-session";
import { createStockRemoval } from "@/features/part-development/removal";
import { showToast } from "@/shared/lib/notifications";
import { Button } from "@/shared/ui/button";
import { CloseIcon } from "@/shared/ui/icons";
import { deletePart, getPart, getPartField, renamePart, type PartDetail, type PartSummary } from "./warehouse-api";

export const partSize = (p: PartSummary) => p.stock.join(" × ");
const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const minutes = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

async function downloadStl(part: PartSummary) {
  const removal = createStockRemoval();
  try {
    await removal.load(await getPartField(part.id, "full"));
    const url = URL.createObjectURL(await removal.exportStl());
    const a = document.createElement("a");
    a.href = url;
    a.download = `${part.name.replace(/\W+/g, "-").toLowerCase() || "part"}.stl`;
    a.click();
    URL.revokeObjectURL(url);
  } finally {
    removal.dispose();
  }
}

/** The selected part: what it is, where it came from, and what to do with it. */
export function PartInspector({ part, onClose }: { part: PartSummary; onClose: () => void }) {
  const router = useRouter();
  const [detail, setDetail] = useState<PartDetail | null>(null);
  const [name, setName] = useState(part.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const level = part.levelId ? levelById(part.levelId) : null;
  const machine = machineById(part.machineId);

  useEffect(() => {
    setName(part.name);
    setConfirmDelete(false);
    let cancelled = false;
    void getPart(part.id).then((d) => !cancelled && setDetail(d));
    return () => {
      cancelled = true;
    };
  }, [part.id, part.name]);

  const commitName = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === part.name) return setName(part.name);
    const error = await renamePart(part.id, trimmed);
    if (error) showToast(error, "warning");
  };

  /** Free play opens with this part's design and program as its job. */
  const openInFreePlay = () => {
    if (!detail || !machine) return;
    const design: PartDesign =
      (detail.design as PartDesign | null) ?? {
        name: detail.name,
        programNumber: 1001,
        stock: { x: part.stock[0], y: part.stock[1], z: part.stock[2], material: part.material as StockMaterial },
        features: [],
      };
    useLevelSession.setState({ freeplayJob: { design, program: detail.program, edited: true } });
    router.push(`/world/desktop?at=${machine.id}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          aria-label="Part name"
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-lg font-semibold tracking-tight outline-none hover:border-border focus-visible:border-border"
        />
        <Button size="sm" variant="ghost" onClick={onClose} aria-label="Back to the warehouse">
          <CloseIcon />
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Material</dt>
          <dd>{MATERIALS[part.material as StockMaterial]?.label ?? part.material}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Blank</dt>
          <dd className="font-mono">{partSize(part)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Machine</dt>
          <dd>{machine ? `${machine.maker} ${machine.name}` : part.machineId}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Saved</dt>
          <dd>{date(part.createdAt)}</dd>
        </div>
        {part.volumeMm3 !== null && (
          <div>
            <dt className="text-muted-foreground">Material left</dt>
            <dd className="font-mono">{(part.volumeMm3 / 1000).toFixed(1)} cm³</dd>
          </div>
        )}
        <div>
          <dt className="text-muted-foreground">Made in</dt>
          <dd>{level ? level.title : "Free play"}</dd>
        </div>
        {part.score !== null && (
          <div>
            <dt className="text-muted-foreground">Score</dt>
            <dd className="font-mono">{part.score}%</dd>
          </div>
        )}
        {part.cycleSeconds !== null && (
          <div>
            <dt className="text-muted-foreground">Cycle</dt>
            <dd className="font-mono">{minutes(part.cycleSeconds)}</dd>
          </div>
        )}
      </dl>

      {detail && (
        <details className="rounded-md border">
          <summary className="cursor-pointer px-3 py-2 text-xs">
            Program <span className="font-mono text-muted-foreground">{detail.program.split("\n").length} lines</span>
          </summary>
          <pre className="max-h-64 overflow-auto border-t px-3 py-2 font-mono text-[11px]/[16px] text-muted-foreground">
            {detail.program}
          </pre>
        </details>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="md" onClick={openInFreePlay} disabled={!detail}>
          Open in free play
        </Button>
        <Button
          size="md"
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await downloadStl(part).catch(() => showToast("The STL could not be made.", "error"));
            setBusy(false);
          }}
        >
          {busy ? "Preparing…" : "Download STL"}
        </Button>
        <Button
          size="md"
          variant={confirmDelete ? "danger" : "ghost"}
          onClick={async () => {
            if (!confirmDelete) return setConfirmDelete(true);
            const error = await deletePart(part.id);
            if (error) return showToast(error, "warning");
            onClose();
          }}
        >
          {confirmDelete ? "Remove for good" : "Remove"}
        </Button>
      </div>
      <p className="text-[11px]/relaxed text-muted-foreground">Drag to turn the part, scroll to come closer.</p>
    </div>
  );
}

