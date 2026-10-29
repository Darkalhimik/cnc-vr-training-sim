"use client";

import { createAuthClient } from "better-auth/react";
import { anonymousClient } from "better-auth/client/plugins";

/** Talks to /api/auth on whatever origin the page is served from. */
export const authClient = createAuthClient({ plugins: [anonymousClient()] });

export const useSession = authClient.useSession;

/**
 * A session to save under: the current one, or a new guest. Called by the
 * first action that writes — a part saved, a level finished — so browsing
 * never creates accounts.
 */
export async function ensureSession(): Promise<boolean> {
  const current = await authClient.getSession();
  if (current.data?.user) return true;
  const guest = await authClient.signIn.anonymous();
  return !guest.error;
}
