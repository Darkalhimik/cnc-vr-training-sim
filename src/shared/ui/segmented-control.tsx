"use client";

import { cn } from "@/shared/lib/cn";

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Span the container, segments sharing the width evenly — for a panel
   *  column, where a centred inline control leaves dead space beside it. */
  fill?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  fill,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        "h-7 items-center justify-center rounded-md bg-muted p-0.5",
        fill ? "flex w-full" : "inline-flex",
        className,
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-sm px-3 py-1 text-xs font-medium transition-colors",
            fill && "min-w-0 flex-1",
            value === opt.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
