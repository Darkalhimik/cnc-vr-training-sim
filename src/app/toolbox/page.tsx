"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { MACHINES, isMachineId, type MachineId } from "@/entities/catalog/machines";
import { loadoutTools } from "@/entities/part/tool-library";
import { CRIB, assemblyById } from "@/entities/tooling/catalog";
import { useToolingStore } from "@/features/tooling/tooling-store";
import { CribList } from "@/features/tooling/ui/crib-list";
import { LoadoutEditor } from "@/features/tooling/ui/loadout-editor";
import { ToolDetails } from "@/features/tooling/ui/tool-details";
import { useSession } from "@/shared/lib/auth-client";
import { Button } from "@/shared/ui/button";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { ToastContainer } from "@/shared/ui/toast";
import { AppHeader } from "@/widgets/app-header/app-header";

const ToolViewer = dynamic(() => import("@/features/tooling/ui/tool-viewer").then((m) => m.ToolViewer), {
  ssr: false,
  loading: () => null,
});

type Tab = "crib" | MachineId;

/**
 * The toolbox: the shop's crib — every tool, its holder and its cutter — and
 * each machine's tool table, set up from it. The same as the crib in the
 * workshop's lobby and the cart beside each machine, on one page.
 */
export default function ToolboxPage() {
  const { data, isPending } = useSession();
  const load = useToolingStore((s) => s.load);
  const [tab, setTab] = useState<Tab>("crib");
  const [selected, setSelected] = useState<string>(CRIB[0].id);
  const [exploded, setExploded] = useState(false);

  useEffect(() => {
    if (!isPending) void load(data?.user.id ?? null);
  }, [data?.user.id, isPending, load]);

  // ?machine=umc500 opens that machine's tool table.
  useEffect(() => {
    const machine = new URLSearchParams(window.location.search).get("machine");
    if (isMachineId(machine)) setTab(machine);
  }, []);

  const tool = assemblyById(selected) ?? CRIB[0];
  const shown = loadoutTools([{ number: 0, assembly: tool.id }])[0];
  const machine = tab === "crib" ? null : (MACHINES.find((m) => m.id === tab) ?? null);

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader crumbs={[{ label: "Toolbox" }]} />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="relative min-h-[40vh] flex-1 bg-stage">
          <ToolViewer tool={shown} exploded={exploded} className="absolute inset-0 rounded-none" />
          <div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between gap-3">
            <p className="rounded-md bg-background/85 px-3 py-1.5 text-sm font-medium backdrop-blur">{tool.name}</p>
            <Button className="pointer-events-auto bg-background" variant="secondary" onClick={() => setExploded((e) => !e)}>
              {exploded ? "Assemble" : "Take apart"}
            </Button>
          </div>
          <p className="pointer-events-none absolute bottom-3 left-4 text-xs text-muted-foreground">Drag to turn · scroll to zoom</p>
        </section>

        <aside className="w-full shrink-0 overflow-y-auto border-t bg-background p-4 lg:w-80 lg:border-l lg:border-t-0">
          <ToolDetails tool={tool} machines={MACHINES} viewer={false} />
        </aside>

        <aside className="flex w-full shrink-0 flex-col overflow-y-auto border-t bg-background lg:w-80 lg:border-l lg:border-t-0">
          <div className="space-y-2 p-4 pb-2">
            <h1 className="text-lg font-semibold tracking-tight">Toolbox</h1>
            <SegmentedControl
              options={[
                { value: "crib" as Tab, label: "Crib" },
                ...MACHINES.map((m) => ({ value: m.id as Tab, label: `${m.name} table` })),
              ]}
              value={tab}
              onChange={setTab}
              fill
            />
          </div>
          <div className="p-4 pt-2">
            {machine ? (
              <LoadoutEditor machine={machine} selected={selected} onInspect={setSelected} />
            ) : (
              <CribList machine={MACHINES[0]} selected={selected} onSelect={setSelected} />
            )}
          </div>
        </aside>
      </div>
      <ToastContainer className="fixed bottom-4 right-4 z-50" />
    </div>
  );
}
