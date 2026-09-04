"use client";

import { SegmentedControl } from "@/shared/ui/segmented-control";
import { useTheme } from "@/features/theme/use-theme";
import type { Theme } from "@/shared/lib/theme";

const options: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <SegmentedControl
      options={options}
      value={theme}
      onChange={setTheme}
      className={className}
    />
  );
}
