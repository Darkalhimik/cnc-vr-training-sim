"use client";

import { cn } from "@/shared/lib/cn";
import { TONE_RING, TONE_TEXT, toneOf } from "@/shared/ui/tone";
import { useEffect, useState } from "react";

type ToastVariant = "success" | "info" | "warning" | "error";

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

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
            "animate-toast-in rounded-md bg-background/90 px-3 py-2 text-xs/relaxed shadow-md ring-1 ring-inset backdrop-blur",
            TONE_TEXT[toneOf(t.variant)],
            TONE_RING[toneOf(t.variant)],
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
