"use client";

import { Badge } from "@/shared/ui/badge";
import { toneOf } from "@/shared/ui/tone";
import { useMachineStore } from "@/entities/machine/machine-store";
import { machineIndicators } from "@/entities/machine/machine-indicators";

/**
 * Section body, not a card — it is composed into the side panel, which owns the
 * surface. One row per indicator, in the same order as the in-scene VR board so
 * the two can be read interchangeably.
 */
export function HudMachineStatus() {
  const machine = useMachineStore((s) => s.machine);
  const indicators = machineIndicators(machine);

  return (
    <dl className="grid gap-1.5">
      {indicators.map((ind) => (
        <div key={ind.label} className="flex items-center justify-between gap-3">
          <dt className="text-xs text-muted-foreground">{ind.label}</dt>
          <dd>
            <Badge tone={toneOf(ind.state)}>{ind.state}</Badge>
          </dd>
        </div>
      ))}
    </dl>
  );
}
