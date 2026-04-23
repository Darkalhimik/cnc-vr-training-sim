"use client";

import { cn } from "@/shared/lib/cn";
import { type HTMLAttributes, forwardRef } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, glow, interactive, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-[var(--radius-lg)] border border-border bg-bg-secondary p-6",
          "shadow-[0_10px_24px_rgba(0,0,0,0.18)]",
          glow && "border-border-accent bg-bg-elevated",
          interactive &&
            "cursor-pointer transition-colors duration-150 hover:border-border-accent hover:bg-bg-elevated",
          className,
        )}
        {...props}
      />
    );
  },
);

Card.displayName = "Card";
