"use client";

import { Badge } from "@/shared/ui/badge";
import { toneOf } from "@/shared/ui/tone";
import { useMachineStore } from "@/entities/machine/machine-store";

type Indicator = {
  label: string;
  /** The state word — both the value shown and the tone lookup key. */
  state: string;
};

/**
 * Section body, not a card — it is composed into the side panel, which owns the
 * surface. One row per indicator, in the same order as the in-scene VR board so
 * the two can be read interchangeably.
 */
export function HudMachineStatus() {
  const machine = useMachineStore((s) => s.machine);

  const indicators: Indicator[] = [
    { label: "Air", state: machine.airValveOpen ? "on" : "off" },
    { label: "Power", state: machine.powerOn ? "on" : "off" },
    { label: "E-stop", state: machine.estop === "released" ? "free" : "lock" },
    { label: "Door", state: machine.doorOpen ? "open" : "shut" },
    { label: "Jog", state: machine.handleJogActive ? "on" : "off" },
    { label: "Coolant", state: machine.coolantOn ? "on" : "off" },
  ];

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
