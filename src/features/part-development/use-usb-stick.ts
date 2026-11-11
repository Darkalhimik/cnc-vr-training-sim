"use client";

import { useEffect } from "react";
import { useMachineStore } from "@/entities/machine/machine-store";
import { useJobStore } from "./job-store";
import { programName } from "./setup";

/**
 * The office PC and the stick: whatever the workspace holds is on the USB
 * stick in the pendant, under its O-number, as it is typed — and again after
 * a level hands over a fresh machine. Getting it into control memory is the
 * trainee's job at the pendant (LIST PROGRAM → USB → SELECT PROGRAM).
 */
export function useUsbStick() {
  const name = useJobStore((s) => programName(s.design));
  const program = useJobStore((s) => s.program);
  const onStick = useMachineStore((s) => s.machine.usb?.[name] === program);
  useEffect(() => {
    if (!onStick) useMachineStore.getState().writeUsb(name, program);
  }, [name, program, onStick]);
}
