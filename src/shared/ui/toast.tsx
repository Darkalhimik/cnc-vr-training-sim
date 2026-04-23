"use client";

import { cn } from "@/shared/lib/cn";
import { useEffect, useState } from "react";

type ToastVariant = "success" | "info" | "warning" | "error";

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

const variantStyles: Record<ToastVariant, string> = {
  success: "border-accent/30 bg-accent/10 text-accent",
  info: "border-cyan/30 bg-cyan/10 text-cyan",
  warning: "border-warning/30 bg-warning/10 text-warning",
  error: "border-danger/30 bg-danger/10 text-danger",
};

let toastId = 0;
const listeners: Set<(toast: ToastItem) => void> = new Set();

export function showToast(message: string, variant: ToastVariant = "info") {
  const toast: ToastItem = { id: String(++toastId), message, variant };
  listeners.forEach((fn) => fn(toast));
}

export function ToastContainer({ className }: { className?: string }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (toast: ToastItem) => {
      setToasts((prev) => [...prev.slice(-2), toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 3000);
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "rounded-[var(--radius-md)] border px-4 py-2.5 text-sm font-medium",
            "backdrop-blur-xl animate-fade-in-up",
            variantStyles[t.variant],
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
