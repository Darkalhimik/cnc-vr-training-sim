"use client";

import { cn } from "@/shared/lib/cn";
import { type ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

// Variant carries colour, size carries the box. Density is the point: `md` is
// the base control at h-7/text-xs, `sm` steps down for a HUD row, and `lg` is
// reserved for the one primary action that drives a page forward.
const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "border bg-transparent hover:bg-accent",
  ghost: "border border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
  danger: "bg-destructive text-destructive-foreground hover:opacity-90",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-6 gap-1.5 px-2 text-xs",
  md: "h-7 gap-2 px-3 text-xs",
  lg: "h-9 gap-2 px-4 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap",
          "transition-colors disabled:pointer-events-none disabled:opacity-50",
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
