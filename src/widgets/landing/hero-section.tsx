"use client";

import { Field } from "@/shared/ui/field";

export function HeroSection() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Desktop, VR, and phone AR training for a 5-axis machine
        </h1>

        <p className="max-w-2xl text-sm text-muted-foreground">
          A simulation shell with guided startup training, free exploration, and a UMC-500
          scene built for interaction.
        </p>
      </div>

      <section className="grid gap-3 rounded-md border p-4">
        <Field label="Machine" value="UMC-500 universal machining center" />
        <Field label="Modes" value="Tutorial, free play" />
        <Field label="Devices" value="Desktop, VR, phone AR" />
      </section>
    </section>
  );
}
