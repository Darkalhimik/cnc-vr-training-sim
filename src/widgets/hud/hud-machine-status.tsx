"use client";

import { GlassPanel } from "@/shared/ui/glass-panel";
import { useMachineStore } from "@/entities/machine/machine-store";
import { cn } from "@/shared/lib/cn";

type Indicator = {
  label: string;
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
};

export function HudMachineStatus() {
  const machine = useMachineStore((s) => s.machine);

  const indicators: Indicator[] = [
    { label: "AIR", active: machine.airValveOpen, activeLabel: "ON", inactiveLabel: "OFF" },
    { label: "PWR", active: machine.powerOn, activeLabel: "ON", inactiveLabel: "OFF" },
    { label: "E-STOP", active: machine.emergencyReleased, activeLabel: "FREE", inactiveLabel: "LOCK" },
    { label: "DOOR", active: !machine.doorOpen, activeLabel: "SHUT", inactiveLabel: "OPEN" },
    { label: "COOL", active: machine.coolantOn, activeLabel: "ON", inactiveLabel: "OFF" },
  ];

  return (
    <GlassPanel className="flex items-center gap-4 px-4 py-2.5">
      {indicators.map((ind) => (
        <div key={ind.label} className="flex items-center gap-2">
          <div
            className={cn(
              "h-2 w-2 rounded-full transition-colors duration-300",
              ind.active ? "bg-accent shadow-[0_0_6px_var(--color-accent-glow)]" : "bg-danger/60",
            )}
          />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              {ind.label}
            </span>
            <span className={cn(
              "font-mono text-xs font-semibold",
              ind.active ? "text-accent" : "text-text-muted",
            )}>
              {ind.active ? ind.activeLabel : ind.inactiveLabel}
            </span>
          </div>
        </div>
      ))}
    </GlassPanel>
  );
}
