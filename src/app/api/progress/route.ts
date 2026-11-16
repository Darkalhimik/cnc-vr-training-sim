import { randomUUID } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { isMachineId } from "@/entities/catalog/machines";
import { levelById, starsFor, taskScore } from "@/entities/catalog/levels";
import { ACTION_LOG_VERSION } from "@/entities/machine/action-log";
import { currentUser } from "@/server/auth";
import { getDb, schema } from "@/server/db";
import { fail, num, unauthorized } from "@/server/http";

const { levelAttempt, levelProgress } = schema;

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

/** An action log's size limits: gzipped as sent, and unpacked. */
const MAX_LOG_GZIP = 512 * 1024;
const MAX_LOG_JSON = 16 * 1024 * 1024;

/**
 * The attempt's action log as sent — base64 of gzipped JSON — checked to be
 * one: it unpacks, within its size, to a log of the version this server
 * knows. What is stored is the gzip as it came. Anything else is dropped,
 * and the attempt is kept without it.
 */
function actionLogOf(value: unknown): Buffer | null {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    const gz = Buffer.from(value, "base64");
    if (gz.length === 0 || gz.length > MAX_LOG_GZIP) return null;
    const json = gunzipSync(gz, { maxOutputLength: MAX_LOG_JSON }).toString("utf8");
    const log = JSON.parse(json) as { version?: unknown; entries?: unknown; initial?: unknown };
    if (log.version !== ACTION_LOG_VERSION || !Array.isArray(log.entries) || typeof log.initial !== "object") return null;
    return gz;
  } catch {
    return null;
  }
}

/**
 * An attempt at a level, finished or given up. Every attempt is recorded in
 * level_attempt with its start, time, score and action log; level_progress
 * keeps the best time, score and stars, and counts them. Stars, and a task's
 * score, are worked out here from what was measured — not trusted from the
 * client.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const level = levelById(String(body?.levelId ?? ""));
  if (!level) return fail(400, "Unknown level.");
  const completed = body?.completed === true;
  const crashed = body?.crashed === true;
  const seconds = num(body?.seconds, 0, 24 * 3600);
  if (seconds === null) return fail(400, "An attempt needs its time.");

  // When it started: as sent, if it is a time in the last day; otherwise
  // worked back from its length.
  const now = new Date();
  const sent = typeof body?.startedAt === "string" ? new Date(body.startedAt) : null;
  const startedAt =
    sent && !Number.isNaN(sent.getTime()) && sent <= now && now.getTime() - sent.getTime() < 24 * 3600 * 1000
      ? sent
      : new Date(now.getTime() - seconds * 1000);

  // A task's part, as measured on the client: the score comes from it here.
  const m = (body?.measurement ?? null) as Record<string, unknown> | null;
  const big = 1e9;
  const measurement =
    m && num(m.leftMm3, 0, big) !== null && num(m.overcutMm3, 0, big) !== null && num(m.toRemoveMm3, 0, big) !== null
      ? { leftMm3: m.leftMm3 as number, overcutMm3: m.overcutMm3 as number, toRemoveMm3: m.toRemoveMm3 as number }
      : null;
  if (completed && level.kind === "task" && !measurement) return fail(400, "A finished task needs its measured part.");
  const score = completed && level.kind === "task" && measurement ? taskScore(measurement, crashed) : null;

  const actionLog = actionLogOf(body?.log);
  const stars = completed ? starsFor(level, seconds, score) : 0;
  const best = (column: string, fn: "least" | "greatest", value: number | null) =>
    value === null ? sql.raw(`"level_progress"."${column}"`) : sql`${sql.raw(fn)}("level_progress".${sql.identifier(column)}, ${value})`;

  const row = await getDb().transaction(async (tx) => {
    await tx.insert(levelAttempt).values({
      id: randomUUID(),
      userId: user.id,
      machineId: level.machineId,
      levelId: level.id,
      startedAt,
      seconds: Math.round(seconds),
      completed,
      crashed,
      score,
      leftMm3: measurement?.leftMm3 ?? null,
      overcutMm3: measurement?.overcutMm3 ?? null,
      toRemoveMm3: measurement?.toRemoveMm3 ?? null,
      actionLog,
      logBytes: actionLog?.length ?? null,
    });
    const [progress] = await tx
      .insert(levelProgress)
      .values({
        userId: user.id,
        machineId: level.machineId,
        levelId: level.id,
        completedAt: completed ? now : null,
        bestSeconds: completed ? Math.round(seconds) : null,
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
                bestSeconds: best("bestSeconds", "least", Math.round(seconds)),
                bestScore: best("bestScore", "greatest", score),
                stars: sql`greatest("level_progress"."stars", ${stars})`,
              }
            : {}),
        },
      })
      .returning();
    return progress;
  });
  return NextResponse.json({ progress: row, stars, score, logged: actionLog !== null });
}
