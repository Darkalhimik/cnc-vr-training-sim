"use client";

import { cn } from "@/shared/lib/cn";

interface ProgressBarProps {
  value: number; // 0-100
  className?: string;
  showLabel?: boolean;
}

export function ProgressBar({ value, className, showLabel }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative h-2 flex-1 overflow-hidden rounded-[var(--radius-full)] bg-bg-elevated">
        <div
          className="absolute inset-y-0 left-0 rounded-[var(--radius-full)] bg-gradient-to-r from-accent to-cyan transition-all duration-500 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-semibold tabular-nums text-text-secondary">
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  );
}
