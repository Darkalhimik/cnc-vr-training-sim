/**
 * The machines the trainer has. One today; the dashboard, the level map and
 * the warehouse are all keyed by machine so the next one is a new entry here,
 * its model, and its levels.
 *
 * Specs are the ones the simulation is built to (docs/haas-ngc/umc500.md).
 */
import type { SpindleInterface } from "@/entities/tooling/catalog";

export type MachineId = "umc500";

export type MachineSpec = { label: string; value: string };

/** What the spindle takes and what the tool changer can hold: the limits a
 *  machine's loadout is checked against (entities/tooling/loadout.ts). */
export type MachineTooling = {
  interface: SpindleInterface;
  pockets: number;
  /** Largest cutter with tools in both neighbouring pockets, mm. */
  maxDiameter: number;
  /** Largest cutter at all, with both neighbours empty, mm. */
  maxDiameterLarge: number;
  /** Gauge line to tip, mm. */
  maxLength: number;
  /** Kilograms. */
  maxMass: number;
  /** From this mass the tool is flagged heavy and the changer slows, kg. */
  heavyFrom: number;
};

export type MachineInfo = {
  id: MachineId;
  /** URL segment: /machines/<slug>. */
  slug: string;
  maker: string;
  name: string;
  kind: string;
  /** One line under the name. */
  summary: string;
  modelUrl: string;
  /** Plan size with the doors shut, metres: [across the front, front to back].
   *  Its bay in the workshop is laid out around it. */
  footprint: [number, number];
  /** The few numbers an operator asks first, in the order they ask. */
  specs: MachineSpec[];
  tooling: MachineTooling;
};

export const MACHINES: MachineInfo[] = [
  {
    id: "umc500",
    slug: "umc-500",
    maker: "Haas",
    name: "UMC-500",
    kind: "5-axis universal machining centre",
    summary: "Trunnion B/C table, NGC control, 30-pocket side-mount tool changer.",
    modelUrl: "/models/umc500.glb",
    footprint: [2.9, 2.8],
    specs: [
      { label: "Travels", value: "X610 Y406 Z406 mm" },
      { label: "Trunnion", value: "B −35…+120° · C 360°" },
      { label: "Spindle", value: "8 100 rpm · 40 taper" },
      { label: "Tools", value: "30 + 1 SMTC" },
      { label: "Platter", value: "Ø400 mm" },
      { label: "Control", value: "Haas NGC" },
    ],
    // docs/haas-ngc/umc500.md §8 and operation.md §7.1. The factory offers
    // CT40 or BT40; the trainer's crib is CT40.
    tooling: {
      interface: "CT40",
      pockets: 30,
      maxDiameter: 64,
      maxDiameterLarge: 127,
      maxLength: 305,
      maxMass: 5.4,
      heavyFrom: 1.8,
    },
  },
];

export const machineBySlug = (slug: string) => MACHINES.find((m) => m.slug === slug) ?? null;
export const machineById = (id: string) => MACHINES.find((m) => m.id === id) ?? null;
export const isMachineId = (id: unknown): id is MachineId => MACHINES.some((m) => m.id === id);
