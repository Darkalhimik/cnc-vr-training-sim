"use client";

import { create } from "zustand";

export type NotificationVariant = "success" | "info" | "warning" | "error";

export type Notification = {
  id: string;
  message: string;
  variant: NotificationVariant;
};

/** Long enough to read a two-line interlock message before it goes. */
const LIFETIME_MS = 6000;
const MAX_VISIBLE = 3;

/**
 * One place every warning lives, because it has to be shown twice.
 *
 * Rejections ("Open the air valve first.") and tutorial guard violations used
 * to exist only inside the DOM toast component's local state. In an immersive
 * VR or AR session the DOM HUD is not rendered at all, so a blocked action
 * produced no feedback in any modality — the trainee just saw nothing happen.
 * Both the DOM toasts and the in-scene 3D board read this store.
 */
type NotificationStore = {
  items: Notification[];
  push: (message: string, variant: NotificationVariant) => void;
  dismiss: (id: string) => void;
};

let nextId = 0;

export const useNotifications = create<NotificationStore>((set, get) => ({
  items: [],

  push: (message, variant) => {
    const id = String(++nextId);
    set((s) => ({
      items: [...s.items.slice(-(MAX_VISIBLE - 1)), { id, message, variant }],
    }));
    setTimeout(() => get().dismiss(id), LIFETIME_MS);
  },

  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

/** Imperative entry point, callable from stores and event handlers. */
export function showToast(
  message: string,
  variant: NotificationVariant = "info",
) {
  useNotifications.getState().push(message, variant);
}
