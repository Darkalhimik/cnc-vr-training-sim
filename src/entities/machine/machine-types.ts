import type { ActiveCodes } from "@/entities/nc/types";
import type { StockMaterial } from "@/entities/part/tool-library";
import { TOOL_LIBRARY } from "@/entities/part/tool-library";
import { loadedPockets } from "./tool-changer";

/**
 * How the trainee is looking: a desktop browser, a VR headset (the whole
 * workshop, walked), AR glasses (a passthrough headset: the machine in their
 * own room, with hands) or a phone (the machine placed in camera view).
 */
export type DeviceMode = "desktop" | "vr" | "glasses" | "phone";
export const DEVICE_MODES: readonly DeviceMode[] = ["desktop", "vr", "glasses", "phone"];
export const DEVICE_LABEL: Record<DeviceMode, string> = {
  desktop: "Desktop",
  vr: "VR headset",
  glasses: "AR glasses",
  phone: "Phone AR",
};
/** Headsets and phones: the DOM is not visible, the scene carries everything. */
export const isImmersive = (d: DeviceMode) => d !== "desktop";
/** Passthrough: the trainee's own room is the backdrop, so no virtual one. */
export const isPassthrough = (d: DeviceMode) => d === "glasses" || d === "phone";
export type GameMode = "freeplay" | "tutorial" | "task";

/** Machine axes: three linear (mm) on the head, tilt and rotary (deg) on the
 *  trunnion. Haas calls the UMC-500's trunnion axes B and C. */
export type Axis = "x" | "y" | "z" | "b" | "c";
export const AXES: readonly Axis[] = ["x", "y", "z", "b", "c"];
export type AxisValues = Record<Axis, number>;

/** Control power: the NGC takes a few seconds to boot after POWER ON. */
export type ControlPower = "off" | "booting" | "on";

/**
 * The NGC's six mode keys (docs/haas-ngc/operation.md §1). The screen shows
 * them as MODE:KEY — SETUP:JOG, OPERATION:MEM and so on.
 */
export type ControlMode = "edit" | "memory" | "mdi" | "jog" | "zero" | "list";

export const MODE_STATUS: Record<ControlMode, string> = {
  edit: "EDIT:EDIT",
  memory: "OPERATION:MEM",
  mdi: "EDIT:MDI",
  jog: "SETUP:JOG",
  zero: "SETUP:ZERO",
  list: "LIST PROGRAM",
};

/** Display keys pick the main pane. */
export type DisplayPage =
  | "program"
  | "position"
  | "offset"
  | "commands"
  | "alarms"
  | "setting"
  | "diagnostic"
  | "help"
  /** LIST PROGRAM's device manager. */
  | "list";
export type PositionTab = "operator" | "work" | "machine" | "togo" | "all";
export type OffsetTab = "tool" | "work";

/**
 * An active alarm. Haas numbers where the control has a well-known one; the
 * simulator's own (a crash, the interpreter's program errors) carry their
 * text with them.
 */
export type Alarm = { code: string; text: string };

export const ALARM = {
  servosOff: { code: "102", text: "102 SERVOS OFF" },
  emergencyOff: { code: "107", text: "107 EMERGENCY OFF" },
  lowAir: { code: "low-air", text: "LOW AIR PRESSURE" },
} satisfies Record<string, Alarm>;

/** idle → running; hold = FEED HOLD or door hold; stopped = waiting at an
 *  M00/M01 or between single blocks, resumed with CYCLE START. */
export type ProgramState = "idle" | "running" | "hold" | "stopped";

export type SpindleState = { rpm: number; dir: "cw" | "ccw" | "stop" };

/** A row of the OFFSET → TOOL table. Lengths gauge line to tip, diameters. */
export type ToolOffset = { length: number; lengthWear: number; diameter: number; diameterWear: number };

export const WORK_OFFSET_IDS = ["G54", "G55", "G56", "G57", "G58", "G59"] as const;

export type MachineState = {
  // Physical controls — they keep their position whatever the control does.
  airValveOpen: boolean;
  mainSwitchOn: boolean;
  estopPressed: boolean;
  doorOpen: boolean;

  // The control.
  control: ControlPower;
  /** Active alarms, oldest first. While any is active the servos are off. */
  alarms: Alarm[];
  mode: ControlMode;
  display: DisplayPage;
  positionTab: PositionTab;
  offsetTab: OffsetTab;
  /** Highlighted cell of the offset table: tool number or work offset row,
   *  and column. */
  offsetCursor: { row: number; col: number };
  /** The input bar: what has been typed on the keyboard. */
  input: string;
  /** Axis the handle drives in HANDLE JOG. */
  jogAxis: Axis | null;
  /** Millimetres per handle detent: 0.001, 0.01, 0.1 or 1. */
  handleIncrement: number;
  /** Machine position. Home is 0 on every axis; linear travel is negative. */
  position: AxisValues;
  /** Where OPERATOR position was last zeroed with ORIGIN. */
  operatorOrigin: AxisValues;
  /** Positions are only trusted after a zero return. */
  homed: boolean;
  /** Index into HOMING_SEQUENCE while a zero return is running. */
  homingStage: number | null;
  /** Axes a running zero return covers (ALL or SINGLE). */
  homingAxes: Axis[];
  coolantOn: boolean;
  spindle: SpindleState;
  overrides: { feed: number; spindle: number; rapid: number };
  singleBlock: boolean;
  optionStop: boolean;
  blockDelete: boolean;

  // Programs.
  /** Control memory: O-number → text. */
  programs: Record<string, string>;
  activeProgram: string;
  /** The MDI program, kept until ERASE PROGRAM. */
  mdi: string;
  program: ProgramState;
  /** What CYCLE START ran: the active program or the MDI program; "atc" is a
   *  tool change from the keypad (ATC FWD/REV, NEXT TOOL). */
  runSource: "memory" | "mdi" | "atc" | null;
  /** Line of the block executing, in the program being run. */
  programLine: number;
  warmupDone: boolean;
  /** The last program run to its M30 ("MDI" for the MDI program). */
  lastProgramDone: string | null;
  /** CURRENT COMMANDS: the codes of the block executing, or of the last block
   *  run. RESET restores the defaults. */
  activeCodes: ActiveCodes;
  /** Retained macro variables #500–#999: programs write them, the control keeps them. */
  macroVariables: Record<number, number>;

  // Offsets and tools.
  workOffsets: Record<string, AxisValues>;
  /** Last work offset a program used — the WORK position tab's reference. */
  activeWorkOffset: string;
  tools: Record<number, ToolOffset>;
  /** Tool number in the spindle; 0 when empty. */
  toolInSpindle: number;
  /** The side-mount changer's pocket table, pocket 1 first; 0 is empty. Tools
   *  come back to the pocket the new tool left, so it drifts from T = pocket. */
  pockets: number[];
  /** The carousel pocket at the arm. */
  carouselPocket: number;
  /** The tool a keypad tool change ("atc" run) is fetching. */
  atcTool: number;
  /** Raw stock clamped in the vise, millimetres X × Y × Z. */
  stock: StockOnMachine | null;
};

export type StockOnMachine = { size: [number, number, number]; material: StockMaterial };

/** Spindle warm-up, shortened from Haas's 20 minutes to a few seconds. */
export const WARMUP_PROGRAM = `%
O09999 (SPINDLE WARM-UP)
(SHORTENED FOR TRAINING)
G00 G17 G21 G40 G49 G80 G90
G53 G00 Z0.
S1000 M03
G04 P2.5
S4000 M03
G04 P2.5
S8100 M03
G04 P3.
M05
M30
%`;

const zero: AxisValues = { x: 0, y: 0, z: 0, b: 0, c: 0 };

/** The codes in force at power-on and after RESET, metric (Setting 9). */
export function defaultCodes(tool: number): ActiveCodes {
  return {
    motion: "G00",
    cycle: "G80",
    plane: "G17",
    distance: "G90",
    feedMode: "G94",
    units: "G21",
    cutterComp: "G40",
    toolLength: "G49",
    returnLevel: "G98",
    scaling: "G50",
    workOffset: "G54",
    pathMode: "G64",
    rotation: "G69",
    dynamicWorkOffset: "G255",
    feed: 0,
    spindleSpeed: 0,
    spindle: "stop",
    coolant: false,
    tool,
    nextTool: tool,
    h: 0,
    d: 0,
  };
}

/** Where the axes stopped last shift. Not home, so the zero return is visible. */
export const PARKED_POSITION: AxisValues = { x: -212, y: -148, z: -305, b: -15, c: 72 };

/** Diameters entered from the carousel; lengths not measured yet. */
const unmeasuredTools: Record<number, ToolOffset> = Object.fromEntries(
  TOOL_LIBRARY.map((t) => [t.number, { length: 0, lengthWear: 0, diameter: t.diameter, diameterWear: 0 }]),
);

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
  display: "position",
  positionTab: "machine",
  offsetTab: "work",
  offsetCursor: { row: 0, col: 0 },
  input: "",
  jogAxis: null,
  handleIncrement: 1,
  position: PARKED_POSITION,
  operatorOrigin: zero,
  homed: false,
  homingStage: null,
  homingAxes: [],
  coolantOn: false,
  spindle: { rpm: 0, dir: "stop" },
  overrides: { feed: 100, spindle: 100, rapid: 100 },
  singleBlock: false,
  optionStop: false,
  blockDelete: false,
  programs: { O09999: WARMUP_PROGRAM },
  activeProgram: "O09999",
  mdi: "",
  program: "idle",
  runSource: null,
  programLine: 0,
  warmupDone: false,
  lastProgramDone: null,
  activeCodes: defaultCodes(2),
  macroVariables: {},
  workOffsets: Object.fromEntries(WORK_OFFSET_IDS.map((id) => [id, zero])),
  activeWorkOffset: "G54",
  tools: unmeasuredTools,
  toolInSpindle: 2,
  pockets: loadedPockets(TOOL_LIBRARY.map((t) => t.number), 2),
  carouselPocket: 2,
  atcTool: 0,
  stock: null,
};

/** Started, cleared and homed, door shut: where a shift is after the startup
 *  tutorial. Part development begins here so a trainee can get straight to
 *  setting up a job. */
export const readyMachineState: MachineState = {
  ...initialMachineState,
  airValveOpen: true,
  mainSwitchOn: true,
  estopPressed: false,
  doorOpen: false,
  control: "on",
  homed: true,
  position: zero,
};

/** Servos are energised only with the control up and nothing alarming. */
export const servosOn = (m: MachineState) => m.control === "on" && m.alarms.length === 0;

export const hasAlarm = (m: MachineState, code: string) => m.alarms.some((a) => a.code === code);

/** Supply pressure at the regulator, in bar. */
export const airPressure = (m: MachineState) => (m.airValveOpen ? 6.2 : 0);

/** Actual spindle speed: commanded speed times the override. */
export const spindleRpm = (m: MachineState) =>
  m.spindle.dir === "stop" ? 0 : Math.min(8100, Math.round((m.spindle.rpm * m.overrides.spindle) / 100));

/** Position relative to a work offset, as the WORK tab shows it. */
export function workPosition(m: MachineState, offset = m.activeWorkOffset): AxisValues {
  const o = m.workOffsets[offset] ?? zero;
  const h = m.tools[m.toolInSpindle];
  const length = h ? h.length + h.lengthWear : 0;
  return {
    x: m.position.x - o.x,
    y: m.position.y - o.y,
    z: m.position.z - o.z - length,
    b: m.position.b - o.b,
    c: m.position.c - o.c,
  };
}
