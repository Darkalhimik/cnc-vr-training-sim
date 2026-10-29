"use client";

import { create } from "zustand";
import type { MachineRig } from "./machine-rig";

/**
 * The loaded machine rig, for things outside the model that need a piece of
 * it — the full-size pendant mirrors the machine pendant's screen texture
 * rather than painting a second one.
 */
export const useRigRegistry = create<{ rig: MachineRig | null; setRig: (rig: MachineRig | null) => void }>(
  (set) => ({ rig: null, setRig: (rig) => set({ rig }) }),
);
