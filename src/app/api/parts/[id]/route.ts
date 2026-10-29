import { NextResponse } from "next/server";
import { MAX_PART_NAME } from "@/entities/part/warehouse-limits";
import { currentUser } from "@/server/auth";
import { getDb, schema } from "@/server/db";
import { fail, unauthorized } from "@/server/http";
import { ownPart, partSummary } from "@/server/parts";

const { part } = schema;
type Params = { params: Promise<{ id: string }> };

/** One part's details: the summary plus its program and design. */
export async function GET(_request: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const [found] = await getDb()
    .select({ ...partSummary, program: part.program, design: part.design })
    .from(part)
    .where(ownPart(user.id, id));
  return found ? NextResponse.json({ part: found }) : fail(404, "No such part in your warehouse.");
}

/** Rename. */
export async function PATCH(request: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = String(body?.name ?? "").trim().slice(0, MAX_PART_NAME);
  if (!name) return fail(400, "A part needs a name.");
  const [updated] = await getDb().update(part).set({ name }).where(ownPart(user.id, id)).returning(partSummary);
  return updated ? NextResponse.json({ part: updated }) : fail(404, "No such part in your warehouse.");
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const [deleted] = await getDb().delete(part).where(ownPart(user.id, id)).returning({ id: part.id });
  return deleted ? new NextResponse(null, { status: 204 }) : fail(404, "No such part in your warehouse.");
}
