import { stepAirSupply } from "./step-air-supply";
import { stepMainPower } from "./step-main-power";
import { stepPowerOn } from "./step-power-on";
import { stepEmergencyStop } from "./step-emergency-stop";
import { stepClearAlarms } from "./step-clear-alarms";
import { stepDoor } from "./step-door";
import { stepZeroReturn } from "./step-zero-return";
import { stepHandleJog } from "./step-handle-jog";
import { stepWarmup } from "./step-warmup";

/** Haas NGC startup, in the order an operator does it at the start of a shift. */
export const cncTutorialSteps = [
  stepAirSupply,
  stepMainPower,
  stepPowerOn,
  stepEmergencyStop,
  stepClearAlarms,
  stepDoor,
  stepZeroReturn,
  stepHandleJog,
  stepWarmup,
];
