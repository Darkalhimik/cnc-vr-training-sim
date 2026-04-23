import { stepAirFlow } from "./step-air-flow";
import { stepPowerOn } from "./step-power-on";
import { stepEmergencyStop } from "./step-emergency-stop";
import { stepDoorCheck } from "./step-door-check";
import { stepHandleJog } from "./step-handle-jog";

export const cncTutorialSteps = [
  stepAirFlow,
  stepPowerOn,
  stepEmergencyStop,
  stepDoorCheck,
  stepHandleJog,
];
