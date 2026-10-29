/**
 * Where the stock ends up on the machine once clamped: the reference values a
 * probe would find, used to check the trainee's own setup and by "probe it for
 * me" shortcuts.
 */
import { C_CENTER, VISE_TOP, linearForNose, type MachinePosition } from "@/entities/machine/kinematics";
import type { Stock } from "./part-design";

/**
 * G54 for a part zero at the top-face centre of the stock: machine X/Y/Z of
 * the gauge line of a zero-length tool touching that point at B = C = 0.
 */
export function idealWorkOffset(stock: Stock): MachinePosition {
  const { x, y, z } = linearForNose([C_CENTER[0], C_CENTER[1], C_CENTER[2] + VISE_TOP + stock.z]);
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return { x: round(x), y: round(y), z: round(z), b: 0, c: 0 };
}
