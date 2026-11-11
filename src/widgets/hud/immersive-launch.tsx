"use client";

import { DEVICE_LABEL, type DeviceMode } from "@/entities/machine/machine-types";
import { Button } from "@/shared/ui/button";

const HELP: Record<Exclude<DeviceMode, "desktop">, string> = {
  vr: "Open this page in the VR glasses' browser over https and press Enter VR. Here you see a preview.",
  glasses: "Open this page in the AR glasses' browser over https and press Enter AR. Here you see a preview.",
  phone: "Open this page on the phone over https and press Enter AR. Here you see a preview.",
};

/**
 * Going into the glasses or the phone: the same block in every immersive
 * mode, in the same place — the first section under the mode switch, in the
 * workshop panel (VR) as in the machine panel (AR).
 */
export function ImmersiveLaunch({
  device,
  onEnter,
  error,
  sessionInfo,
}: {
  device: Exclude<DeviceMode, "desktop">;
  onEnter: () => void;
  error: string | null;
  sessionInfo?: string | null;
}) {
  return (
    <section className="space-y-2 border-t p-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide">{DEVICE_LABEL[device]}</h3>
      <Button size="lg" className="w-full" onClick={onEnter}>
        {device === "vr" ? "Enter VR" : "Enter AR"}
      </Button>
      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs/relaxed text-destructive">
          {error}
        </p>
      ) : (
        <p className="text-xs/relaxed text-muted-foreground">{HELP[device]}</p>
      )}
      {sessionInfo && (
        <p className="rounded-md border bg-muted/50 px-3 py-2 font-mono text-[10px] text-muted-foreground">{sessionInfo}</p>
      )}
    </section>
  );
}
