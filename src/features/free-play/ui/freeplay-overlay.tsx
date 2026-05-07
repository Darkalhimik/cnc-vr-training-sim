"use client";

import { GlassPanel } from "@/shared/ui/glass-panel";
import { Button } from "@/shared/ui/button";
import { useSessionStore } from "@/features/session/session-store";
import { useMachineStore } from "@/entities/machine/machine-store";
import { MACHINE_PART_LABELS, MACHINE_PART_DESCRIPTIONS } from "@/entities/machine/machine-parts";

export function FreePlayOverlay() {
  const hoveredPart = useSessionStore((s) => s.hoveredPart);
  const hintsEnabled = useSessionStore((s) => s.hintsEnabled);
  const toggleHints = useSessionStore((s) => s.toggleHints);
  const reset = useMachineStore((s) => s.reset);

  return (
    <>
      <GlassPanel className="flex items-center gap-2 px-3 py-2">
        <Button
          size="sm"
          variant={hintsEnabled ? "primary" : "ghost"}
          onClick={toggleHints}
        >
          {hintsEnabled ? "Hints ON" : "Hints OFF"}
        </Button>
        <Button size="sm" variant="ghost" onClick={reset}>
          Reset Machine
        </Button>
      </GlassPanel>

      {hoveredPart && hoveredPart !== "body" && (
        <GlassPanel className="absolute bottom-16 left-4 max-w-xs p-4">
          <h4 className="text-sm font-bold text-text-primary">
            {MACHINE_PART_LABELS[hoveredPart]}
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            {MACHINE_PART_DESCRIPTIONS[hoveredPart]}
          </p>
        </GlassPanel>
      )}
    </>
  );
}
