import { currentUser } from "@/server/auth";
import { getDb, schema } from "@/server/db";
import { fail, unauthorized } from "@/server/http";
import { ownPart } from "@/server/parts";

const { part } = schema;

/**
 * A part's geometry: `?size=preview` for the shelf, anything else for the
 * full-resolution field. A part never changes once saved, so the browser
 * keeps it for good — reopening the warehouse costs no database transfer.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const preview = new URL(request.url).searchParams.get("size") === "preview";
  const [found] = await getDb()
    .select({ data: preview ? part.preview : part.field })
    .from(part)
    .where(ownPart(user.id, id));
  if (!found) return fail(404, "No such part in your warehouse.");
  return new Response(new Uint8Array(found.data), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
