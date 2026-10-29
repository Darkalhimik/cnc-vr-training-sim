import { spindleRpm } from "./machine-logic";
import type { MachineState } from "./machine-types";

export type Indicator = {
  label: string;
  /** The state word — both the value shown and the tone lookup key, so every
   *  word here needs an entry in shared/ui/tone.ts and vr-scene/panel-theme.ts. */
  state: string;
};

/**
 * The machine at a glance. One list for the DOM side panel and the in-scene VR
 * board, so the two can be read interchangeably.
 */
export function machineIndicators(m: MachineState): Indicator[] {
  const rpm = spindleRpm(m);
  return [
    { label: "Air", state: m.airValveOpen ? "on" : "off" },
    { label: "Mains", state: m.mainSwitchOn ? "on" : "off" },
    { label: "Control", state: m.control === "booting" ? "boot" : m.control },
    { label: "E-stop", state: m.estopPressed ? "lock" : "free" },
    { label: "Alarms", state: m.alarms.length > 0 ? "alarm" : "clear" },
    { label: "Door", state: m.doorOpen ? "open" : "shut" },
    { label: "Home", state: m.homingStage !== null ? "homing" : m.homed ? "homed" : "lost" },
    { label: "Mode", state: m.mode === "jog" ? "jog" : "mem" },
    { label: "Spindle", state: m.program === "hold" ? "hold" : rpm > 0 ? "run" : "stop" },
    { label: "Coolant", state: m.coolantOn ? "on" : "off" },
  ];
}
