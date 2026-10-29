/**
 * Every part of the machine the trainee can point at.
 *
 * The 3D model binds to these ids itself: each pointable node in
 * public/models/umc500.glb carries a `part` extra with one of them, and each
 * part the tutorial can highlight has an `Anchor_<id>` node to aim an arrow
 * at. Both are written by tools/blender/build_umc500.py — a new control is
 * added there and here, nowhere else.
 */
export const MACHINE_PART_IDS = [
  // Services, at the back and side.
  "air_valve",
  "air_gauge",
  "main_switch",
  // Pendant.
  "power_on",
  "power_off",
  "estop",
  "reset",
  "power_up",
  "memory",
  "hand_jog",
  "axis_x",
  "axis_y",
  "axis_z",
  "axis_b",
  "axis_c",
  "handwheel",
  "coolant",
  "cycle_start",
  "feed_hold",
  "screen",
  "pendant",
  "full_panel",
  // Machine.
  "door",
  "enclosure",
  "spindle",
  "trunnion",
  "vise",
  "tool_changer",
] as const;

export type MachinePartId = (typeof MACHINE_PART_IDS)[number];

/** control: operating it does something. indicator: read, not operated.
 *  info: there to be pointed at and explained in free play. */
export type PartKind = "control" | "indicator" | "info";

export type MachinePart = {
  label: string;
  description: string;
  kind: PartKind;
};

export const MACHINE_PARTS: Record<MachinePartId, MachinePart> = {
  air_valve: {
    label: "Air shut-off valve",
    description:
      "Ball valve on the shop air line at the rear panel. Lever in line with the pipe is open, across it is closed.",
    kind: "control",
  },
  air_gauge: {
    label: "Air pressure gauge",
    description: "Regulator gauge. Should read about 6 bar with the supply open; below that the control alarms.",
    kind: "indicator",
  },
  main_switch: {
    label: "Main disconnect",
    description:
      "Rotary isolator on the electrical cabinet. Turn to I before POWER ON; never cut it with the control running.",
    kind: "control",
  },
  power_on: {
    label: "POWER ON",
    description: "Starts the control. It takes a few seconds to boot, then shows the alarms that need clearing.",
    kind: "control",
  },
  power_off: {
    label: "POWER OFF",
    description: "Shuts the control down. Axes lose their zero return and must be homed again.",
    kind: "control",
  },
  estop: {
    label: "Emergency stop",
    description: "Press to stop everything at once. Twist clockwise to release, then RESET to clear alarm 107.",
    kind: "control",
  },
  reset: {
    label: "RESET",
    description: "Clears alarms whose cause has gone, and stops a running program and the coolant.",
    kind: "control",
  },
  power_up: {
    label: "POWER UP",
    description: "Zero return: sends Z home first, then X and Y, then B and C. Needs the door shut and no alarms.",
    kind: "control",
  },
  memory: {
    label: "MEMORY",
    description: "Program mode. CYCLE START runs the loaded program (here, the spindle warm-up).",
    kind: "control",
  },
  hand_jog: {
    label: "HANDLE JOG",
    description: "Manual mode. Pick an axis, then turn the handwheel to move it.",
    kind: "control",
  },
  axis_x: { label: "X axis", description: "Selects X for the handwheel: the head left and right.", kind: "control" },
  axis_y: { label: "Y axis", description: "Selects Y for the handwheel: the head in and out.", kind: "control" },
  axis_z: { label: "Z axis", description: "Selects Z for the handwheel: the head up and down.", kind: "control" },
  axis_b: { label: "B axis", description: "Selects B for the handwheel: trunnion tilt.", kind: "control" },
  axis_c: { label: "C axis", description: "Selects C for the handwheel: platter rotation.", kind: "control" },
  handwheel: {
    label: "Jog handwheel",
    description: "Moves the selected axis one increment per detent. Right half jogs plus, left half minus.",
    kind: "control",
  },
  coolant: {
    label: "COOLANT",
    description: "Switches the flood coolant at the spindle. Only with the door shut.",
    kind: "control",
  },
  cycle_start: {
    label: "CYCLE START",
    description: "Runs the program in MEMORY mode, or resumes it after FEED HOLD.",
    kind: "control",
  },
  feed_hold: {
    label: "FEED HOLD",
    description: "Pauses a running program. CYCLE START resumes it.",
    kind: "control",
  },
  screen: {
    label: "Control screen",
    description: "Mode, alarms, machine position and spindle speed.",
    kind: "indicator",
  },
  full_panel: {
    label: "Full panel",
    description: "Not a Haas key: opens the complete NGC pendant at full size beside the machine.",
    kind: "control",
  },
  pendant: {
    label: "Operator pendant",
    description: "The Haas NGC control: screen, keypad, handwheel and the machine's start and stop buttons.",
    kind: "info",
  },
  door: {
    label: "Front door",
    description: "Sliding operator door. Interlocked: opening it holds the program and stops the coolant.",
    kind: "control",
  },
  enclosure: {
    label: "Enclosure",
    description: "Sheet-metal guarding around the HAAS UMC-500 five-axis machining centre.",
    kind: "info",
  },
  spindle: {
    label: "Spindle head",
    description: "40-taper spindle on the Z axis, carried by the Y ram and X saddle.",
    kind: "info",
  },
  trunnion: {
    label: "Trunnion table",
    description: "Tilts on B (−35° to +120°) and rotates the platter on C (360°).",
    kind: "info",
  },
  vise: {
    label: "5-axis vise",
    description: "Self-centring vise on a riser. Its height lets the head reach the part's sides with the trunnion tilted.",
    kind: "info",
  },
  tool_changer: {
    label: "Tool changer",
    description: "30-pocket side-mount tool changer.",
    kind: "info",
  },
};

export const isMachinePartId = (value: unknown): value is MachinePartId =>
  typeof value === "string" && (MACHINE_PART_IDS as readonly string[]).includes(value);
