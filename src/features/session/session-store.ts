"use client";

import { create } from "zustand";
import type { DeviceMode, GameMode } from "@/entities/machine/machine-types";
import type { MachinePartId } from "@/entities/machine/machine-parts";

type SessionStore = {
  deviceMode: DeviceMode;
  gameMode: GameMode;
  isPaused: boolean;
  hintsEnabled: boolean;
  hoveredPart: MachinePartId | null;

  setDeviceMode: (mode: DeviceMode) => void;
  setGameMode: (mode: GameMode) => void;
  togglePause: () => void;
  toggleHints: () => void;
  setHoveredPart: (part: MachinePartId | null) => void;
};

export const useSessionStore = create<SessionStore>((set) => ({
  deviceMode: "desktop",
  gameMode: "tutorial",
  isPaused: false,
  hintsEnabled: false,
  hoveredPart: null,

  setDeviceMode: (mode) => set({ deviceMode: mode }),
  setGameMode: (mode) => set({ gameMode: mode }),
  togglePause: () => set((s) => ({ isPaused: !s.isPaused })),
  toggleHints: () => set((s) => ({ hintsEnabled: !s.hintsEnabled })),
  setHoveredPart: (part) => set({ hoveredPart: part }),
}));
