import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HAAS UMC-500 | CNC VR Training Simulator",
  description:
    "Interactive 3D training simulator for the HAAS UMC-500 5-axis Universal Machining Center. Desktop, VR, and AR modes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
