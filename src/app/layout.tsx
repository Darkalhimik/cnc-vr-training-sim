import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Open_Sans } from "next/font/google";
import "./globals.css";
import { THEME_BOOTSTRAP_SCRIPT } from "@/shared/lib/theme";

// Three faces, one job each. Inter marks hierarchy so a heading never needs a
// second colour or a rule; Open Sans has to disappear at 12px in a dense HUD
// row, which is where most of this product lives; JetBrains Mono disambiguates
// 0/O and 1/l/I, which is the whole point of setting a machine state or a
// scale factor in mono.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "HAAS UMC-500 | CNC VR Training Simulator",
  description:
    "Interactive 3D training simulator for the HAAS UMC-500 5-axis Universal Machining Center. Desktop, VR, and AR modes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The theme class is written by the head script below, before paint, so
    // the server markup deliberately carries none — suppressHydrationWarning
    // keeps React from flagging the difference it is about to find.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body
        className={`${inter.variable} ${openSans.variable} ${jetBrainsMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
