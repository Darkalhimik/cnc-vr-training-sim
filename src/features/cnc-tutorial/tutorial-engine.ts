import type { MachinePartId } from "@/entities/machine/machine-parts";
import type { MachineState, TutorialStep } from "./tutorial-types";
import { cncTutorialSteps } from "./steps";

export type InteractionResult = {
  nextState: MachineState;
  eventMessage: string;
};

export function getStepByIndex(stepIndex: number): TutorialStep {
  return cncTutorialSteps[Math.max(0, Math.min(stepIndex, cncTutorialSteps.length - 1))];
}

export function isTutorialComplete(stepIndex: number): boolean {
  return stepIndex >= cncTutorialSteps.length;
}

export function applyPartInteraction(partId: MachinePartId, state: MachineState): InteractionResult {
  switch (partId) {
    case "air_valve":
      if (state.airValveOpen) {
        return {
          nextState: state,
          eventMessage: "Air supply is already open. Valve is in the correct OPEN position.",
        };
      }
      return {
        nextState: { ...state, airValveOpen: true },
        eventMessage: "Air supply turned on. Valve position: OPEN.",
      };

    case "power_button":
      if (!state.airValveOpen) {
        return {
          nextState: state,
          eventMessage: "Open the air valve first.",
        };
      }
      return {
        nextState: { ...state, powerOn: true },
        eventMessage: "Control system powered on.",
      };

    case "emergency_button":
      if (!state.powerOn) {
        return {
          nextState: state,
          eventMessage: "Power on the machine before checking the E-stop.",
        };
      }

      if (!state.emergencyExtended) {
        return {
          nextState: { ...state, emergencyExtended: true },
          eventMessage: "E-stop pulled out. Now rotate the button clockwise.",
        };
      }

      if (!state.emergencyClockwise) {
        return {
          nextState: {
            ...state,
            emergencyClockwise: true,
            emergencyReleased: true,
          },
          eventMessage: "E-stop rotated clockwise and released.",
        };
      }

      return {
        nextState: state,
        eventMessage: "E-stop is already in the active (released) state.",
      };

    case "door":
      if (state.doorOpen && !state.doorOpenedOnce) {
        return {
          nextState: {
            ...state,
            doorOpen: false,
            doorCycleComplete: true,
          },
          eventMessage: "Door was open. Closed and confirmed safe state.",
        };
      }

      if (!state.doorOpenedOnce && !state.doorOpen) {
        return {
          nextState: { ...state, doorOpen: true, doorOpenedOnce: true },
          eventMessage: "Door opened. Close it to complete the check.",
        };
      }

      if (state.doorOpen) {
        return {
          nextState: { ...state, doorOpen: false, doorCycleComplete: state.doorOpenedOnce },
          eventMessage: "Door closed.",
        };
      }

      return {
        nextState: state,
        eventMessage: "Door check already completed.",
      };

    case "handle_jog":
      if (!state.emergencyReleased) {
        return {
          nextState: state,
          eventMessage: "Release the E-stop first.",
        };
      }
      return {
        nextState: { ...state, handleJogPressed: true },
        eventMessage: "Handle Jog activated. Open Diagnostics.",
      };

    case "diagnostics_panel":
      if (!state.handleJogPressed) {
        return {
          nextState: state,
          eventMessage: "Press Handle Jog first.",
        };
      }
      return {
        nextState: { ...state, diagnosticsOpen: true },
        eventMessage: "Diagnostics opened.",
      };

    default:
      return {
        nextState: state,
        eventMessage: "No action for this element in the current step.",
      };
  }
}
