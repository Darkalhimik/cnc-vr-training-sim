import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { isMachineId, machineById } from "@/entities/catalog/machines";
import { checkLoadout, sortLoadout, type Loadout } from "@/entities/tooling/loadout";
import { currentUser } from "@/server/auth";
import { getDb, schema } from "@/server/db";
import { fail, unauthorized } from "@/server/http";

const { toolLoadout } = schema;

/** The signed-in user's loadout for one machine; null when they have not
 *  set one (the machine then carries the standard set). */
export async function GET(request: Request) {
  const machineId = new URL(request.url).searchParams.get("machine");
  if (!isMachineId(machineId)) return fail(400, "Unknown machine.");
  const user = await currentUser();
  if (!user) return NextResponse.json({ tools: null });
  const [row] = await getDb()
    .select({ tools: toolLoadout.tools })
    .from(toolLoadout)
    .where(and(eq(toolLoadout.userId, user.id), eq(toolLoadout.machineId, machineId)));
  return NextResponse.json({ tools: row?.tools ?? null });
}

/** Load a machine. The loadout is checked here against the machine's spindle
 *  and changer, as the client checked it, not trusted. */
export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const body = (await request.json().catch(() => null)) as { machine?: unknown; tools?: unknown } | null;
  const machine = isMachineId(body?.machine) ? machineById(body.machine) : null;
  if (!machine) return fail(400, "Unknown machine.");
  if (!Array.isArray(body?.tools) || body.tools.length > machine.tooling.pockets) return fail(400, "A loadout is a list of tools.");
  const tools: Loadout = sortLoadout(
    body.tools.map((t: { number?: unknown; assembly?: unknown }) => ({ number: Number(t?.number), assembly: String(t?.assembly ?? "") })),
  );
  const issues = checkLoadout(tools, machine.tooling);
  if (issues.length) return fail(400, issues[0].text);

  await getDb()
    .insert(toolLoadout)
    .values({ userId: user.id, machineId: machine.id, tools })
    .onConflictDoUpdate({ target: [toolLoadout.userId, toolLoadout.machineId], set: { tools, updatedAt: new Date() } });
  return NextResponse.json({ tools });
}
