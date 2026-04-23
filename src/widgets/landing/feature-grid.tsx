const features = [
  {
    title: "Machine",
    desc: "A more restrained UMC-500-inspired scene with corrected operator-side layout.",
  },
  {
    title: "Controls",
    desc: "An enlarged console, clearer buttons, and separate valves for interaction practice.",
  },
  {
    title: "Training",
    desc: "A five-step startup tutorial carried over from the original logic, now with a better HUD.",
  },
  {
    title: "Preview",
    desc: "Desktop orbit controls plus VR and AR session entry where WebXR is available.",
  },
];

export function FeatureGrid() {
  return (
    <section className="animate-fade-in-up-delay-3 grid grid-cols-1 gap-6 border-t border-border pt-8 sm:grid-cols-2 lg:grid-cols-4">
      {features.map((feature) => (
        <div key={feature.title} className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-text-muted">
            {feature.title}
          </p>
          <p className="text-sm leading-relaxed text-text-secondary">{feature.desc}</p>
        </div>
      ))}
    </section>
  );
}
