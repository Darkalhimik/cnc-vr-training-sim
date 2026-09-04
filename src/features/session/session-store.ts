"use client";

import { create } from "zustand";
import type { DeviceMode, GameMode } from "@/entities/machine/machine-types";
import type { MachinePartId } from "@/entities/machine/machine-parts";

/** Machine scale bounds. One rule, shared by the DOM slider in the side panel
 *  and the stepper on the in-scene VR board — they used to clamp separately. */
export const MACHINE_SCALE_MIN = 0.1;
export const MACHINE_SCALE_MAX = 2.0;
export const MACHINE_SCALE_STEP = 0.1;

type SessionStore = {
  deviceMode: DeviceMode;
  gameMode: GameMode;
  isPaused: boolean;
  hintsEnabled: boolean;
  hoveredPart: MachinePartId | null;
  machineScale: number;

  setDeviceMode: (mode: DeviceMode) => void;
  setGameMode: (mode: GameMode) => void;
  togglePause: () => void;
  toggleHints: () => void;
  setHoveredPart: (part: MachinePartId | null) => void;
  setMachineScale: (scale: number) => void;
};

function clampScale(scale: number) {
  return Math.max(
    MACHINE_SCALE_MIN,
    Math.min(MACHINE_SCALE_MAX, Math.round(scale * 100) / 100),
  );
}

export const useSessionStore = create<SessionStore>((set) => ({
  deviceMode: "desktop",
  gameMode: "tutorial",
  isPaused: false,
  hintsEnabled: false,
  hoveredPart: null,
  machineScale: 1.0,

  setDeviceMode: (mode) => set({ deviceMode: mode }),
  setGameMode: (mode) => set({ gameMode: mode }),
  togglePause: () => set((s) => ({ isPaused: !s.isPaused })),
  toggleHints: () => set((s) => ({ hintsEnabled: !s.hintsEnabled })),
  setHoveredPart: (part) => set({ hoveredPart: part }),
  setMachineScale: (scale) => set({ machineScale: clampScale(scale) }),
}));
