"use client";

export function HeroSection() {
  return (
    <section className="flex flex-col gap-10 text-left">
      <div className="space-y-5">
        <p className="animate-fade-in-up text-xs font-semibold uppercase tracking-[0.35em] text-text-muted">
          HAAS UMC-500 Training Simulator
        </p>

        <h1 className="animate-fade-in-up-delay-1 max-w-4xl text-[clamp(3rem,7vw,5.8rem)] font-extrabold leading-[0.98] tracking-tight">
          Desktop, VR, and phone AR training for a 5-axis machine.
        </h1>

        <p className="animate-fade-in-up-delay-2 max-w-2xl text-lg leading-relaxed text-text-secondary">
          A cleaner simulation shell with guided startup training, free exploration, and a
          procedural UMC-500 scene built for interaction.
        </p>
      </div>

      <div className="animate-fade-in-up-delay-3 grid max-w-3xl gap-4 border-t border-border pt-5 sm:grid-cols-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-text-muted">Machine</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">Procedural UMC-500 model</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-text-muted">Modes</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">Tutorial and free play</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-text-muted">Devices</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">Desktop, VR, phone AR</p>
        </div>
      </div>
    </section>
  );
}
