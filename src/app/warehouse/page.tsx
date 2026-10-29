"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MATERIALS, type StockMaterial } from "@/entities/part/tool-library";
import { useWarehouseStore } from "@/features/warehouse/warehouse-api";
import { PartInspector, partSize } from "@/features/warehouse/part-inspector";
import { useSession } from "@/shared/lib/auth-client";
import { cn } from "@/shared/lib/cn";
import { Badge } from "@/shared/ui/badge";
import { ToastContainer } from "@/shared/ui/toast";
import { AppHeader } from "@/widgets/app-header/app-header";
import { Meter } from "@/widgets/machine-progress/machine-progress";

const WarehouseScene = dynamic(() => import("@/widgets/warehouse-scene/warehouse-scene").then((m) => m.WarehouseScene), {
  ssr: false,
  loading: () => null,
});

export default function WarehousePage() {
  const { data, isPending } = useSession();
  const user = data?.user.id ?? null;
  const parts = useWarehouseStore((s) => s.parts);
  const limit = useWarehouseStore((s) => s.limit);
  const loaded = useWarehouseStore((s) => s.loaded);
  const loadedFor = useWarehouseStore((s) => s.user);
  const load = useWarehouseStore((s) => s.load);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending) void load(user, true);
  }, [user, isPending, load]);

  const current = parts.find((p) => p.id === selected) ?? null;

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader crumbs={[{ label: "Warehouse" }]} />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="relative min-h-[50vh] flex-1 bg-stage">
          <WarehouseScene parts={parts} selected={selected} onSelect={setSelected} />
          {/* Only once this user's list is in: a stale empty one would flash. */}
          {loaded && !isPending && loadedFor === user && parts.length === 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-8 mx-auto w-fit max-w-sm rounded-md border bg-background/85 px-4 py-3 text-center backdrop-blur">
              <p className="text-sm">The shelves are empty</p>
              <p className="text-xs/relaxed text-muted-foreground">
                Cut a part in free play or a task, then press Save to warehouse.
              </p>
            </div>
          )}
        </section>

        <aside className="flex w-full shrink-0 flex-col overflow-y-auto border-t bg-background lg:w-80 lg:border-l lg:border-t-0">
          {current ? (
            <div className="p-4">
              <PartInspector part={current} onClose={() => setSelected(null)} />
            </div>
          ) : (
            <div className="space-y-4 p-4">
              <header className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <h1 className="text-lg font-semibold tracking-tight">Warehouse</h1>
                  <span className="font-mono text-xs text-muted-foreground">
                    {parts.length}/{limit}
                  </span>
                </div>
                <Meter value={parts.length} max={limit} />
                {data?.user && (data.user as { isAnonymous?: boolean }).isAnonymous && parts.length > 0 && (
                  <p className="text-xs/relaxed text-muted-foreground">
                    Saved as a guest.{" "}
                    <Link href="/sign-in?next=/warehouse" className="underline underline-offset-2">
                      Create an account
                    </Link>{" "}
                    to keep them.
                  </p>
                )}
              </header>
              <ul className="space-y-1">
                {parts.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(p.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent",
                        selected === p.id && "bg-accent",
                      )}
                    >
                      <span
                        className="size-3 shrink-0 rounded-sm ring-1 ring-inset ring-black/10"
                        style={{ background: MATERIALS[p.material as StockMaterial]?.color }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs">{p.name}</span>
                        <span className="block font-mono text-[10px] text-muted-foreground">{partSize(p)}</span>
                      </span>
                      {p.score !== null && <Badge tone={p.score >= 85 ? "emerald" : p.score >= 60 ? "amber" : "rose"}>{p.score}%</Badge>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
      <ToastContainer className="fixed bottom-4 right-4 z-50" />
    </div>
  );
}
