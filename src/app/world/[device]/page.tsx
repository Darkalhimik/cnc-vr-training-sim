"use client";

import { notFound, useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { DEVICE_MODES } from "@/entities/machine/machine-types";
import { WorldShell } from "@/features/world/world-shell";

function World() {
  const params = useParams<{ device: string }>();
  const search = useSearchParams();
  const device = DEVICE_MODES.find((d) => d === params.device);
  if (!device) notFound();
  return <WorldShell device={device} levelId={search.get("level")} at={search.get("at")} />;
}

/** /world/<device>?level=<id>&at=<station> — the workshop, and the trainer. */
export default function WorldPage() {
  return (
    <Suspense>
      <World />
    </Suspense>
  );
}
