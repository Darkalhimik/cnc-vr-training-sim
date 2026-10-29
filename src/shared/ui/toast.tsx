"use client";

import { cn } from "@/shared/lib/cn";
import { useNotifications } from "@/shared/lib/notifications";
import { TONE_RING, TONE_TEXT, toneOf } from "@/shared/ui/tone";

export { showToast } from "@/shared/lib/notifications";

/** The DOM half of the notification surface. The 3D half is WarningBoard3D. */
export function ToastContainer({ className }: { className?: string }) {
  const items = useNotifications((s) => s.items);
  const dismiss = useNotifications((s) => s.dismiss);

  if (items.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "animate-toast-in flex items-start gap-2 rounded-md bg-background/90 px-3 py-2 text-xs/relaxed shadow-md ring-1 ring-inset backdrop-blur",
            TONE_TEXT[toneOf(t.variant)],
            TONE_RING[toneOf(t.variant)],
          )}
        >
          <span className="min-w-0 flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss message"
            className="shrink-0 rounded px-1 text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
