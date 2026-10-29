import { redirect } from "next/navigation";

/** Old /play/<device>/<mode> links: the trainer is the workshop now. */
export default async function OldPlayRoute({ params }: { params: Promise<{ rest?: string[] }> }) {
  const [device = "desktop", mode] = (await params).rest ?? [];
  const to = device === "ar" ? "phone" : device;
  if (mode === "freeplay" || mode === "develop") redirect(`/world/${to}?at=umc500`);
  redirect("/machines/umc-500/levels");
}
