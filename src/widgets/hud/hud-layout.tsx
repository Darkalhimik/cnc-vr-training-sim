"use client";

import { cn } from "@/shared/lib/cn";

interface HudLayoutProps {
  topLeft?: React.ReactNode;
  topRight?: React.ReactNode;
  bottomLeft?: React.ReactNode;
  bottomRight?: React.ReactNode;
  center?: React.ReactNode;
  className?: string;
}

export function HudLayout({
  topLeft,
  topRight,
  bottomLeft,
  bottomRight,
  center,
  className,
}: HudLayoutProps) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 z-10 p-4", className)}>
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className="pointer-events-auto">{topLeft}</div>
        <div className="pointer-events-auto">{topRight}</div>
      </div>

      {/* Center */}
      {center && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center">
          {center}
        </div>
      )}

      {/* Bottom row */}
      <div className="absolute inset-x-4 bottom-4 flex items-end justify-between">
        <div className="pointer-events-auto max-w-md">{bottomLeft}</div>
        <div className="pointer-events-auto">{bottomRight}</div>
      </div>
    </div>
  );
}
