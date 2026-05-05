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

// Positions are in three.js sceneGroup-local coords, derived from the GLB
// Blender world positions through the export + machine-shell transform pipeline
// (Y-up convert → fit scale 0.65 → ground+center → +0.46 outer lift).
export const MACHINE_PART_POSITIONS: Record<MachinePartId, [number, number, number]> = {
  body: [0, 1.413, 0],
  door: [0.316, 1.373, 0.538],
  panel: [0.743, 1.399, 0.816],
  air_valve: [-0.10, 0.75, -0.725],
  power_button: [0.873, 1.480, 0.700],
  power_off: [0.873, 1.469, 0.731],
  emergency_button: [0.614, 1.487, 0.703],
  handle_jog: [0.627, 1.394, 0.938],
  diagnostics_panel: [0.743, 1.471, 0.718],
  cycle_start: [0.834, 1.404, 0.914],
  feed_hold: [0.769, 1.404, 0.914],
  mode_selector: [0.873, 1.388, 0.963],
  coolant_toggle: [1.35, 0.55, -0.6],
};
