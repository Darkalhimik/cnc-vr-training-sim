"use client";

import { create } from "zustand";
import type { MachinePartId } from "./machine-parts";
import type { MachineState } from "./machine-types";

export const initialMachineState: MachineState = {
  airValveOpen: false,
  powerOn: false,
  emergencyExtended: false,
  emergencyClockwise: false,
  emergencyReleased: false,
  doorOpen: false,
  doorOpenedOnce: false,
  doorCycleComplete: false,
  handleJogPressed: false,
  diagnosticsOpen: false,
  coolantOn: false,
};

export type InteractionResult = {
  nextState: MachineState;
  message: string;
};

export function applyInteraction(
  partId: MachinePartId,
  state: MachineState,
): InteractionResult {
  switch (partId) {
    case "air_valve":
      if (state.airValveOpen) {
        return { nextState: state, message: "Air supply is already open." };
      }
      return {
        nextState: { ...state, airValveOpen: true },
        message: "Air supply opened. Valve position: OPEN.",
      };

    case "power_button":
      if (!state.airValveOpen) {
        return { nextState: state, message: "Open the air valve first." };
      }
      if (state.powerOn) {
        return { nextState: state, message: "Machine is already powered on." };
      }
      return {
        nextState: { ...state, powerOn: true },
        message: "Control system powered on.",
      };

    case "power_off":
      if (!state.powerOn) {
        return { nextState: state, message: "Control is already powered down." };
      }
      return {
        nextState: {
          ...state,
          powerOn: false,
          emergencyExtended: false,
          emergencyClockwise: false,
          emergencyReleased: false,
          handleJogPressed: false,
          diagnosticsOpen: false,
          coolantOn: false,
        },
        message: "Control powered down.",
      };

    case "emergency_button":
      if (!state.powerOn) {
        return { nextState: state, message: "Power on the machine first." };
      }
      if (!state.emergencyExtended) {
        return {
          nextState: { ...state, emergencyExtended: true },
          message: "E-Stop extended. Now rotate clockwise to release.",
        };
      }
      if (!state.emergencyClockwise) {
        return {
          nextState: {
            ...state,
            emergencyClockwise: true,
            emergencyReleased: true,
          },
          message: "E-Stop rotated clockwise and released.",
        };
      }
      return { nextState: state, message: "E-Stop is already released." };

    case "door":
      if (state.doorOpen && !state.doorOpenedOnce) {
        return {
          nextState: { ...state, doorOpen: false, doorCycleComplete: true },
          message: "Door closed. Safety interlock verified.",
        };
      }
      if (!state.doorOpenedOnce && !state.doorOpen) {
        return {
          nextState: { ...state, doorOpen: true, doorOpenedOnce: true },
          message: "Door opened. Close it to complete the safety check.",
        };
      }
      if (state.doorOpen) {
        return {
          nextState: {
            ...state,
            doorOpen: false,
            doorCycleComplete: state.doorOpenedOnce,
          },
          message: "Door closed.",
        };
      }
      if (!state.doorOpen && state.doorCycleComplete) {
        return {
          nextState: { ...state, doorOpen: true },
          message: "Door opened.",
        };
      }
      return { nextState: state, message: "Door check already complete." };

    case "handle_jog":
      if (!state.emergencyReleased) {
        return { nextState: state, message: "Release the E-Stop first." };
      }
      if (state.handleJogPressed) {
        return { nextState: state, message: "Handle Jog is already active." };
      }
      return {
        nextState: { ...state, handleJogPressed: true },
        message: "Handle Jog activated.",
      };

    case "diagnostics_panel":
      if (!state.handleJogPressed) {
        return { nextState: state, message: "Activate Handle Jog first." };
      }
      if (state.diagnosticsOpen) {
        return { nextState: state, message: "Diagnostics panel is already open." };
      }
      return {
        nextState: { ...state, diagnosticsOpen: true },
        message: "Diagnostics panel opened. All systems OK.",
      };

    case "coolant_toggle":
      if (!state.powerOn) {
        return { nextState: state, message: "Power on and release the E-Stop before coolant." };
      }
      if (!state.emergencyReleased) {
        return { nextState: state, message: "Release the E-Stop before coolant." };
      }
      return {
        nextState: { ...state, coolantOn: !state.coolantOn },
        message: state.coolantOn ? "Coolant off." : "Coolant on.",
      };

    case "cycle_start":
      if (!state.powerOn || !state.emergencyReleased) {
        return { nextState: state, message: "Machine is not ready for cycle start." };
      }
      return {
        nextState: state,
        message: "Cycle start armed. Demo interaction only.",
      };

    case "feed_hold":
      if (!state.powerOn) {
        return { nextState: state, message: "Power on the machine first." };
      }
      return {
        nextState: state,
        message: "Feed hold pressed. Motion paused.",
      };

    case "mode_selector":
      return {
        nextState: state,
        message: "Mode selector changed. Demo interaction only.",
      };

    default:
      return { nextState: state, message: "No action for this part." };
  }
}

type MachineStore = {
  machine: MachineState;
  lastMessage: string;
  lastPart: MachinePartId | null;
  interactWithPart: (partId: MachinePartId) => void;
  reset: () => void;
};

export const useMachineStore = create<MachineStore>((set, get) => ({
  machine: initialMachineState,
  lastMessage: "",
  lastPart: null,

  interactWithPart: (partId) => {
    const { machine } = get();
    const { nextState, message } = applyInteraction(partId, machine);
    set({ machine: nextState, lastMessage: message, lastPart: partId });
  },

  reset: () => {
    set({
      machine: initialMachineState,
      lastMessage: "",
      lastPart: null,
    });
  },
}));
