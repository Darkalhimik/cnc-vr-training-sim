"use client";

import { create } from "zustand";
import type { Vec3 } from "@/features/part-development/removal/grid";
import { ensureSession } from "@/shared/lib/auth-client";
import { decodeField, encodeField, previewField, type PartField } from "./part-field";

/** A part as /api/parts lists it. */
export type PartSummary = {
  id: string;
  machineId: string;
  name: string;
  material: string;
  stock: [number, number, number];
  source: "freeplay" | "task";
  levelId: string | null;
  score: number | null;
  cycleSeconds: number | null;
  volumeMm3: number | null;
  bytes: number;
  createdAt: string;
};

export type PartDetail = PartSummary & { program: string; design: unknown };

type WarehouseStore = {
  parts: PartSummary[];
  limit: number;
  loaded: boolean;
  user: string | null;
  load: (user: string | null, force?: boolean) => Promise<void>;
};

export const useWarehouseStore = create<WarehouseStore>((set, get) => ({
  parts: [],
  limit: 30,
  loaded: false,
  user: null,
  load: async (user, force) => {
    if (!force && get().loaded && get().user === user) return;
    const response = await fetch("/api/parts").catch(() => null);
    const body = response?.ok ? await response.json() : { parts: [], limit: 30 };
    set({ parts: body.parts, limit: body.limit, loaded: true, user });
  },
}));

async function errorOf(response: Response | null, fallback: string) {
  const body = await response?.json().catch(() => null);
  return (body?.error as string | undefined) ?? fallback;
}

export type SavePartInput = {
  machineId: string;
  name: string;
  material: string;
  stock: Vec3;
  program: string;
  design?: unknown;
  levelId?: string | null;
  score?: number | null;
  cycleSeconds?: number | null;
  field: PartField & { volumeMm3?: number };
};

/** Put a machined part on a shelf. Signs a guest in first if needed. */
export async function savePart(input: SavePartInput): Promise<{ part: PartSummary } | { error: string }> {
  if (!(await ensureSession())) return { error: "Could not start a guest session." };
  const [field, preview] = await Promise.all([
    encodeField(input.field),
    encodeField(previewField(input.field, input.stock)),
  ]);
  const form = new FormData();
  form.set(
    "meta",
    JSON.stringify({
      machineId: input.machineId,
      name: input.name,
      material: input.material,
      stock: input.stock,
      program: input.program,
      design: input.design ?? null,
      levelId: input.levelId ?? null,
      score: input.score ?? null,
      cycleSeconds: input.cycleSeconds ?? null,
      volumeMm3: input.field.volumeMm3 ?? null,
    }),
  );
  form.set("field", field);
  form.set("preview", preview);
  const response = await fetch("/api/parts", { method: "POST", body: form }).catch(() => null);
  if (!response?.ok) return { error: await errorOf(response, "The part could not be saved.") };
  const { part } = (await response.json()) as { part: PartSummary };
  useWarehouseStore.setState((s) => ({ parts: [part, ...s.parts] }));
  return { part };
}

export async function getPart(id: string): Promise<PartDetail | null> {
  const response = await fetch(`/api/parts/${id}`).catch(() => null);
  return response?.ok ? (await response.json()).part : null;
}

/** A part's geometry; the browser caches it for good (it never changes). */
export async function getPartField(id: string, size: "preview" | "full"): Promise<PartField> {
  const response = await fetch(`/api/parts/${id}/field${size === "preview" ? "?size=preview" : ""}`);
  if (!response.ok) throw new Error(await errorOf(response, "The part could not be loaded."));
  return decodeField(await response.arrayBuffer());
}

export async function renamePart(id: string, name: string): Promise<string | null> {
  const response = await fetch(`/api/parts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  }).catch(() => null);
  if (!response?.ok) return errorOf(response, "The part could not be renamed.");
  const { part } = (await response.json()) as { part: PartSummary };
  useWarehouseStore.setState((s) => ({ parts: s.parts.map((p) => (p.id === id ? part : p)) }));
  return null;
}

export async function deletePart(id: string): Promise<string | null> {
  const response = await fetch(`/api/parts/${id}`, { method: "DELETE" }).catch(() => null);
  if (!response?.ok) return errorOf(response, "The part could not be removed.");
  useWarehouseStore.setState((s) => ({ parts: s.parts.filter((p) => p.id !== id) }));
  return null;
}
