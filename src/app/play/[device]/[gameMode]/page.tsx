"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import type { DeviceMode, GameMode } from "@/entities/machine/machine-types";
import { SimulationShell } from "@/features/simulation/simulation-shell";

const VALID_DEVICES = ["desktop", "vr", "ar"] as const;
const VALID_MODES = ["tutorial", "freeplay"] as const;

function isValidDevice(d: string): d is DeviceMode {
  return (VALID_DEVICES as readonly string[]).includes(d);
}
function isValidGameMode(m: string): m is GameMode {
  return (VALID_MODES as readonly string[]).includes(m);
}

export default function PlayPage() {
  const router = useRouter();
  const params = useParams<{ device: string; gameMode: string }>();

  const device = params.device;
  const gameMode = params.gameMode;

  useEffect(() => {
    if (!isValidDevice(device) || !isValidGameMode(gameMode)) {
      router.replace("/");
    }
  }, [device, gameMode, router]);

  if (!isValidDevice(device) || !isValidGameMode(gameMode)) {
    return null;
  }

  return <SimulationShell deviceMode={device} gameMode={gameMode} />;
}
