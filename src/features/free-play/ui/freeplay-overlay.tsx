"use client";

import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { useSessionStore } from "@/features/session/session-store";
import { useMachineStore } from "@/entities/machine/machine-store";
import { MACHINE_PART_LABELS, MACHINE_PART_DESCRIPTIONS } from "@/entities/machine/machine-parts";

/**
 * Section body, not a card. The part-detail block is always rendered — with a
 * placeholder line when nothing is under the pointer — because it fills in on
 * hover, and a block that appears and disappears would shift every control
 * below it while the user is aiming at them.
 */
export function FreePlayOverlay() {
  const hoveredPart = useSessionStore((s) => s.hoveredPart);
  const hintsEnabled = useSessionStore((s) => s.hintsEnabled);
  const toggleHints = useSessionStore((s) => s.toggleHints);
  const reset = useMachineStore((s) => s.reset);

  const part = hoveredPart && hoveredPart !== "body" ? hoveredPart : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="md" variant="secondary" onClick={toggleHints}>
          Hints
          <Badge tone={hintsEnabled ? "emerald" : "zinc"}>
            {hintsEnabled ? "on" : "off"}
          </Badge>
        </Button>
        <Button size="md" variant="secondary" onClick={reset}>
          Reset machine
        </Button>
      </div>

      <div className="min-h-16 space-y-1 border-t pt-3">
        {part ? (
          <>
            <h4 className="text-sm font-semibold tracking-tight">
              {MACHINE_PART_LABELS[part]}
            </h4>
            <p className="text-xs/relaxed text-muted-foreground">
              {MACHINE_PART_DESCRIPTIONS[part]}
            </p>
          </>
        ) : (
          <p className="text-xs/relaxed text-muted-foreground">
            Point at a part of the machine to read what it does.
          </p>
        )}
      </div>
    </div>
  );
}
