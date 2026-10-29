"use client";

import { useState } from "react";
import type { MachineInfo } from "@/entities/catalog/machines";
import { loadoutTools } from "@/entities/part/tool-library";
import {
  CUTTER_KIND_LABEL,
  CUTTER_MATERIAL_LABEL,
  HOLDER_CLAMPING,
  HOLDER_KIND_LABEL,
  type AssembledTool,
} from "@/entities/tooling/catalog";
import { toolFlags } from "@/entities/tooling/loadout";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { CloseIcon } from "@/shared/ui/icons";
import { loadoutFor, useToolingStore } from "../tooling-store";
import { ToolViewer } from "./tool-viewer";

const mm = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)} mm`;

function Specs({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide">{title}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-mono">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Where a tool is loaded and whether it fits, on each machine shown. */
function Fit({ tool, machine }: { tool: AssembledTool; machine: MachineInfo }) {
  const loadouts = useToolingStore((s) => s.loadouts);
  const spec = machine.tooling;
  const slot = loadoutFor(machine.id, loadouts).find((s) => s.assembly === tool.id);
  const flags = toolFlags(tool, spec);
  const fits =
    tool.holderSpec.interface === spec.interface &&
    tool.length <= spec.maxLength &&
    tool.mass <= spec.maxMass &&
    tool.cutterSpec.diameter <= spec.maxDiameterLarge;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{machine.name}</span>
      {slot ? <Badge tone="sky">T{slot.number}</Badge> : <Badge>not loaded</Badge>}
      {!fits && <Badge tone="rose">does not fit</Badge>}
      {fits && flags.large && <Badge tone="amber">large · empty neighbours</Badge>}
      {fits && flags.heavy && !flags.large && <Badge tone="amber">heavy</Badge>}
    </div>
  );
}

/**
 * One tool of the crib: a close-up to turn and pull apart, then the holder,
 * the cutter and the assembly they make, and where it is loaded.
 */
export function ToolDetails({
  tool,
  machines,
  onClose,
  viewer = true,
}: {
  tool: AssembledTool;
  machines: MachineInfo[];
  onClose?: () => void;
  /** Off where a larger viewer already shows the tool. */
  viewer?: boolean;
}) {
  const [exploded, setExploded] = useState(false);
  const h = tool.holderSpec;
  const c = tool.cutterSpec;
  const shown = loadoutTools([{ number: 0, assembly: tool.id }])[0];
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{CUTTER_KIND_LABEL[c.kind]}</p>
          <h2 className="text-lg font-semibold tracking-tight">{tool.name}</h2>
        </div>
        {onClose && (
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Back to the list">
            <CloseIcon />
          </Button>
        )}
      </div>

      {viewer && (
        <div className="space-y-1.5">
          <ToolViewer tool={shown} exploded={exploded} labels={false} className="h-44" />
          <Button size="sm" variant="secondary" onClick={() => setExploded((e) => !e)}>
            {exploded ? "Assemble" : "Take apart"}
          </Button>
        </div>
      )}

      <div className="space-y-1.5">
        {machines.map((m) => (
          <Fit key={m.id} tool={tool} machine={m} />
        ))}
      </div>

      <Specs
        title="Assembled"
        rows={[
          ["Gauge line to tip", mm(tool.length)],
          ["Stick-out", mm(tool.stickout)],
          ["Mass", `${tool.mass.toFixed(2)} kg`],
        ]}
      />
      <Specs
        title="Cutter"
        rows={[
          ["Diameter", mm(c.diameter)],
          [c.kind === "face" ? "Inserts" : "Flutes", c.flutes],
          ["Cutting length", mm(c.fluteLength)],
          ["Overall length", mm(c.overallLength)],
          [c.kind === "face" ? "Arbor bore" : "Shank", mm(c.shank)],
          ...(c.tipAngle ? ([["Point angle", `${c.tipAngle}°`]] as [string, React.ReactNode][]) : []),
          ["Material", CUTTER_MATERIAL_LABEL[c.material]],
          ["Coating", c.coating],
        ]}
      />
      <section className="space-y-1.5">
        <Specs
          title="Holder"
          rows={[
            ["Type", HOLDER_KIND_LABEL[h.kind]],
            ["Taper", h.interface],
            ["Gauge length", mm(h.gaugeLength)],
            ["Nose", `Ø${h.noseDiameter} mm`],
            ["Clamps", h.clamps[0] === h.clamps[1] ? `Ø${h.clamps[0]} mm` : `Ø${h.clamps[0]}–${h.clamps[1]} mm`],
            ["Max speed", `${h.maxRpm.toLocaleString("en")} rpm`],
          ]}
        />
        <p className="text-xs/relaxed text-muted-foreground">{HOLDER_CLAMPING[h.kind]}</p>
      </section>
    </div>
  );
}
