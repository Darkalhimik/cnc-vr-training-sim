"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MachineInfo } from "@/entities/catalog/machines";
import { CUTTER_KIND_LABEL, assemblyById, cribFor, type CutterKind } from "@/entities/tooling/catalog";
import { STANDARD_LOADOUT, checkLoadout, sortLoadout, toolFlags, type Loadout } from "@/entities/tooling/loadout";
import { showToast } from "@/shared/lib/notifications";
import { cn } from "@/shared/lib/cn";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { CloseIcon } from "@/shared/ui/icons";
import { loadoutFor, useToolingStore } from "../tooling-store";
import { toolLine } from "./crib-list";

const KINDS: CutterKind[] = ["face", "flat", "ball", "spot", "drill"];
const same = (a: Loadout, b: Loadout) =>
  a.length === b.length && sortLoadout(a).every((s, i) => s.number === sortLoadout(b)[i].number && s.assembly === sortLoadout(b)[i].assembly);

const selectClass =
  "h-7 min-w-0 rounded-md border bg-background px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * A machine's tool table, to set up from the crib: which tool is T1, T2…,
 * checked against the machine's spindle and changer as it is edited. Saved,
 * it is what free play runs the machine with.
 */
export function LoadoutEditor({
  machine,
  selected,
  onInspect,
}: {
  machine: MachineInfo;
  selected?: string | null;
  onInspect: (assembly: string) => void;
}) {
  const spec = machine.tooling;
  const saved = useToolingStore((s) => loadoutFor(machine.id, s.loadouts));
  const save = useToolingStore((s) => s.save);
  const [draft, setDraft] = useState<Loadout>(saved);
  const [busy, setBusy] = useState(false);
  const dirty = !same(draft, saved);

  // The saved loadout arriving (it loads after the page) or changing
  // elsewhere replaces the draft — unless the trainee has edited it since.
  const base = useRef(saved);
  useEffect(() => {
    if (saved === base.current) return;
    if (same(draft, base.current)) setDraft(saved);
    base.current = saved;
  }, [saved, draft]);

  const rows = sortLoadout(draft);
  const issues = useMemo(() => checkLoadout(draft, spec), [draft, spec]);
  const free = Array.from({ length: spec.pockets }, (_, i) => i + 1).filter((n) => !draft.some((s) => s.number === n));
  const crib = cribFor(spec.interface);
  const [number, setNumber] = useState<number>(free[0] ?? 0);
  const [assembly, setAssembly] = useState<string>("");
  useEffect(() => {
    if (!free.includes(number)) setNumber(free[0] ?? 0);
  }, [free, number]);

  const add = () => {
    if (!number || !assembly) return;
    setDraft(sortLoadout([...draft, { number, assembly }]));
    setAssembly("");
  };

  const commit = async () => {
    setBusy(true);
    const error = await save(machine.id, draft);
    setBusy(false);
    if (error) showToast(error, "warning");
    else showToast(`${machine.name} loadout saved. Free play runs with it; levels use the standard set.`, "success");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-tight">{machine.name} tool table</h2>
        <span className="font-mono text-xs text-muted-foreground">
          {draft.length}/{spec.pockets}
        </span>
      </div>

      <ul className="space-y-0.5">
        {rows.map((slot) => {
          const tool = assemblyById(slot.assembly);
          const flags = tool ? toolFlags(tool, spec) : null;
          const problem = issues.some((i) => i.number === slot.number);
          return (
            <li
              key={slot.number}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1",
                selected === slot.assembly && "bg-accent",
                problem && "ring-1 ring-inset ring-rose-500/40",
              )}
            >
              <span className="w-7 shrink-0 font-mono text-xs">T{slot.number}</span>
              <button type="button" onClick={() => onInspect(slot.assembly)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-xs hover:underline">{tool?.name ?? slot.assembly}</span>
                {tool && <span className="block truncate font-mono text-[10px] text-muted-foreground">{toolLine(tool)}</span>}
              </button>
              {flags?.large && <Badge tone="amber">L</Badge>}
              {flags?.heavy && !flags.large && <Badge tone="amber">H</Badge>}
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Unload T${slot.number}`}
                onClick={() => setDraft(draft.filter((s) => s.number !== slot.number))}
              >
                <CloseIcon />
              </Button>
            </li>
          );
        })}
        {rows.length === 0 && <li className="px-2 py-1 text-xs text-muted-foreground">The changer is empty.</li>}
      </ul>

      {free.length > 0 && (
        <div className="flex items-center gap-1.5">
          <select aria-label="Tool number" value={number} onChange={(e) => setNumber(Number(e.target.value))} className={cn(selectClass, "w-16")}>
            {free.map((n) => (
              <option key={n} value={n}>
                T{n}
              </option>
            ))}
          </select>
          <select aria-label="Tool from the crib" value={assembly} onChange={(e) => setAssembly(e.target.value)} className={cn(selectClass, "flex-1")}>
            <option value="">Load a tool…</option>
            {KINDS.map((kind) => (
              <optgroup key={kind} label={`${CUTTER_KIND_LABEL[kind]}s`}>
                {crib
                  .filter((t) => t.cutterSpec.kind === kind)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <Button size="md" variant="secondary" onClick={add} disabled={!assembly}>
            Load
          </Button>
        </div>
      )}

      {issues.length > 0 && (
        <ul className="space-y-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
          {issues.map((i, k) => (
            <li key={k}>{i.text}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <Button onClick={commit} disabled={!dirty || issues.length > 0 || busy}>
          {busy ? "Saving…" : "Save loadout"}
        </Button>
        {dirty && (
          <Button variant="ghost" onClick={() => setDraft(saved)}>
            Undo changes
          </Button>
        )}
        {!same(draft, STANDARD_LOADOUT) && (
          <Button variant="ghost" onClick={() => setDraft(STANDARD_LOADOUT)}>
            Standard set
          </Button>
        )}
      </div>

      <p className="text-xs/relaxed text-muted-foreground">
        {spec.interface} spindle, {spec.pockets}-pocket side-mount changer: up to Ø{spec.maxDiameter} mm with tools either side (Ø
        {spec.maxDiameterLarge} with both neighbours empty), {spec.maxLength} mm from the gauge line, {spec.maxMass} kg. Free play
        runs with this table; levels always use the shop&apos;s standard set, T1–T8. A tool new to a pocket has to be measured.
      </p>
    </div>
  );
}
