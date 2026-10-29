"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getActiveRun, useMachineStore } from "@/entities/machine/machine-store";
import { stepRun } from "@/entities/machine/program-run";
import { toolInStock } from "@/entities/machine/kinematics";
import { AXES, spindleRpm, type AxisValues } from "@/entities/machine/machine-types";
import { MATERIALS, toolByNumber } from "@/entities/part/tool-library";
import { cutterOf, segment } from "@/features/part-development/cutter";
import { createStockRemoval, type StockRemoval, type ToolPose } from "@/features/part-development/removal";
import { useSessionStore } from "@/features/session/session-store";
import { useStockRegistry } from "@/features/part-development/stock-registry";
import { pulse, pulseCut } from "@/features/xr/haptics";
import type { MachineRig } from "./machine-rig";

/** How often a running program's position is written back to the store. */
const PROGRESS_S = 0.1;
/** Material a non-cutting move may graze before it counts as a crash, mm³. */
const GRAZE_MM3 = 0.5;

/**
 * The stock in the vise as a cuttable solid, and the loop that runs the
 * machine: plays the active program, and sweeps every tool movement —
 * program or hand jog — through the stock.
 *
 * Crashes are real alarms: the shank or holder entering material, a rapid
 * into the part, or cutting with the spindle stopped.
 */
export function MachineRuntime({ rig }: { rig: MachineRig }) {
  const stock = useMachineStore((s) => s.machine.stock);
  const deviceMode = useSessionStore((s) => s.deviceMode);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ metalness: 0.55, roughness: 0.4 }), []);
  // Created in an effect, not a memo: a disposed solid cannot come back, and
  // development mode mounts every component twice.
  const [removal, setRemoval] = useState<StockRemoval | null>(null);
  const ready = useRef(false);
  const lastPosition = useRef<AxisValues | null>(null);
  const lastProgressAt = useRef(0);
  const inFlight = useRef(0);

  useEffect(() => {
    const created = createStockRemoval(material);
    setRemoval(created);
    useStockRegistry.getState().setRemoval(created);
    return () => {
      useStockRegistry.getState().setRemoval(null);
      created.dispose();
    };
  }, [material]);

  // A new blank is a fresh solid. Coarser in a headset, where the triangle
  // budget is a fraction of a desktop's.
  useEffect(() => {
    ready.current = false;
    if (!stock || !removal) return;
    material.color.set(MATERIALS[stock.material].color);
    let cancelled = false;
    removal
      .reset({ size: stock.size, voxel: deviceMode === "desktop" ? undefined : 1 })
      .then(() => {
        if (!cancelled) ready.current = true;
      })
      .catch((error: unknown) => console.warn("[MachineRuntime] stock reset failed:", error));
    return () => {
      cancelled = true;
    };
  }, [stock, removal, material, deviceMode]);

  const cut = (positions: AxisValues[], rapid: boolean) => {
    const store = useMachineStore.getState();
    const m = store.machine;
    const tool = toolByNumber(m.toolInSpindle);
    if (!removal || !ready.current || !tool || positions.length === 0) return;
    // Back-pressure: drop a frame's sweep rather than queue minutes of work.
    if (inFlight.current > 3) return;
    const poses: ToolPose[] = positions.map((p) => toolInStock(p, tool.length));
    const turning = spindleRpm(m) > 0;
    inFlight.current += 1;
    removal
      .cut(cutterOf(tool), poses)
      .then((report) => {
        const now = useMachineStore.getState();
        if (now.machine.alarms.some((a) => a.code === "crash")) return;
        // In a headset the controllers feel the cut, and the crash.
        pulseCut(report.removedMm3);
        const crashed = (text: string) => {
          now.crash(text);
          pulse("crash", "both");
        };
        if (report.collision) {
          crashed(report.collision.kind === "holder" ? "TOOL HOLDER HIT THE PART" : "TOOL SHANK HIT THE PART");
        } else if (rapid && report.removedMm3 > GRAZE_MM3) {
          crashed("RAPID MOVE INTO MATERIAL");
        } else if (!turning && report.removedMm3 > GRAZE_MM3) {
          crashed("TOOL HIT THE PART WITH THE SPINDLE STOPPED");
        }
      })
      // A cut still in flight when the stock is swapped or disposed is dropped.
      .catch(() => {})
      .finally(() => {
        inFlight.current -= 1;
      });
  };

  useFrame(({ clock }, dt) => {
    const store = useMachineStore.getState();
    const m = store.machine;
    const run = getActiveRun();

    if (run && m.program === "running") {
      const frame = stepRun(run, m, Math.min(dt, 0.1));
      for (const action of frame.actions) store.runAction(action);
      cut(frame.feed, false);
      cut(frame.rapid, true);
      lastPosition.current = { ...run.position };

      const now = clock.elapsedTime;
      if (frame.progress && now - lastProgressAt.current > PROGRESS_S) {
        store.runAction(frame.progress);
        lastProgressAt.current = now;
      }
      return;
    }

    // Hand moves and zero returns: sweep what the rig actually drew.
    const drawn = rig.anim.position;
    const last = lastPosition.current;
    if (last && AXES.some((a) => Math.abs(drawn[a] - last[a]) > 0.005)) {
      cut(segment(last, drawn), m.homingStage !== null);
    }
    lastPosition.current = { ...drawn };
  });

  if (!stock || !removal) return null;
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} scale={0.001}>
      <primitive object={removal.group} />
    </group>
  );
}
