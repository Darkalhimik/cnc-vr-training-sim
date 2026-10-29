/**
 * Haas NGC mill G-code interpreter for the UMC-500 digital twin.
 *
 * `interpret(text, setup)` runs a whole program up front and returns the
 * machine motions it produces, the alarms a real control would raise, the
 * cycle time, the active codes block by block and the final modal state.
 * `parseProgram(text)` is the parse step alone, for the editor.
 */
export { codesAt, interpret } from "./interpreter";
export { parseProgram } from "./parser";
export {
  CAN_CYCLE_DELTA_Z,
  CHORD_TOLERANCE,
  MAX_FEED,
  MAX_SPINDLE_RPM,
  RAPID_RATE,
  TOOL_CHANGE_SECONDS,
} from "./machine-data";
export type * from "./types";
