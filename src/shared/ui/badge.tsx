"use client";

import { cn } from "@/shared/lib/cn";
import { TONE_CLASSES, type Tone } from "@/shared/ui/tone";

interface BadgeProps {
  /** State pill (default): mono text, tone fill. */
  tone?: Tone;
  /** A qualifier — a tag or category, not a state. Neutral by definition. */
  qualifier?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ tone = "zinc", qualifier, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5",
        qualifier
          ? "bg-muted text-[10px] uppercase tracking-wide text-muted-foreground"
          : cn("font-mono text-xs ring-1 ring-inset", TONE_CLASSES[tone]),
        className,
      )}
    >
      {children}
    </span>
  );
}
