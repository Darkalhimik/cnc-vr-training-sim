"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEVICE_LABEL, DEVICE_MODES, type DeviceMode } from "@/entities/machine/machine-types";
import { MACHINES } from "@/entities/catalog/machines";
import { useWarehouseStore } from "@/features/warehouse/warehouse-api";
import { useSession } from "@/shared/lib/auth-client";
import { ChevronRightIcon, PlayIcon, ShelfIcon, ToolIcon } from "@/shared/ui/icons";
import { AppHeader } from "@/widgets/app-header/app-header";
import { MachineProgress } from "@/widgets/machine-progress/machine-progress";

/** The dashboard: every machine the trainer has, and the warehouse. */
export default function MachinesPage() {
  const { data, isPending } = useSession();
  const user = data?.user.id ?? null;
  const parts = useWarehouseStore((s) => s.parts);
  const limit = useWarehouseStore((s) => s.limit);
  const loadWarehouse = useWarehouseStore((s) => s.load);
  useEffect(() => {
    if (!isPending) void loadWarehouse(user);
  }, [user, isPending, loadWarehouse]);
  // The device the level map last chose: a headset user picks VR once.
  const [device, setDevice] = useState<DeviceMode>("desktop");
  useEffect(() => {
    try {
      const stored = DEVICE_MODES.find((d) => d === localStorage.getItem("cnc-device"));
      if (stored) setDevice(stored);
    } catch {}
  }, []);

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Machines</h1>
          <p className="text-sm text-muted-foreground">Pick a machine to train on. Your progress is kept per machine.</p>
        </header>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {MACHINES.map((m) => (
            <Link
              key={m.id}
              href={`/machines/${m.slug}`}
              className="group overflow-hidden rounded-md border bg-card transition-colors hover:border-foreground/30"
            >
              <div className="relative aspect-[4/3] bg-stage">
                {/* eslint-disable-next-line @next/next/no-img-element -- a fixed, pre-sized render */}
                <img
                  src={`/images/${m.id}.webp`}
                  alt={`${m.maker} ${m.name}`}
                  className="absolute inset-0 h-full w-full object-contain p-4"
                />
                <span className="absolute left-3 top-3 rounded-md bg-background/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground backdrop-blur">
                  {m.kind}
                </span>
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold tracking-tight">
                    <span className="text-muted-foreground">{m.maker}</span> {m.name}
                  </h2>
                  <ChevronRightIcon className="size-4 text-muted-foreground" />
                </div>
                <p className="text-xs/relaxed text-muted-foreground">{m.summary}</p>
                <MachineProgress machineId={m.id} compact />
              </div>
            </Link>
          ))}

          <div className="flex min-h-48 flex-col justify-center gap-1 rounded-md border border-dashed p-6 text-center">
            <p className="text-sm">More machines</p>
            <p className="text-xs/relaxed text-muted-foreground">
              New machines appear here with their own tutorials, tasks and shelf in the warehouse.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Link
            href={`/world/${device}`}
            className="flex items-center gap-4 rounded-md border p-4 transition-colors hover:bg-accent/50"
          >
            <span className="flex size-10 items-center justify-center rounded-md bg-muted">
              <PlayIcon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Enter the workshop</p>
              <p className="text-xs text-muted-foreground">
                Walk the lobby and the shop: every machine in its bay, the warehouse, the tool crib, the level terminal ·{" "}
                {DEVICE_LABEL[device]}
              </p>
            </div>
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          </Link>

          <Link
            href="/warehouse"
            className="flex items-center gap-4 rounded-md border p-4 transition-colors hover:bg-accent/50"
          >
            <span className="flex size-10 items-center justify-center rounded-md bg-muted">
              <ShelfIcon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Warehouse</p>
              <p className="text-xs text-muted-foreground">
                {parts.length === 0
                  ? "The parts you machine and save end up on its shelves."
                  : `${parts.length} of ${limit} places used.`}
              </p>
            </div>
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          </Link>

          <Link
            href="/toolbox"
            className="flex items-center gap-4 rounded-md border p-4 transition-colors hover:bg-accent/50"
          >
            <span className="flex size-10 items-center justify-center rounded-md bg-muted">
              <ToolIcon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Toolbox</p>
              <p className="text-xs text-muted-foreground">
                The shop&apos;s tools — holders, cutters, sizes — and each machine&apos;s tool table.
              </p>
            </div>
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          </Link>
        </section>
      </main>
    </div>
  );
}
