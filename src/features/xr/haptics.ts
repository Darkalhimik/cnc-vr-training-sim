"use client";

import { useEffect } from "react";
import { useXR } from "@react-three/xr";

/**
 * Controller vibration: a tick under the finger for every key and button, a
 * click per handwheel detent, a buzz while the cutter is in material, and a
 * jolt on a crash.
 *
 * The controller that acted is the one pulsed: a pointer event from
 * @react-three/xr carries its input source state, and a select or squeeze on
 * the session names it too, for actions that reach the machine without the
 * event (the machine store's operate()). Hands have no actuator and a desktop
 * has no session: every call is a no-op there.
 */
export type Pulse = "tap" | "detent" | "cut" | "crash";

const PULSES: Record<Pulse, { intensity: number; ms: number }> = {
  tap: { intensity: 0.35, ms: 18 },
  detent: { intensity: 0.5, ms: 12 },
  cut: { intensity: 0.15, ms: 60 },
  crash: { intensity: 1, ms: 260 },
};

type Actuated = { gamepad?: Gamepad | null; handedness?: XRHandedness };

let session: XRSession | null = null;
/** The input source that last pressed something. */
let lastSource: XRInputSource | null = null;

function vibrate(source: Actuated | null | undefined, intensity: number, ms: number) {
  const gamepad = source?.gamepad;
  if (!gamepad) return;
  const actuator = (gamepad as Gamepad & { hapticActuators?: { pulse?: (i: number, d: number) => Promise<boolean> }[] })
    .hapticActuators?.[0];
  if (actuator?.pulse) {
    void actuator.pulse(intensity, ms).catch(() => {});
    return;
  }
  // Newer browsers expose the Gamepad vibration API instead.
  const effect = (gamepad as Gamepad & { vibrationActuator?: GamepadHapticActuator }).vibrationActuator;
  void effect?.playEffect?.("dual-rumble", { duration: ms, strongMagnitude: intensity, weakMagnitude: intensity }).catch(() => {});
}

/** Pulse the controller behind a pointer event — the one that pressed. */
export function pulseFrom(event: unknown, kind: Pulse = "tap") {
  if (!session) return;
  const state = (event as { pointerState?: { type?: string; inputSource?: XRInputSource } } | null)?.pointerState;
  if (state?.type !== "controller" || !state.inputSource) return;
  lastSource = state.inputSource;
  const { intensity, ms } = PULSES[kind];
  vibrate(state.inputSource, intensity, ms);
}

/** Pulse the controller that last acted, or both for something felt everywhere. */
export function pulse(kind: Pulse, which: "last" | "both" = "last", scale = 1) {
  if (!session) return;
  const { intensity, ms } = PULSES[kind];
  const sources = which === "both" ? [...session.inputSources] : lastSource ? [lastSource] : [];
  for (const source of sources) vibrate(source, Math.min(1, intensity * scale), ms);
}

/**
 * Cutting load: material removed, gathered over a tenth of a second and
 * turned into a light buzz scaled by the removal rate, so a heavy cut feels
 * heavier than a skim. Cut reports arrive per sweep, a few each frame.
 */
const cutting = { removed: 0, since: 0 };
export function pulseCut(removedMm3: number) {
  if (!session || removedMm3 <= 0) return;
  const now = performance.now();
  // A new cut after a pause starts its own measurement.
  if (now - cutting.since > 500) {
    cutting.since = now;
    cutting.removed = 0;
  }
  cutting.removed += removedMm3;
  const elapsed = (now - cutting.since) / 1000;
  if (elapsed < 0.09) return;
  // A 10 mm cutter slotting 1 mm deep at 600 mm/min removes ~100 mm³/s.
  const rate = cutting.removed / elapsed;
  cutting.removed = 0;
  cutting.since = now;
  pulse("cut", "both", 0.6 + Math.min(1.4, rate / 150));
}

/** Keeps the module's session and "last controller" current. Mount once inside <XR>. */
export function useHaptics() {
  const current = useXR((s) => s.session);
  useEffect(() => {
    session = current ?? null;
    if (!current) {
      lastSource = null;
      return;
    }
    const remember = (event: XRInputSourceEvent) => {
      lastSource = event.inputSource;
    };
    current.addEventListener("selectstart", remember);
    current.addEventListener("squeezestart", remember);
    return () => {
      current.removeEventListener("selectstart", remember);
      current.removeEventListener("squeezestart", remember);
      if (session === current) session = null;
    };
  }, [current]);
}

/** The component form of useHaptics, for scenes that mount it as JSX. */
export function HapticsBridge() {
  useHaptics();
  return null;
}
