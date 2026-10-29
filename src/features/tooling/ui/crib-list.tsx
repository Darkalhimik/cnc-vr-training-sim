"use client";

import type { MachineInfo } from "@/entities/catalog/machines";
import { CRIB, CUTTER_KIND_LABEL, type AssembledTool, type CutterKind } from "@/entities/tooling/catalog";
import { cn } from "@/shared/lib/cn";
import { loadoutFor, useToolingStore } from "../tooling-store";

const ORDER: CutterKind[] = ["face", "flat", "ball", "spot", "drill"];

/** One line of numbers about a tool: diameter, length, holder. */
export const toolLine = (t: AssembledTool) =>
  `Ø${t.cutterSpec.diameter} · L${t.length} · ${t.holderSpec.name.replace(/^CT40 /, "")}`;

/**
 * The crib as a list, grouped by what the cutters do. A tool loaded in the
 * machine is out of the crib: greyed, with the tool number it has there —
 * as it stands in the 3D crib, a pale ghost.
 */
export function CribList({
  machine,
  selected,
  onSelect,
}: {
  machine: MachineInfo;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const loadouts = useToolingStore((s) => s.loadouts);
  const loaded = new Map(loadoutFor(machine.id, loadouts).map((s) => [s.assembly, s.number]));
  return (
    <div className="space-y-3">
      <p className="px-2 text-xs/relaxed text-muted-foreground">
        Greyed tools are out of the crib, loaded in the {machine.name} — its tool number on the right. In the 3D crib they
        stand as pale ghosts.
      </p>
      {ORDER.map((kind) => {
        const tools = CRIB.filter((t) => t.cutterSpec.kind === kind);
        if (!tools.length) return null;
        return (
          <section key={kind} className="space-y-1">
            <h3 className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {CUTTER_KIND_LABEL[kind]}s
            </h3>
            <ul className="space-y-0.5">
              {tools.map((t) => {
                const number = loaded.get(t.id);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(t.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent",
                        selected === t.id && "bg-accent",
                      )}
                    >
                      <span className={cn("min-w-0 flex-1", number !== undefined && "opacity-55")}>
                        <span className="block truncate text-xs">{t.name}</span>
                        <span className="block truncate font-mono text-[10px] text-muted-foreground">{toolLine(t)}</span>
                      </span>
                      {number !== undefined && (
                        <span className="shrink-0 rounded bg-sky-500/15 px-1.5 py-0.5 font-mono text-[10px] text-sky-700 dark:text-sky-300">
                          {machine.name} T{number}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
