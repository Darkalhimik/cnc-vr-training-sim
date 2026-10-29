"use client";

import { create } from "zustand";
import type { DeviceMode, GameMode } from "@/entities/machine/machine-types";
import type { MachinePartId } from "@/entities/machine/machine-parts";

/** Machine scale bounds. One rule, shared by the DOM slider in the side panel
 *  and the stepper on the in-scene VR board — they used to clamp separately. */
export const MACHINE_SCALE_MIN = 0.1;
export const MACHINE_SCALE_MAX = 2.0;
export const MACHINE_SCALE_STEP = 0.1;

/** Turning the machine is how an immersive user reaches its back and sides
 *  without walking round it: the air supply is on the rear panel. */
export const MACHINE_YAW_STEP = Math.PI / 2;

type SessionStore = {
  deviceMode: DeviceMode;
  gameMode: GameMode;
  isPaused: boolean;
  hintsEnabled: boolean;
  hoveredPart: MachinePartId | null;
  machineScale: number;
  /** Rotation of the whole machine about the vertical, in radians. */
  machineYaw: number;
  /** A request for the desktop camera to frame a part. `seq` changes on
   *  every request, so asking for the same part twice still moves it. */
  cameraFocus: { part: MachinePartId; seq: number } | null;

  setDeviceMode: (mode: DeviceMode) => void;
  setGameMode: (mode: GameMode) => void;
  togglePause: () => void;
  toggleHints: () => void;
  setHoveredPart: (part: MachinePartId | null) => void;
  setMachineScale: (scale: number) => void;
  turnMachine: (direction: 1 | -1) => void;
  focusCamera: (part: MachinePartId) => void;
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
  machineYaw: 0,
  cameraFocus: null,

  setDeviceMode: (mode) => set({ deviceMode: mode }),
  setGameMode: (mode) => set({ gameMode: mode }),
  togglePause: () => set((s) => ({ isPaused: !s.isPaused })),
  toggleHints: () => set((s) => ({ hintsEnabled: !s.hintsEnabled })),
  setHoveredPart: (part) => set({ hoveredPart: part }),
  setMachineScale: (scale) => set({ machineScale: clampScale(scale) }),
  turnMachine: (direction) =>
    set((s) => ({
      machineYaw: (s.machineYaw + direction * MACHINE_YAW_STEP + 2 * Math.PI) % (2 * Math.PI),
    })),
  focusCamera: (part) =>
    set((s) => ({ cameraFocus: { part, seq: (s.cameraFocus?.seq ?? 0) + 1 } })),
}));
