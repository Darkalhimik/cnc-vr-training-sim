"use client";

import { cn } from "@/shared/lib/cn";
import { type HTMLAttributes, forwardRef } from "react";

export const GlassPanel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-[var(--radius-md)] border border-border bg-bg-glass backdrop-blur-md",
          "shadow-[0_10px_28px_rgba(0,0,0,0.22)]",
          className,
        )}
        {...props}
      />
    );
  },
);

GlassPanel.displayName = "GlassPanel";
