/**
 * Macro B expression evaluation (Fanuc semantics, which Haas follows).
 *
 * A variable can be vacant ("#0", null here). A vacant variable on its own
 * stays vacant — so `#2 = #1` copies the vacancy and `X#1` drops the X word —
 * but inside arithmetic it counts as 0. Only EQ and NE tell vacant from 0.
 */
import type { Expr, MacroFunction } from "./types";

export type Value = number | null;

export class MacroError extends Error {}

const RAD = Math.PI / 180;
const EPS = 1e-9;

const num = (v: Value) => v ?? 0;

/** Variable numbers are whole; #[1.0000001] is still #1. */
export function variableIndex(v: Value): number {
  const n = num(v);
  const r = Math.round(n);
  if (Math.abs(n - r) > 1e-6 || r < 0) throw new MacroError(`invalid variable number #${n}`);
  return r;
}

function equal(a: Value, b: Value): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b));
}

/** AND/OR/XOR are logical on 0/1 results and bitwise on other numbers. */
function logic(op: "AND" | "OR" | "XOR", a: number, b: number): number {
  const bool = (a === 0 || a === 1) && (b === 0 || b === 1);
  const x = Math.trunc(a);
  const y = Math.trunc(b);
  if (op === "AND") return bool ? Number(a === 1 && b === 1) : x & y;
  if (op === "OR") return bool ? Number(a === 1 || b === 1) : x | y;
  return bool ? Number(a !== b) : x ^ y;
}

function toBcd(n: number): number {
  let out = 0;
  let shift = 0;
  for (let v = Math.trunc(Math.abs(n)); v > 0; v = Math.floor(v / 10), shift += 4) out += (v % 10) * 2 ** shift;
  return out;
}

function fromBcd(n: number): number {
  let out = 0;
  let scale = 1;
  for (let v = Math.trunc(Math.abs(n)); v > 0; v = Math.floor(v / 16), scale *= 10) out += (v % 16) * scale;
  return out;
}

function call(name: MacroFunction, a: number, b: number | undefined): number {
  switch (name) {
    case "SIN":
      return Math.sin(a * RAD);
    case "COS":
      return Math.cos(a * RAD);
    case "TAN":
      return Math.tan(a * RAD);
    case "ASIN":
    case "ACOS":
      if (a < -1 - EPS || a > 1 + EPS) throw new MacroError(`${name}[${a}] is out of range`);
      return (name === "ASIN" ? Math.asin : Math.acos)(Math.max(-1, Math.min(1, a))) / RAD;
    case "ATAN": {
      // Two-argument form answers 0..360, as Fanuc does by default.
      if (b === undefined) return Math.atan(a) / RAD;
      const deg = Math.atan2(a, b) / RAD;
      return deg < 0 ? deg + 360 : deg;
    }
    case "SQRT":
      if (a < 0) throw new MacroError(`SQRT of a negative number (${a})`);
      return Math.sqrt(a);
    case "ABS":
      return Math.abs(a);
    case "ROUND":
      return Math.sign(a) * Math.round(Math.abs(a));
    case "FIX":
      return Math.trunc(a);
    case "FUP":
      return Math.sign(a) * Math.ceil(Math.abs(a));
    case "LN":
      if (a <= 0) throw new MacroError(`LN of ${a}`);
      return Math.log(a);
    case "EXP":
      return Math.exp(a);
    case "BIN":
      return fromBcd(a);
    case "BCD":
      return toBcd(a);
  }
}

/** Evaluates `e`, reading variables through `read`. */
export function evaluate(e: Expr, read: (n: number) => Value): Value {
  switch (e.k) {
    case "num":
      return e.v;
    case "var":
      return read(variableIndex(evaluate(e.index, read)));
    case "neg":
      return -num(evaluate(e.a, read));
    case "fn":
      return call(e.name, num(evaluate(e.a, read)), e.b ? num(evaluate(e.b, read)) : undefined);
    case "bin": {
      const a = evaluate(e.a, read);
      const b = evaluate(e.b, read);
      if (e.op === "EQ") return Number(equal(a, b));
      if (e.op === "NE") return Number(!equal(a, b));
      const x = num(a);
      const y = num(b);
      switch (e.op) {
        case "+":
          return x + y;
        case "-":
          return x - y;
        case "*":
          return x * y;
        case "/":
          if (y === 0) throw new MacroError("division by zero");
          return x / y;
        case "MOD":
          if (y === 0) throw new MacroError("MOD by zero");
          return x % y;
        case "GT":
          return Number(x > y + EPS);
        case "GE":
          return Number(x >= y - EPS);
        case "LT":
          return Number(x < y - EPS);
        case "LE":
          return Number(x <= y + EPS);
        case "AND":
        case "OR":
        case "XOR":
          return logic(e.op, x, y);
      }
    }
  }
}

/** True for a condition value: anything but 0 and vacant. */
export const truthy = (v: Value) => v !== null && v !== 0;
