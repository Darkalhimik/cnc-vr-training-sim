"use client";

import { cn } from "@/shared/lib/cn";
import type { Diagnostic } from "@/entities/nc";
import { formatCycle, type Analysis } from "./analysis";

/**
 * The check's alarms and warnings, in line order. A main-program line is a
 * button to that line; a subprogram's line is in another program's text.
 */
export function ProblemList({
  analysis,
  onGoTo,
  className,
}: {
  analysis: Analysis | null;
  onGoTo: (d: Diagnostic) => void;
  className?: string;
}) {
  if (!analysis) return null;
  if (analysis.diagnostics.length === 0) {
    return <p className={cn("px-2 text-xs text-muted-foreground", className)}>No alarms or warnings.</p>;
  }
  return (
    <ul className={cn("space-y-0.5", className)}>
      {analysis.diagnostics.map((d, i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() => onGoTo(d)}
            className={cn(
              "flex w-full gap-2 rounded px-2 py-0.5 text-left font-mono text-[11px] hover:bg-accent",
              d.severity === "alarm" ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-300",
            )}
          >
            <span className="w-10 shrink-0 tabular-nums">L{d.line}</span>
            <span className="min-w-0 flex-1">
              {d.program ? `(${d.program}) ` : ""}
              {d.code ? `${d.code} ` : ""}
              {d.message}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** One line: cycle time, moves and tools, as the check found them. */
export function CheckSummary({ analysis, stale }: { analysis: Analysis | null; stale: boolean }) {
  if (!analysis) return <span className="font-mono text-xs text-muted-foreground">checking…</span>;
  const { result } = analysis;
  return (
    <span className={cn("font-mono text-xs text-muted-foreground", stale && "opacity-60")}>
      {formatCycle(result.cycleSeconds)} cycle · {result.motions.length} moves · tools{" "}
      {result.toolsUsed.map((t) => `T${t}`).join(" ") || "none"}
    </span>
  );
}
