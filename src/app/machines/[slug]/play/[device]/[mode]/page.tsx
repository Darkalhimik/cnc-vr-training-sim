import { redirect } from "next/navigation";
import { machineBySlug } from "@/entities/catalog/machines";

/** The simulator moved into the workshop; old links land at the machine. */
export default async function OldPlayRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; device: string }>;
  searchParams: Promise<{ level?: string }>;
}) {
  const { slug, device } = await params;
  const { level } = await searchParams;
  const machine = machineBySlug(slug);
  const to = device === "ar" ? "phone" : device;
  if (level) redirect(`/world/${to}?level=${encodeURIComponent(level)}`);
  redirect(`/world/${to}${machine ? `?at=${machine.id}` : ""}`);
}
