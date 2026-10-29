import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { isMachineId } from "@/entities/catalog/machines";
import { levelById, starsFor } from "@/entities/catalog/levels";
import { currentUser } from "@/server/auth";
import { getDb, schema } from "@/server/db";
import { fail, num, unauthorized } from "@/server/http";

const { levelProgress } = schema;

/** The signed-in user's progress on one machine's levels. Nobody signed in
 *  has none — that is not an error, the level map just shows it fresh. */
export async function GET(request: Request) {
  const machineId = new URL(request.url).searchParams.get("machine");
  if (!isMachineId(machineId)) return fail(400, "Unknown machine.");
  const user = await currentUser();
  if (!user) return NextResponse.json({ progress: [] });
  const rows = await getDb()
    .select()
    .from(levelProgress)
    .where(and(eq(levelProgress.userId, user.id), eq(levelProgress.machineId, machineId)));
  return NextResponse.json({ progress: rows });
}

/**
 * An attempt at a level. Every attempt counts; a completed one keeps the
 * best time, score and stars. Stars are worked out here, not trusted from
 * the client.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const level = levelById(String(body?.levelId ?? ""));
  if (!level) return fail(400, "Unknown level.");
  const completed = body?.completed === true;
  const seconds = num(body?.seconds, 0, 24 * 3600);
  const score = num(body?.score, 0, 100);
  if (completed && seconds === null) return fail(400, "A completed attempt needs its time.");
  if (completed && level.kind === "task" && score === null) return fail(400, "A completed task needs its score.");

  const stars = completed ? starsFor(level, seconds!, score) : 0;
  const now = new Date();
  const best = (column: string, fn: "least" | "greatest", value: number | null) =>
    value === null ? sql.raw(`"level_progress"."${column}"`) : sql`${sql.raw(fn)}("level_progress".${sql.identifier(column)}, ${value})`;

  const [row] = await getDb()
    .insert(levelProgress)
    .values({
      userId: user.id,
      machineId: level.machineId,
      levelId: level.id,
      completedAt: completed ? now : null,
      bestSeconds: completed ? Math.round(seconds!) : null,
      bestScore: completed ? score : null,
      stars,
      attempts: 1,
    })
    .onConflictDoUpdate({
      target: [levelProgress.userId, levelProgress.levelId],
      set: {
        attempts: sql`"level_progress"."attempts" + 1`,
        ...(completed
          ? {
              completedAt: sql`coalesce("level_progress"."completedAt", ${now})`,
              bestSeconds: best("bestSeconds", "least", Math.round(seconds!)),
              bestScore: best("bestScore", "greatest", score),
              stars: sql`greatest("level_progress"."stars", ${stars})`,
            }
          : {}),
      },
    })
    .returning();
  return NextResponse.json({ progress: row, stars });
}
