"use client";

import { FeatureGrid } from "@/widgets/landing/feature-grid";
import { Footer } from "@/widgets/landing/footer";
import { HeroSection } from "@/widgets/landing/hero-section";
import { ModeSelector } from "@/widgets/landing/mode-selector";

export default function HomePage() {
  return (
    <div className="relative z-[1] flex min-h-dvh flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.2),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_32%)]" />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-20 px-6 py-12 lg:px-10 lg:py-16">
        <section className="grid items-start gap-10 lg:grid-cols-[1.3fr_0.9fr]">
          <HeroSection />
          <ModeSelector />
        </section>

        <FeatureGrid />
      </main>

      <Footer />
    </div>
  );
}
