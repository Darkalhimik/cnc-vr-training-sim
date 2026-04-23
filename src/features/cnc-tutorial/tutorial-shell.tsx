"use client";

import { SimulationShell } from "@/features/simulation/simulation-shell";
import type { SimulationMode } from "./tutorial-types";

type TutorialShellProps = {
  mode: SimulationMode;
  tutorialOnly?: boolean;
};

export function TutorialShell({ mode }: TutorialShellProps) {
  return <SimulationShell deviceMode={mode} gameMode="tutorial" />;
}
