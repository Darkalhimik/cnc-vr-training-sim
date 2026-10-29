"use client";

import { cn } from "@/shared/lib/cn";
import { type HTMLAttributes, forwardRef } from "react";

/**
 * The HUD surface. Translucent because the 3D scene behind it is the content —
 * a solid panel would hide the machine the operator is aiming at — but
 * otherwise a plain bordered container: one shadow level, `rounded-md`, no
 * gradient and no glow.
 */
export const GlassPanel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-md border bg-background/85 shadow-md backdrop-blur",
          className,
        )}
        {...props}
      />
    );
  },
);

GlassPanel.displayName = "GlassPanel";
