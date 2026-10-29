import { NextResponse } from "next/server";
import { count, desc, eq } from "drizzle-orm";
import { isMachineId } from "@/entities/catalog/machines";
import { levelById } from "@/entities/catalog/levels";
import {
  MAX_FIELD_BYTES,
  MAX_PART_NAME,
  MAX_PARTS_PER_USER,
  MAX_PREVIEW_BYTES,
  MAX_PROGRAM_CHARS,
} from "@/entities/part/warehouse-limits";
import { MATERIALS } from "@/entities/part/tool-library";
import { currentUser } from "@/server/auth";
import { getDb, schema } from "@/server/db";
import { fail, num, unauthorized } from "@/server/http";
import { partSummary } from "@/server/parts";

const { part } = schema;

/** The warehouse: the signed-in user's parts, newest first. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ parts: [], limit: MAX_PARTS_PER_USER });
  const parts = await getDb()
    .select(partSummary)
    .from(part)
    .where(eq(part.userId, user.id))
    .orderBy(desc(part.createdAt));
  return NextResponse.json({ parts, limit: MAX_PARTS_PER_USER });
}

/**
 * Put a part on a shelf. Multipart: `meta` (JSON), `field` and `preview`
 * (the gzip payloads from src/features/warehouse/part-field.ts).
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  // Refuse an oversized body before reading it into memory.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_FIELD_BYTES + MAX_PREVIEW_BYTES + MAX_PROGRAM_CHARS * 4 + 64 * 1024) {
    return fail(413, "The part is too large to store.");
  }
  const form = await request.formData().catch(() => null);
  const field = form?.get("field");
  const preview = form?.get("preview");
  let meta: Record<string, unknown> | null = null;
  try {
    meta = JSON.parse(String(form?.get("meta") ?? "null"));
  } catch {
    meta = null;
  }
  if (!meta || !(field instanceof Blob) || !(preview instanceof Blob)) {
    return fail(400, "Expected meta, field and preview.");
  }
  if (field.size === 0 || field.size > MAX_FIELD_BYTES) return fail(413, "The part is too detailed to store.");
  if (preview.size === 0 || preview.size > MAX_PREVIEW_BYTES) return fail(413, "The part preview is too large to store.");

  const name = String(meta.name ?? "").trim().slice(0, MAX_PART_NAME) || "Untitled part";
  const machineId = meta.machineId;
  if (!isMachineId(machineId)) return fail(400, "Unknown machine.");
  const material = String(meta.material ?? "");
  if (!(material in MATERIALS)) return fail(400, "Unknown material.");
  const stock = meta.stock;
  if (!Array.isArray(stock) || stock.length !== 3 || !stock.every((s) => num(s, 1, 1000) !== null)) {
    return fail(400, "Stock must be three sizes in millimetres.");
  }
  const program = String(meta.program ?? "");
  if (program.length > MAX_PROGRAM_CHARS) return fail(413, "The program is too long to store.");
  const levelId = meta.levelId === undefined || meta.levelId === null ? null : String(meta.levelId);
  if (levelId !== null && !levelById(levelId)) return fail(400, "Unknown level.");

  const db = getDb();
  const [{ n }] = await db.select({ n: count() }).from(part).where(eq(part.userId, user.id));
  if (n >= MAX_PARTS_PER_USER) {
    return fail(409, `The warehouse is full (${MAX_PARTS_PER_USER} parts). Remove one to make room.`);
  }

  const fieldBytes = Buffer.from(await field.arrayBuffer());
  const previewBytes = Buffer.from(await preview.arrayBuffer());
  const [saved] = await db
    .insert(part)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      machineId,
      name,
      material,
      stock: stock as [number, number, number],
      source: levelId ? "task" : "freeplay",
      levelId,
      score: num(meta.score, 0, 100),
      program,
      design: meta.design && typeof meta.design === "object" ? meta.design : null,
      cycleSeconds: num(meta.cycleSeconds, 0, 1e6),
      volumeMm3: num(meta.volumeMm3, 0, 1e9),
      field: fieldBytes,
      preview: previewBytes,
      bytes: fieldBytes.length + previewBytes.length,
    })
    .returning(partSummary);
  return NextResponse.json({ part: saved }, { status: 201 });
}
