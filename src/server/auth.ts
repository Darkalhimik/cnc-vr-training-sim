import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { anonymous } from "better-auth/plugins";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb, schema } from "./db";

/**
 * Accounts: guests first, email and password when they want to keep things.
 *
 * Opening the site needs nothing; the first save or completed level signs
 * the visitor in anonymously, and signing up later moves what the guest
 * made onto the new account (onLinkAccount) before Better Auth deletes the
 * guest. Everything lives in our own Postgres, so the self-hosted box and
 * Vercel behave the same and neither needs a third-party service.
 *
 * Built lazily: `next build` imports route modules, and a Docker image is
 * built without a database to talk to.
 */
function createAuth() {
  const db = getDb();
  const extraHosts = (process.env.AUTH_ALLOWED_HOSTS ?? "").split(",").map((h) => h.trim()).filter(Boolean);
  return betterAuth({
    appName: "CNC Trainer",
    // A fixed URL when one is configured; otherwise whichever allowed host the
    // request came to — localhost in development, the deployment's own
    // *.vercel.app preview and production hosts, and the self-hosted box.
    baseURL: process.env.BETTER_AUTH_URL ?? {
      allowedHosts: ["localhost:*", "127.0.0.1:*", "*.vercel.app", ...extraHosts],
    },
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: { enabled: true, minPasswordLength: 8, autoSignIn: true },
    session: {
      // A month, renewed daily while in use: a trainee comes back next week.
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    telemetry: { enabled: false },
    // Every guest is a row: a page that scripts guest sign-ins would fill a
    // free database. Real visitors make one guest, once.
    rateLimit: { customRules: { "/sign-in/anonymous": { window: 60, max: 5 } } },
    plugins: [
      anonymous({
        generateName: () => "Guest",
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          await adoptGuest(anonymousUser.user.id, newUser.user.id);
        },
      }),
      // Lets server actions set the session cookie.
      nextCookies(),
    ],
  });
}

type Auth = ReturnType<typeof createAuth>;
const cache = globalThis as unknown as { __cncAuth?: Auth };

export function getAuth(): Auth {
  cache.__cncAuth ??= createAuth();
  return cache.__cncAuth;
}

/** The signed-in user (guest or not) for a route handler, or null. */
export async function currentUser() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

/**
 * A guest signed up or signed in: their parts and progress become the
 * account's. Where both have a level, the account keeps its own row — a
 * returning user's history is not overwritten by a guest session.
 */
async function adoptGuest(guestId: string, userId: string) {
  if (guestId === userId) return;
  const db = getDb();
  const { part, levelProgress } = schema;
  await db.transaction(async (tx) => {
    await tx.update(part).set({ userId }).where(eq(part.userId, guestId));
    const own = await tx
      .select({ levelId: levelProgress.levelId })
      .from(levelProgress)
      .where(eq(levelProgress.userId, userId));
    const taken = own.map((r) => r.levelId);
    await tx
      .update(levelProgress)
      .set({ userId })
      .where(
        and(
          eq(levelProgress.userId, guestId),
          taken.length > 0 ? notInArray(levelProgress.levelId, taken) : undefined,
        ),
      );
    if (taken.length > 0) {
      await tx
        .delete(levelProgress)
        .where(and(eq(levelProgress.userId, guestId), inArray(levelProgress.levelId, taken)));
    }
  });
}
