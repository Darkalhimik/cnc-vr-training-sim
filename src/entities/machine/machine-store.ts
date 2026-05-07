"use client";

import { create } from "zustand";
import type { MachinePartId } from "./machine-parts";
import {
  initialMachineState,
  isEstopReleased,
  type MachineState,
} from "./machine-types";
import type { InteractionEvent } from "./interaction-events";

export { initialMachineState };

export type InteractionResult = {
  next: MachineState;
  event: InteractionEvent;
};

const reject = (
  state: MachineState,
  partId: MachinePartId,
  reason: string,
): InteractionResult => ({
  next: state,
  event: { kind: "rejected", partId, reason },
});

const noop = (state: MachineState, partId: MachinePartId): InteractionResult => ({
  next: state,
  event: { kind: "noop", partId },
});

export function applyInteraction(
  partId: MachinePartId,
  state: MachineState,
): InteractionResult {
  switch (partId) {
    case "air_valve":
      return state.airValveOpen
        ? { next: { ...state, airValveOpen: false }, event: { kind: "valve-closed" } }
        : { next: { ...state, airValveOpen: true }, event: { kind: "valve-opened" } };

    case "power_button":
      if (!state.airValveOpen) return reject(state, partId, "Open the air valve first.");
      if (state.powerOn) return noop(state, partId);
      return { next: { ...state, powerOn: true }, event: { kind: "power-on" } };

    case "power_off":
      if (!state.powerOn) return noop(state, partId);
      return {
        next: {
          ...state,
          powerOn: false,
          estop: "engaged",
          handleJogActive: false,
          diagnosticsOpen: false,
          coolantOn: false,
        },
        event: { kind: "power-off" },
      };

    case "emergency_button":
      if (!state.powerOn) return reject(state, partId, "Power on the machine first.");
      switch (state.estop) {
        case "engaged":
          return { next: { ...state, estop: "extended" }, event: { kind: "estop-extended" } };
        case "extended":
          return { next: { ...state, estop: "released" }, event: { kind: "estop-released" } };
        case "released":
          // Re-engaging the e-stop drops jog/diagnostics — physical interlock.
          return {
            next: {
              ...state,
              estop: "engaged",
              handleJogActive: false,
              diagnosticsOpen: false,
            },
            event: { kind: "estop-engaged" },
          };
      }
      return noop(state, partId);

    case "door":
      return state.doorOpen
        ? { next: { ...state, doorOpen: false }, event: { kind: "door-closed" } }
        : { next: { ...state, doorOpen: true }, event: { kind: "door-opened" } };

    case "handle_jog":
      if (!isEstopReleased(state)) return reject(state, partId, "Release the E-Stop first.");
      return state.handleJogActive
        ? { next: { ...state, handleJogActive: false }, event: { kind: "jog-off" } }
        : { next: { ...state, handleJogActive: true }, event: { kind: "jog-on" } };

    case "diagnostics_panel":
      if (!state.handleJogActive) return reject(state, partId, "Activate Handle Jog first.");
      return state.diagnosticsOpen
        ? { next: { ...state, diagnosticsOpen: false }, event: { kind: "diagnostics-closed" } }
        : { next: { ...state, diagnosticsOpen: true }, event: { kind: "diagnostics-opened" } };

    case "coolant_toggle":
      if (!state.powerOn) return reject(state, partId, "Power on the machine first.");
      if (!isEstopReleased(state)) return reject(state, partId, "Release the E-Stop first.");
      return state.coolantOn
        ? { next: { ...state, coolantOn: false }, event: { kind: "coolant-off" } }
        : { next: { ...state, coolantOn: true }, event: { kind: "coolant-on" } };

    case "cycle_start":
      if (!state.powerOn || !isEstopReleased(state)) {
        return reject(state, partId, "Machine is not ready for cycle start.");
      }
      return { next: state, event: { kind: "cycle-start" } };

    case "feed_hold":
      if (!state.powerOn) return reject(state, partId, "Power on the machine first.");
      return { next: state, event: { kind: "feed-hold" } };

    case "mode_selector":
      return { next: state, event: { kind: "mode-changed" } };

    case "panel":
    case "body":
      return noop(state, partId);

    default:
      return noop(state, partId);
  }
}

type MachineStore = {
  machine: MachineState;
  lastEvent: InteractionEvent | null;
  interactWithPart: (partId: MachinePartId) => InteractionEvent;
  reset: () => void;
};

export const useMachineStore = create<MachineStore>((set, get) => ({
  machine: initialMachineState,
  lastEvent: null,

  interactWithPart: (partId) => {
    const { next, event } = applyInteraction(partId, get().machine);
    set({ machine: next, lastEvent: event });
    return event;
  },

  reset: () => {
    set({ machine: initialMachineState, lastEvent: null });
  },
}));
