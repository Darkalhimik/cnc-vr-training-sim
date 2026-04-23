"use client";

import { cn } from "@/shared/lib/cn";

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex rounded-[var(--radius-md)] border border-border bg-bg-secondary p-1",
        className,
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-semibold tracking-[0.08em] transition-colors duration-150",
            value === opt.value
              ? "bg-bg-elevated text-text-primary"
              : "text-text-secondary hover:text-text-primary",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
