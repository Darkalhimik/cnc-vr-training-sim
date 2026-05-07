export type DeviceMode = "desktop" | "vr" | "ar";
export type GameMode = "tutorial" | "freeplay";

export type EstopPosition = "engaged" | "extended" | "released";

export type MachineState = {
  airValveOpen: boolean;
  powerOn: boolean;
  estop: EstopPosition;
  doorOpen: boolean;
  handleJogActive: boolean;
  diagnosticsOpen: boolean;
  coolantOn: boolean;
};

export const initialMachineState: MachineState = {
  airValveOpen: false,
  powerOn: false,
  estop: "engaged",
  doorOpen: false,
  handleJogActive: false,
  diagnosticsOpen: false,
  coolantOn: false,
};

export const isEstopReleased = (m: MachineState) => m.estop === "released";
