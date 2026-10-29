"use client";

import { create } from "zustand";
import { MACHINES, type MachineId } from "@/entities/catalog/machines";
import { useMachineStore } from "@/entities/machine/machine-store";
import type { ToolOffset } from "@/entities/machine/machine-types";
import { loadedPockets } from "@/entities/machine/tool-changer";
import { activeTools, loadoutTools, setActiveTools, type LibraryTool } from "@/entities/part/tool-library";
import { STANDARD_LOADOUT, sortLoadout, type Loadout } from "@/entities/tooling/loadout";
import { ensureSession } from "@/shared/lib/auth-client";

type ToolingStore = {
  /** What each machine has loaded, as saved; a machine not here carries
   *  the standard set. */
  loadouts: Partial<Record<MachineId, Loadout>>;
  /** Whose loadouts these are: undefined until loaded. */
  user: string | null | undefined;
  load: (user: string | null, attempt?: number) => Promise<void>;
  /** Keep a machine's loadout. Resolves to an error message, or null. */
  save: (machineId: MachineId, loadout: Loadout) => Promise<string | null>;
};

export const useToolingStore = create<ToolingStore>((set, get) => ({
  loadouts: {},
  user: undefined,
  load: async (user, attempt = 0) => {
    if (get().user === user) return;
    const entries = await Promise.all(
      MACHINES.map(async (m) => {
        if (!user) return { id: m.id, ok: true, tools: null };
        const response = await fetch(`/api/tooling?machine=${m.id}`).catch(() => null);
        const body = response?.ok ? ((await response.json().catch(() => null)) as { tools: Loadout | null } | null) : null;
        return { id: m.id, ok: !!body, tools: body?.tools ?? null };
      }),
    );
    const loadouts = Object.fromEntries(entries.filter((e) => e.tools).map((e) => [e.id, e.tools!]));
    // A failed request (the server restarting, a dropped connection) must not
    // pass for "nothing saved": try again shortly, a few times.
    if (entries.some((e) => !e.ok)) {
      set({ loadouts: { ...get().loadouts, ...loadouts } });
      if (attempt < 3) setTimeout(() => void get().load(user, attempt + 1), 2000 * (attempt + 1));
      return;
    }
    set({ loadouts, user });
  },
  save: async (machineId, loadout) => {
    if (!(await ensureSession())) return "Could not start a guest session.";
    const tools = sortLoadout(loadout);
    const response = await fetch("/api/tooling", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ machine: machineId, tools }),
    }).catch(() => null);
    if (!response?.ok) {
      const body = await response?.json().catch(() => null);
      return (body?.error as string | undefined) ?? "The loadout could not be saved.";
    }
    set((s) => ({ loadouts: { ...s.loadouts, [machineId]: tools } }));
    return null;
  },
}));

/** A machine's loadout: its own if saved, else the standard set. */
export const loadoutFor = (machineId: MachineId, loadouts = useToolingStore.getState().loadouts): Loadout =>
  loadouts[machineId] ?? STANDARD_LOADOUT;

/** The tools free play runs a machine with. */
export const freePlayTools = (machineId: MachineId) => loadoutTools(loadoutFor(machineId));

/**
 * Puts another set of tools in the machine, as an operator would through the
 * spindle: T in pocket T, the spindle keeping its tool if it stays. A tool
 * that is still the same keeps its measured length; a new one has to be
 * measured. Refused while a program runs. Null when done.
 */
export function loadIntoMachine(tools: LibraryTool[]): string | null {
  const before = activeTools();
  const unchanged =
    tools.length === before.length && tools.every((t, i) => t.number === before[i].number && t.assembly === before[i].assembly);
  if (unchanged) return null;
  const store = useMachineStore.getState();
  const m = store.machine;
  if (m.program !== "idle") return "Stop the program before changing tools.";

  const was = new Map(before.map((t) => [t.number, t.assembly]));
  const offsets: Record<number, ToolOffset> = {};
  for (const t of tools) {
    const kept = was.get(t.number) === t.assembly ? m.tools[t.number] : undefined;
    offsets[t.number] = kept ?? { length: 0, lengthWear: 0, diameter: t.diameter, diameterWear: 0 };
  }
  const numbers = tools.map((t) => t.number);
  const spindle = numbers.includes(m.toolInSpindle) ? m.toolInSpindle : (numbers[0] ?? 0);
  setActiveTools(tools);
  store.setMagazine({ tools: offsets, pockets: loadedPockets(numbers, spindle), toolInSpindle: spindle, carouselPocket: spindle || 1 });
  return null;
}
