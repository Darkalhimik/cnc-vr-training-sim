import type { MachineState } from "./machine-types";

export const HAAS_UMC500_NAME = "HAAS UMC-500";

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
