"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MACHINES, machineById } from "@/entities/catalog/machines";
import { assemblyById } from "@/entities/tooling/catalog";
import { DEVICE_LABEL, DEVICE_MODES, type DeviceMode } from "@/entities/machine/machine-types";
import { roomAt } from "@/entities/world/layout";
import { useWarehouseStore } from "@/features/warehouse/warehouse-api";
import { PartInspector, partSize } from "@/features/warehouse/part-inspector";
import { useLevelSession } from "@/features/levels/level-session";
import { cn } from "@/shared/lib/cn";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { MATERIALS, type StockMaterial } from "@/entities/part/tool-library";
import { CribList } from "@/features/tooling/ui/crib-list";
import { LoadoutEditor } from "@/features/tooling/ui/loadout-editor";
import { ToolDetails } from "@/features/tooling/ui/tool-details";
import { ThemeToggle } from "@/widgets/theme-toggle/theme-toggle";
import { startLevel } from "./world-session";
import { WORLD, useWorldStore } from "./world-store";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-t p-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide">{title}</h3>
      {children}
    </section>
  );
}

const DEVICE_SHORT: Record<DeviceMode, string> = { desktop: "Desktop", vr: "VR", glasses: "Glasses", phone: "Phone" };

function DeviceSwitch({ device }: { device: DeviceMode }) {
  const router = useRouter();
  const search = useSearchParams();
  return (
    <SegmentedControl
      options={DEVICE_MODES.map((d) => ({ value: d, label: DEVICE_SHORT[d] }))}
      value={device}
      onChange={(d) => router.push(`/world/${d}${search.size ? `?${search}` : ""}`)}
      fill
    />
  );
}

/** Keys and gestures, for whoever has not walked the workshop before. */
function Controls({ device }: { device: DeviceMode }) {
  const rows =
    device === "desktop"
      ? [
          ["W A S D", "walk"],
          ["Drag", "look around"],
          ["Shift", "run"],
          ["Click", "go to a machine, the warehouse, the tool crib or the terminal"],
          ["Esc", "step back from a station"],
        ]
      : [
          ["Walk", "your own room moves you too"],
          ["Left stick", "move"],
          ["Right stick", "turn"],
          ["Teleport", "point at the floor, pull and release"],
          ["Trigger / pinch", "press buttons and keys"],
        ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">{k}</kbd>
          </dt>
          <dd className="text-muted-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The workshop's panel while walking (desktop) or before entering VR: where
 * you are, the level in progress, the stations to go to, the controls.
 */
export function WorldPanel({
  device,
  onEnterImmersive,
  xrError,
  className,
}: {
  device: DeviceMode;
  onEnterImmersive: () => void;
  xrError: string | null;
  className?: string;
}) {
  const level = useLevelSession((s) => s.level);
  const goTo = useWorldStore((s) => s.goTo);
  const room = useWorldStore((s) => roomAt(WORLD, s.player.position)?.label ?? "Workshop");
  const machine = MACHINES[0];
  const stations = WORLD.stations.filter((s) => s.kind !== "bay");

  return (
    <aside className={cn("flex min-w-0 flex-col overflow-y-auto border-l bg-background", className)}>
      <header className="flex items-center justify-between gap-2 p-3">
        <Link
          href={`/machines/${machine.slug}/levels${level ? `?level=${encodeURIComponent(level.id)}` : ""}`}
          className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          ← Levels
        </Link>
        <ThemeToggle />
      </header>

      <section className="space-y-2 border-t p-3">
        <div className="space-y-0.5">
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Workshop · {room}</p>
          <h2 className="text-sm font-semibold tracking-tight">{level ? level.title : "Free play"}</h2>
          {level && <p className="text-xs/relaxed text-muted-foreground">{level.goal}</p>}
        </div>
        <DeviceSwitch device={device} />
        {level && (
          <Button size="sm" variant="ghost" onClick={() => startLevel(null)}>
            End level, back to free play
          </Button>
        )}
      </section>

      {device === "vr" && (
        <Section title="Headset">
          <Button size="lg" className="w-full" onClick={onEnterImmersive}>
            Enter VR
          </Button>
          {xrError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{xrError}</p>
          ) : (
            <p className="text-xs/relaxed text-muted-foreground">
              Open this page in the headset&apos;s browser and press Enter VR. Here you see a preview.
            </p>
          )}
        </Section>
      )}

      <Section title="Go to">
        <ul className="grid gap-1">
          {stations.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => goTo(s.id)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent"
              >
                <span>{s.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{roomAt(WORLD, s.position)?.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`Controls · ${DEVICE_LABEL[device]}`}>
        <Controls device={device} />
      </Section>
    </aside>
  );
}

/** Standing at the warehouse on a desktop: the shelves as a list, and the part picked. */
export function WarehousePanel({ className }: { className?: string }) {
  const parts = useWarehouseStore((s) => s.parts);
  const limit = useWarehouseStore((s) => s.limit);
  const selected = useWorldStore((s) => s.selectedPart);
  const selectPart = useWorldStore((s) => s.selectPart);
  const leave = useWorldStore((s) => s.leave);
  const current = parts.find((p) => p.id === selected) ?? null;

  return (
    <aside className={cn("flex min-w-0 flex-col overflow-y-auto border-l bg-background", className)}>
      <header className="flex items-center justify-between gap-2 p-3">
        <button
          type="button"
          onClick={leave}
          className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          ← Workshop
        </button>
        <ThemeToggle />
      </header>
      {current ? (
        <div className="border-t p-4">
          <PartInspector part={current} onClose={() => selectPart(null)} />
        </div>
      ) : (
        <div className="space-y-3 border-t p-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold tracking-tight">Warehouse</h2>
            <span className="font-mono text-xs text-muted-foreground">
              {parts.length}/{limit}
            </span>
          </div>
          {parts.length === 0 && (
            <p className="text-xs/relaxed text-muted-foreground">Cut a part at a machine and save it: it goes on a shelf here.</p>
          )}
          <ul className="space-y-1">
            {parts.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => selectPart(p.id)}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
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
  );
}

function StationHeader({ onLeave }: { onLeave: () => void }) {
  return (
    <header className="flex items-center justify-between gap-2 p-3">
      <button
        type="button"
        onClick={onLeave}
        className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        ← Workshop
      </button>
      <ThemeToggle />
    </header>
  );
}

/** Standing at the tool crib: every tool the shop has, and the one picked —
 *  its close-up, its holder and cutter, and where it is loaded. */
export function ToolboxPanel({ className }: { className?: string }) {
  const selected = useWorldStore((s) => s.selectedTool);
  const selectTool = useWorldStore((s) => s.selectTool);
  const leave = useWorldStore((s) => s.leave);
  const tool = selected ? assemblyById(selected) : null;
  return (
    <aside className={cn("flex min-w-0 flex-col overflow-y-auto border-l bg-background", className)}>
      <StationHeader onLeave={leave} />
      <div className="border-t p-3">
        {tool ? (
          <ToolDetails tool={tool} machines={MACHINES} onClose={() => selectTool(null)} />
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold tracking-tight">Tool crib</h2>
              <p className="text-xs/relaxed text-muted-foreground">
                The shop&apos;s tools, CT40: they fit every 40-taper mill. Pick one to see its holder and cutter; load it into a
                machine at that machine&apos;s tool cart. A tool that is in a machine has left its place here: it shows as a
                pale ghost.
              </p>
            </div>
            <CribList machine={MACHINES[0]} selected={selected} onSelect={selectTool} />
          </div>
        )}
      </div>
    </aside>
  );
}

/** Standing at a machine's tool cart: its tool table to set up, and the
 *  tool picked on the cart or in the table. */
export function ToolCartPanel({ machineId, className }: { machineId: string; className?: string }) {
  const machine = machineById(machineId) ?? MACHINES[0];
  const selected = useWorldStore((s) => s.selectedTool);
  const selectTool = useWorldStore((s) => s.selectTool);
  const leave = useWorldStore((s) => s.leave);
  const tool = selected ? assemblyById(selected) : null;
  return (
    <aside className={cn("flex min-w-0 flex-col overflow-y-auto border-l bg-background", className)}>
      <StationHeader onLeave={leave} />
      <div className="border-t p-3">
        {tool ? (
          <ToolDetails tool={tool} machines={[machine]} onClose={() => selectTool(null)} />
        ) : (
          <LoadoutEditor machine={machine} selected={selected} onInspect={selectTool} />
        )}
      </div>
    </aside>
  );
}
