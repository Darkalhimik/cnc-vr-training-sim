"use client";

import { cn } from "@/shared/lib/cn";
import { type ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "border border-accent/40 bg-accent text-white hover:border-accent/60 hover:bg-accent-hover",
  secondary:
    "border border-border bg-bg-secondary text-text-primary hover:bg-bg-elevated hover:border-border/80",
  ghost:
    "border border-transparent bg-transparent text-text-secondary hover:border-border hover:bg-bg-elevated/50 hover:text-text-primary",
  danger:
    "border border-danger/30 bg-danger/8 text-danger hover:bg-danger/14",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm rounded-[var(--radius-sm)]",
  md: "px-4 py-2.5 text-sm rounded-[var(--radius-md)]",
  lg: "px-5 py-3 text-sm rounded-[var(--radius-md)]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center font-semibold tracking-[0.02em] transition-colors duration-150",
          "disabled:pointer-events-none disabled:opacity-40",
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
