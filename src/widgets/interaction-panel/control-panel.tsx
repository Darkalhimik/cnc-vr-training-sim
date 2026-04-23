"use client";

import Link from "next/link";
import type { SimulationMode } from "@/features/cnc-tutorial/tutorial-types";

type ControlPanelProps = {
  mode: SimulationMode;
  tutorialOnly: boolean;
};

const MODES: Array<{ href: string; label: string }> = [
  { href: "/desktop", label: "Desktop" },
  { href: "/vr", label: "VR" },
  { href: "/ar", label: "AR" },
  { href: "/tutorial", label: "Tutorial" },
];

export function ControlPanel({ mode, tutorialOnly }: ControlPanelProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        background: "rgba(251, 253, 253, 0.86)",
        border: "1px solid #d2dde1",
        borderRadius: 14,
        padding: "10px 12px",
      }}
    >
      <div>
        <strong>Mode:</strong> {mode.toUpperCase()} {tutorialOnly ? "(tutorial only)" : ""}
      </div>
      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {MODES.map((item) => {
          const itemMode = item.label.toLowerCase();
          const isActive = tutorialOnly ? itemMode === "tutorial" : itemMode === mode;

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid #b7cad0",
                background: isActive ? "#0b8f7a" : "#ffffff",
                color: isActive ? "#ffffff" : "#12344d",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
