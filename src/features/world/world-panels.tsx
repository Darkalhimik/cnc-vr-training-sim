"use client";

import Link from "next/link";
import { useState } from "react";
import { XR_MOVEMENTS, useSessionStore, type XrMovement } from "@/features/session/session-store";
import { useRouter, useSearchParams } from "next/navigation";
import { MACHINES, machineById } from "@/entities/catalog/machines";
import { assemblyById } from "@/entities/tooling/catalog";
import { DEVICE_LABEL, DEVICE_MODES, DEVICE_SHORT, type DeviceMode } from "@/entities/machine/machine-types";
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
import { ImmersiveLaunch } from "@/widgets/hud/immersive-launch";
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
          ["Shift", "run"],
          ["Ctrl", "tap to crouch, tap again to stand up"],
          ["← →", "turn"],
          ["Drag", "look around"],
          ["Wheel", "zoom in on a small control"],
          ["Click", "use a machine, the warehouse or a tool rack: its menu opens where you stand"],
          ["Esc", "close the menu"],
        ]
      : [
          ["Walk", "your own room moves you, in every movement mode"],
          ["Trigger on the floor", "jump there (Teleport mode)"],
          ["Stick forward", "aim a teleport arc, let go to jump (Teleport mode)"],
          ["Left stick", "walk (Joystick mode)"],
          ["Right stick", "sideways: turn in steps (Teleport and Joystick)"],
          ["Trigger / pinch", "on the machine or a board: press buttons, keys and levers"],
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

      {device === "vr" && <ImmersiveLaunch device="vr" onEnter={onEnterImmersive} error={xrError} />}

      {device === "vr" && (
        <Section title="Movement">
          <MovementSwitch />
        </Section>
      )}

      <Section title="Walk to">
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

/** The warehouse's menu on a desktop: the shelves as a list, and the part picked. */
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

/** The tool crib's menu: every tool the shop has, and the one picked —
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

/** A machine's tool cart: its tool table to set up, and the tool picked on
 *  the cart or in the table. */
function ToolCartContent({ machineId }: { machineId: string }) {
  const machine = machineById(machineId) ?? MACHINES[0];
  const selected = useWorldStore((s) => s.selectedTool);
  const selectTool = useWorldStore((s) => s.selectTool);
  const tool = selected ? assemblyById(selected) : null;
  return tool ? (
    <ToolDetails tool={tool} machines={[machine]} onClose={() => selectTool(null)} />
  ) : (
    <LoadoutEditor machine={machine} selected={selected} onInspect={selectTool} />
  );
}

/** The tool cart's menu in the workshop. */
export function ToolCartPanel({ machineId, className }: { machineId: string; className?: string }) {
  const leave = useWorldStore((s) => s.leave);
  return (
    <aside className={cn("flex min-w-0 flex-col overflow-y-auto border-l bg-background", className)}>
      <StationHeader onLeave={leave} />
      <div className="border-t p-3">
        <ToolCartContent machineId={machineId} />
      </div>
    </aside>
  );
}

/** Teleport, walk or joystick, for VR and AR glasses. */
function MovementSwitch() {
  const movement = useSessionStore((s) => s.xrMovement);
  const setMovement = useSessionStore((s) => s.setXrMovement);
  const help: Record<XrMovement, string> = {
    teleport:
      "Point at the floor and press the trigger (or pinch) to jump there — or push a stick forward, aim the arc, let go. Pointed at the machine, the press presses the machine. The right stick sideways turns.",
    walk: "Only your own steps move you. Turn by turning round.",
    joystick: "The left stick walks you, the right stick turns.",
  };
  return (
    <div className="space-y-2">
      <SegmentedControl options={XR_MOVEMENTS} value={movement} onChange={setMovement} fill />
      <p className="text-xs/relaxed text-muted-foreground">
        {help[movement]} In every mode the trigger presses what the ray points at. Choose before entering the glasses.
      </p>
    </div>
  );
}

/**
 * AR glasses and phones have no workshop: this menu stands in for it. Which
 * machine is out (only the UMC-500 runs today; the others are listed for
 * when they do), that machine's tool cart, and — in the glasses — how to
 * get about.
 */
export function ArMenu({ device }: { device: DeviceMode }) {
  const arMachineId = useWorldStore((s) => s.arMachineId);
  const setArMachine = useWorldStore((s) => s.setArMachine);
  const [cartOpen, setCartOpen] = useState(false);
  return (
    <>
      <Section title="Machine">
        <ul className="grid gap-1">
          {MACHINES.map((m) => {
            const runs = m.id === "umc500";
            return (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={!runs}
                  onClick={() => setArMachine(m.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent disabled:opacity-50",
                    m.id === arMachineId && "bg-accent font-medium",
                  )}
                >
                  <span>
                    {m.maker} {m.name}
                  </span>
                  {!runs && <span className="text-[10px] text-muted-foreground">soon</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </Section>
      <Section title="Tool cart">
        {cartOpen ? (
          <div className="space-y-2">
            <ToolCartContent machineId={arMachineId} />
            <Button size="sm" variant="ghost" onClick={() => setCartOpen(false)}>
              Close the cart
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 text-xs/relaxed text-muted-foreground">Load and unload this machine&apos;s tools.</p>
            <Button size="md" variant="secondary" onClick={() => setCartOpen(true)}>
              Open
            </Button>
          </div>
        )}
      </Section>
      {device === "glasses" && (
        <Section title="Movement">
          <MovementSwitch />
        </Section>
      )}
    </>
  );
}
