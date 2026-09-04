"use client";

import Link from "next/link";
import { HeroSection } from "@/widgets/landing/hero-section";
import { ModeSelector } from "@/widgets/landing/mode-selector";
import { ThemeToggle } from "@/widgets/theme-toggle/theme-toggle";

export default function HomePage() {
  return (
    <div className="min-h-dvh">
      <nav className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-8 py-3">
          <Link href="/" className="font-mono text-xs">
            HAAS UMC-500
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      <main className="mx-auto w-full max-w-6xl space-y-6 p-8">
        <section className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
          <HeroSection />
          <ModeSelector />
        </section>
      </main>
    </div>
  );
}
