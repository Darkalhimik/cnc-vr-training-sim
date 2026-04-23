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
          eventMessage: "Подача повітря вже відкрита. Клапан у правильному положенні OPEN.",
        };
      }
      return {
        nextState: { ...state, airValveOpen: true },
        eventMessage: "Подачу повітря увімкнено. Положення клапана: OPEN.",
      };

    case "power_button":
      if (!state.airValveOpen) {
        return {
          nextState: state,
          eventMessage: "Спочатку відкрийте повітряний клапан.",
        };
      }
      return {
        nextState: { ...state, powerOn: true },
        eventMessage: "Система керування увімкнена.",
      };

    case "emergency_button":
      if (!state.powerOn) {
        return {
          nextState: state,
          eventMessage: "Перед перевіркою E-stop увімкніть машину.",
        };
      }

      if (!state.emergencyExtended) {
        return {
          nextState: { ...state, emergencyExtended: true },
          eventMessage: "E-stop висунуто. Тепер поверніть кнопку за годинниковою стрілкою.",
        };
      }

      if (!state.emergencyClockwise) {
        return {
          nextState: {
            ...state,
            emergencyClockwise: true,
            emergencyReleased: true,
          },
          eventMessage: "E-stop повернуто за годинниковою стрілкою та розблоковано.",
        };
      }

      return {
        nextState: state,
        eventMessage: "E-stop вже в активному (розблокованому) стані.",
      };

    case "door":
      if (state.doorOpen && !state.doorOpenedOnce) {
        return {
          nextState: {
            ...state,
            doorOpen: false,
            doorCycleComplete: true,
          },
          eventMessage: "Двері були відкриті. Закрито та підтверджено безпечний стан.",
        };
      }

      if (!state.doorOpenedOnce && !state.doorOpen) {
        return {
          nextState: { ...state, doorOpen: true, doorOpenedOnce: true },
          eventMessage: "Двері відкрито. Закрийте їх для завершення перевірки.",
        };
      }

      if (state.doorOpen) {
        return {
          nextState: { ...state, doorOpen: false, doorCycleComplete: state.doorOpenedOnce },
          eventMessage: "Двері закрито.",
        };
      }

      return {
        nextState: state,
        eventMessage: "Перевірку дверей уже завершено.",
      };

    case "handle_jog":
      if (!state.emergencyReleased) {
        return {
          nextState: state,
          eventMessage: "Спочатку переведіть E-stop у розблокований стан.",
        };
      }
      return {
        nextState: { ...state, handleJogPressed: true },
        eventMessage: "Handle Jog активовано. Відкрийте Diagnostics.",
      };

    case "diagnostics_panel":
      if (!state.handleJogPressed) {
        return {
          nextState: state,
          eventMessage: "Спочатку натисніть Handle Jog.",
        };
      }
      return {
        nextState: { ...state, diagnosticsOpen: true },
        eventMessage: "Diagnostics відкрито.",
      };

    default:
      return {
        nextState: state,
        eventMessage: "Для цього елемента немає дії в поточному кроці.",
      };
  }
}
