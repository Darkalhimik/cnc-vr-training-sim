export type DeviceMode = "desktop" | "vr" | "ar";
export type GameMode = "tutorial" | "freeplay";

export type MachineState = {
  airValveOpen: boolean;
  powerOn: boolean;
  emergencyExtended: boolean;
  emergencyClockwise: boolean;
  emergencyReleased: boolean;
  doorOpen: boolean;
  doorOpenedOnce: boolean;
  doorCycleComplete: boolean;
  handleJogPressed: boolean;
  diagnosticsOpen: boolean;
  coolantOn: boolean;
};
