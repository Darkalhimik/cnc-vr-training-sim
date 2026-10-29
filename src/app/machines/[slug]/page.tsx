"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DEVICE_MODES, type DeviceMode } from "@/entities/machine/machine-types";
import { machineBySlug } from "@/entities/catalog/machines";
import { useWarehouseStore } from "@/features/warehouse/warehouse-api";
import { useProgress } from "@/features/levels/progress";
import { useSession } from "@/shared/lib/auth-client";
import { ChevronRightIcon, PlayIcon, ShelfIcon, ToolIcon } from "@/shared/ui/icons";
import { AppHeader } from "@/widgets/app-header/app-header";
import { MachineProgress } from "@/widgets/machine-progress/machine-progress";

const MachineShowcase = dynamic(
  () => import("@/widgets/machine-showcase/machine-showcase").then((m) => m.MachineShowcase),
  { ssr: false, loading: () => null },
);

/**
 * A machine's front door: the machine itself, how far the trainee has got on
 * it, and the ways on — its levels, the warehouse, the other machines. Levels
 * are chosen on the level map, not here.
 */
export default function MachinePage() {
  const { slug } = useParams<{ slug: string }>();
  const machine = machineBySlug(slug);
  const progress = useProgress(machine?.id ?? "umc500");
  const { data, isPending } = useSession();
  const parts = useWarehouseStore((s) => s.parts);
  const loadWarehouse = useWarehouseStore((s) => s.load);
  const user = data?.user.id ?? null;
  // The device the level map last chose: a headset user picks VR once.
  const [device, setDevice] = useState<DeviceMode>("desktop");
  useEffect(() => {
    try {
      const stored = DEVICE_MODES.find((d) => d === localStorage.getItem("cnc-device"));
      if (stored) setDevice(stored);
    } catch {}
  }, []);
  useEffect(() => {
    if (!isPending) void loadWarehouse(user);
  }, [user, isPending, loadWarehouse]);

  if (!machine) notFound();
  const onShelf = parts.filter((p) => p.machineId === machine.id).length;

  return (
    <div className="min-h-dvh">
      <AppHeader crumbs={[{ label: machine.name }]} />
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1.55fr_1fr]">
        <section className="relative overflow-hidden rounded-md border bg-stage">
          <div className="h-[46vh] min-h-80 lg:h-[calc(100dvh-10rem)] lg:max-h-[640px]">
            <MachineShowcase url={machine.modelUrl} />
          </div>
          <dl className="grid grid-cols-2 gap-px border-t border-white/10 bg-white/10 sm:grid-cols-3">
            {machine.specs.map((s) => (
              <div key={s.label} className="bg-stage px-4 py-2.5">
                <dt className="text-[10px] uppercase tracking-wide text-zinc-400">{s.label}</dt>
                <dd className="font-mono text-xs text-zinc-100">{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="flex flex-col gap-6">
          <header className="space-y-2">
            <p className="font-mono text-xs text-muted-foreground">{machine.maker.toUpperCase()}</p>
            <h1 className="text-2xl font-semibold tracking-tight">{machine.name}</h1>
            <p className="text-sm text-muted-foreground">{machine.kind}</p>
            <p className="text-xs/relaxed text-muted-foreground">{machine.summary}</p>
          </header>

          <div className="space-y-3 rounded-md border p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide">Your progress</h2>
            <MachineProgress machineId={machine.id} />
            {progress.next && (
              <p className="border-t pt-3 text-xs text-muted-foreground">
                Next up: <span className="text-foreground">{progress.next.title}</span>
              </p>
            )}
          </div>

          <div className="mt-auto grid gap-2">
            <Link
              href={`/machines/${machine.slug}/levels`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <PlayIcon />
              Levels
            </Link>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Link
                href={`/world/${device}?at=${machine.id}`}
                className="inline-flex h-8 items-center justify-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors hover:bg-accent"
              >
                Workshop
              </Link>
              <Link
                href="/warehouse"
                className="inline-flex h-8 items-center justify-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors hover:bg-accent"
              >
                <ShelfIcon />
                Warehouse
                <span className="font-mono text-muted-foreground">{onShelf}</span>
              </Link>
              <Link
                href={`/toolbox?machine=${machine.id}`}
                className="inline-flex h-8 items-center justify-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors hover:bg-accent"
              >
                <ToolIcon />
                Tools
              </Link>
              <Link
                href="/"
                className="inline-flex h-8 items-center justify-center gap-1 rounded-md border px-3 text-xs font-medium transition-colors hover:bg-accent"
              >
                All machines
                <ChevronRightIcon />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
