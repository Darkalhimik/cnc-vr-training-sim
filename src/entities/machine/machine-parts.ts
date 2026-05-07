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
  panel: "Vertical, fully-labeled operator console mounted on the right-side swing arm of the machine.",
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
// (Y-up convert → fit scale → ground+center). Model bottom at Y=0.
// v2: panel was rebuilt as a vertical, fully-labeled side console mounted on
// the right of the machine; control-button positions recomputed from Blender.
// v3: panel re-pivoted to a true side-arm pendant (chest-high, swung forward
//     of the right enclosure face); air_valve restored to its original spot.
// v4: panel mounted at the front face (right of the door, just clear of the
//     enclosure) so it reads as a real swing-arm pendant; air_valve marker
//     moved outside the rear face so the highlight is reachable, not buried
//     inside the enclosure.
// v5: air_valve dropped from chest height to ~0.5 m above the floor and
//     pulled past the front face — sits at the bottom-front of the enclosure
//     where it is visible to an operator standing at the door.
// v6: air_valve pulled back to the rear face (90% revert of v5's forward
//     move) while keeping the lower height — now sits behind the rear face
//     at ~0.5 m, like a real air-supply valve mounted on the back-bottom.
// v7: markers reverted to base 1× values. The whole scene group is wrapped
//     in a runtime <group scale={machineScale}> in vr-scene.tsx so every
//     child — GLB meshes, highlight arrows, the air-valve marker — scales
//     uniformly from a single slider. No per-marker math required.
export const MACHINE_PART_POSITIONS: Record<MachinePartId, [number, number, number]> = {
  body: [0.043, 1.092, -0.046],
  door: [-0.026, 1.352, 0.526],
  panel: [0.912, 0.862, 0.805],
  air_valve: [-0.100, 0.344, -0.829],
  power_button: [0.547, 0.976, -0.339],
  power_off: [0.621, 0.976, -0.252],
  emergency_button: [0.551, 0.691, -0.275],
  handle_jog: [0.577, 0.378, -0.297],
  diagnostics_panel: [0.929, 0.934, 0.109],
  cycle_start: [0.547, 0.080, -0.339],
  feed_hold: [0.621, 0.080, -0.252],
  mode_selector: [1.057, 0.634, 0.263],
  coolant_toggle: [1.350, 0.550, -0.600],
};
