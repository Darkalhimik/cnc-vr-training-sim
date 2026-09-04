"use client";

import { cn } from "@/shared/lib/cn";
import { type HTMLAttributes, forwardRef } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-md border bg-card p-4 text-card-foreground",
          interactive && "cursor-pointer transition-colors hover:bg-accent",
          className,
        )}
        {...props}
      />
    );
  },
);

Card.displayName = "Card";
