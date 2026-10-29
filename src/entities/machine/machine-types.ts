export type DeviceMode = "desktop" | "vr" | "ar";
export type GameMode = "tutorial" | "freeplay";

/** Machine axes: three linear (mm) on the head, tilt and rotary (deg) on the
 *  trunnion. Haas calls the UMC-500's trunnion axes B and C. */
export type Axis = "x" | "y" | "z" | "b" | "c";
export const AXES: readonly Axis[] = ["x", "y", "z", "b", "c"];

/** Control power: the NGC takes a few seconds to boot after POWER ON. */
export type ControlPower = "off" | "booting" | "on";

export type ControlMode = "memory" | "jog";

/** Haas alarm numbers where the control has a well-known one; LOW AIR is
 *  shown by name. */
export type AlarmCode = "102" | "107" | "low-air";

export const ALARM_TEXT: Record<AlarmCode, string> = {
  "102": "102 SERVOS OFF",
  "107": "107 EMERGENCY OFF",
  "low-air": "LOW AIR PRESSURE",
};

export type ProgramState = "idle" | "running" | "hold";

export type MachineState = {
  // Physical controls — they keep their position whatever the control does.
  airValveOpen: boolean;
  mainSwitchOn: boolean;
  estopPressed: boolean;
  doorOpen: boolean;

  // The control.
  control: ControlPower;
  /** Active alarms, oldest first. While any is active the servos are off. */
  alarms: AlarmCode[];
  mode: ControlMode;
  /** Axis the handwheel drives in HANDLE JOG. */
  jogAxis: Axis | null;
  /** Machine position. Home is 0 on every axis; linear travel is negative. */
  position: Record<Axis, number>;
  /** Positions are only trusted after a zero return. */
  homed: boolean;
  /** Index into HOMING_SEQUENCE while POWER UP is running. */
  homingStage: number | null;
  coolantOn: boolean;
  program: ProgramState;
  /** Index into WARMUP_PROGRAM while the program is running or held. */
  programBlock: number;
  warmupDone: boolean;
};

/** Where the axes stopped last shift. Not home, so the zero return is visible. */
export const PARKED_POSITION: Record<Axis, number> = {
  x: -212,
  y: -148,
  z: -305,
  b: -15,
  c: 72,
};

export const initialMachineState: MachineState = {
  airValveOpen: false,
  mainSwitchOn: false,
  // Operators hit the E-stop when they walk away, and leave the door open
  // after cleaning out the chips — so that is how the shift finds it.
  estopPressed: true,
  doorOpen: true,
  control: "off",
  alarms: [],
  mode: "memory",
  jogAxis: null,
  position: PARKED_POSITION,
  homed: false,
  homingStage: null,
  coolantOn: false,
  program: "idle",
  programBlock: 0,
  warmupDone: false,
};

/** Servos are energised only with the control up and nothing alarming. */
export const servosOn = (m: MachineState) => m.control === "on" && m.alarms.length === 0;

/** Supply pressure at the regulator, in bar. */
export const airPressure = (m: MachineState) => (m.airValveOpen ? 6.2 : 0);
