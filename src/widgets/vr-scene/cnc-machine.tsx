"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import type { MachinePartId } from "@/entities/machine/machine-parts";
import { ProceduralShell } from "./procedural-shell";
import { ShellFallbackBoundary } from "./shell-fallback-boundary";

const MachineModel = dynamic(
  () => import("./machine-model").then((mod) => mod.MachineModel),
  { ssr: false, loading: () => null },
);

type CncMachineProps = {
  highlightedParts: MachinePartId[];
  hoveredPart: MachinePartId | null;
  onPartInteract: (partId: MachinePartId, sign?: 1 | -1) => void;
  onHoverPart: (partId: MachinePartId | null) => void;
};

/** The rigged model, with a blockout standing in while it loads or if it
 *  fails to. Every control lives in the model itself. */
export function CncMachine(props: CncMachineProps) {
  return (
    <ShellFallbackBoundary fallback={<ProceduralShell />}>
      <Suspense fallback={<ProceduralShell />}>
        <MachineModel {...props} />
      </Suspense>
    </ShellFallbackBoundary>
  );
}
