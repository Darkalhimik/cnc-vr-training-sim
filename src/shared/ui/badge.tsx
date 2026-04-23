"use client";

import { cn } from "@/shared/lib/cn";

type BadgeVariant = "default" | "active" | "completed" | "locked" | "warning";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "border-border bg-bg-elevated text-text-secondary",
  active: "border-accent/25 bg-accent/10 text-accent",
  completed: "border-accent/25 bg-accent/10 text-accent",
  locked: "border-border bg-bg-secondary text-text-muted",
  warning: "border-warning/25 bg-warning/10 text-warning",
};

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-full)] border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
