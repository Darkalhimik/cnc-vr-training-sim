import "server-only";
import { and, eq } from "drizzle-orm";
import { schema } from "./db";

const { part } = schema;

/** Everything about a part except its two payloads. */
export const partSummary = {
  id: part.id,
  machineId: part.machineId,
  name: part.name,
  material: part.material,
  stock: part.stock,
  source: part.source,
  levelId: part.levelId,
  score: part.score,
  cycleSeconds: part.cycleSeconds,
  volumeMm3: part.volumeMm3,
  bytes: part.bytes,
  createdAt: part.createdAt,
};

/** A part, if it is this user's: every per-part route checks ownership. */
export const ownPart = (userId: string, id: string) => and(eq(part.userId, userId), eq(part.id, id));
