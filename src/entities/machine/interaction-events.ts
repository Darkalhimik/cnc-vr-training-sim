import type { MachinePartId } from "./machine-parts";

export type InteractionEvent =
  | { kind: "valve-opened" }
  | { kind: "valve-closed" }
  | { kind: "power-on" }
  | { kind: "power-off" }
  | { kind: "estop-extended" }
  | { kind: "estop-released" }
  | { kind: "estop-engaged" }
  | { kind: "door-opened" }
  | { kind: "door-closed" }
  | { kind: "jog-on" }
  | { kind: "jog-off" }
  | { kind: "diagnostics-opened" }
  | { kind: "diagnostics-closed" }
  | { kind: "coolant-on" }
  | { kind: "coolant-off" }
  | { kind: "cycle-start" }
  | { kind: "feed-hold" }
  | { kind: "mode-changed" }
  | { kind: "rejected"; partId: MachinePartId; reason: string }
  | { kind: "noop"; partId: MachinePartId };
