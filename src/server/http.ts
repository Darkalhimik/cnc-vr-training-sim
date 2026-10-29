import "server-only";
import { NextResponse } from "next/server";

/** JSON error with the status a client can act on. */
export const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

export const unauthorized = () => fail(401, "Sign in, or continue as a guest, first.");

/** Finite number in [min, max], or null. */
export function num(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;
}
