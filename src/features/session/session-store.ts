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

/**
 * How a trainee in VR or AR glasses gets about beyond their own steps:
 * - teleport: point the arc at the floor and pull the trigger; the right
 *   stick snap-turns;
 * - walk: only their own feet — nothing moves them but walking;
 * - joystick: the left stick walks them smoothly, the right stick snap-turns,
 *   the trigger presses what the ray points at.
 */
export type XrMovement = "teleport" | "walk" | "joystick";
export const XR_MOVEMENTS: { value: XrMovement; label: string }[] = [
  { value: "teleport", label: "Teleport" },
  { value: "walk", label: "Walk" },
  { value: "joystick", label: "Joystick" },
];
const XR_MOVEMENT_KEY = "cnc-xr-movement";

type SessionStore = {
  deviceMode: DeviceMode;
  gameMode: GameMode;
  isPaused: boolean;
  hintsEnabled: boolean;
  hoveredPart: MachinePartId | null;
  machineScale: number;
  /** Rotation of the whole machine about the vertical, in radians. */
  machineYaw: number;
  /** "Show me": a request for the desktop player to look at a scene node (a
   *  part's anchor) — turning, and walking round the machine first if it
   *  cannot be seen from where they stand. `seq` changes on every request, so
   *  asking for the same node twice still turns them. */
  cameraFocus: { node: string; seq: number } | null;
  /** The full-size NGC pendant beside the machine. */
  fullPanelOpen: boolean;
  /** The desktop keyboard types into the full panel instead of walking:
   *  from when the panel opens or is clicked, until Esc or a click elsewhere. */
  panelKeyboard: boolean;
  /** The time stamp of the last pointer event on the full panel, so a click
   *  elsewhere can tell it was not on the panel. */
  panelPointerAt: number;
  /** Movement in VR and AR glasses; kept per browser. */
  xrMovement: XrMovement;

  setDeviceMode: (mode: DeviceMode) => void;
  setGameMode: (mode: GameMode) => void;
  togglePause: () => void;
  toggleHints: () => void;
  setHoveredPart: (part: MachinePartId | null) => void;
  setMachineScale: (scale: number) => void;
  turnMachine: (direction: 1 | -1) => void;
  focusCamera: (part: MachinePartId) => void;
  setFullPanelOpen: (open: boolean) => void;
  setPanelKeyboard: (on: boolean) => void;
  /** A pointer went down or up on the full panel: it takes the keyboard. */
  touchPanel: (timeStamp: number) => void;
  setXrMovement: (movement: XrMovement) => void;
  /** Read the movement this browser chose last (after hydration). */
  loadXrMovement: () => void;
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
  fullPanelOpen: false,
  panelKeyboard: false,
  panelPointerAt: -1,
  xrMovement: "teleport",

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
  setFullPanelOpen: (open) => set({ fullPanelOpen: open, panelKeyboard: open }),
  setPanelKeyboard: (on) => set((s) => ({ panelKeyboard: on && s.fullPanelOpen })),
  touchPanel: (timeStamp) => set({ panelPointerAt: timeStamp, panelKeyboard: true }),
  setXrMovement: (movement) => {
    set({ xrMovement: movement });
    try {
      localStorage.setItem(XR_MOVEMENT_KEY, movement);
    } catch {}
  },
  loadXrMovement: () => {
    try {
      const stored = localStorage.getItem(XR_MOVEMENT_KEY);
      const known = XR_MOVEMENTS.find((m) => m.value === stored);
      if (known) set({ xrMovement: known.value });
    } catch {}
  },
  focusCamera: (part) =>
    set((s) => ({ cameraFocus: { node: `Anchor_${part}`, seq: (s.cameraFocus?.seq ?? 0) + 1 } })),
}));
