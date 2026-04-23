export const MACHINE_PART_IDS = [
  "body",
  "door",
  "panel",
  "air_valve",
  "power_button",
  "power_off",
  "emergency_button",
  "handle_jog",
  "diagnostics_panel",
  "cycle_start",
  "feed_hold",
  "mode_selector",
  "coolant_toggle",
] as const;

export type MachinePartId = (typeof MACHINE_PART_IDS)[number];

export const MACHINE_PART_LABELS: Record<MachinePartId, string> = {
  body: "Machine Body",
  door: "Safety Door",
  panel: "Control Console",
  air_valve: "Air Valve",
  power_button: "Power On",
  power_off: "Power Off",
  emergency_button: "Emergency Stop",
  handle_jog: "Handle Jog",
  diagnostics_panel: "Diagnostics Screen",
  cycle_start: "Cycle Start",
  feed_hold: "Feed Hold",
  mode_selector: "Mode Selector",
  coolant_toggle: "Coolant Valve",
};

export const MACHINE_PART_DESCRIPTIONS: Record<MachinePartId, string> = {
  body: "Main enclosure of the HAAS UMC-500 machining center.",
  door: "Front sliding door that covers the machining envelope.",
  panel: "Scaled-up operator console positioned near the machine front-right side.",
  air_valve: "Rear air supply wheel used before powering the control.",
  power_button: "Main control power button.",
  power_off: "Turns the control off after a safe stop.",
  emergency_button: "Mushroom E-stop with pull-and-twist release behavior.",
  handle_jog: "Jog handwheel for manual movement and menu control.",
  diagnostics_panel: "Status display used in the startup tutorial.",
  cycle_start: "Starts the active cycle when the control is ready.",
  feed_hold: "Pauses feed motion.",
  mode_selector: "Selector used to change machine operating mode.",
  coolant_toggle: "Separate coolant handwheel used for the water effect.",
};

export const MACHINE_PART_POSITIONS: Record<MachinePartId, [number, number, number]> = {
  body: [0, 1.16, 0],
  door: [-0.06, 1.1, 1.06],
  panel: [2.42, 1.26, 1.26],
  air_valve: [-1.46, 0.76, -1.12],
  power_button: [2.59, 1.44, 1.44],
  power_off: [2.27, 1.44, 1.44],
  emergency_button: [2.72, 1.44, 1.49],
  handle_jog: [2.2, 0.77, 1.44],
  diagnostics_panel: [2.42, 1.77, 1.38],
  cycle_start: [2.66, 0.73, 1.46],
  feed_hold: [2.43, 0.73, 1.46],
  mode_selector: [2.67, 0.43, 1.45],
  coolant_toggle: [1.82, 0.72, -1.18],
};
