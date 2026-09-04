"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_THEME,
  type Theme,
  applyTheme,
  readStoredTheme,
  storeTheme,
} from "@/shared/lib/theme";

/**
 * The document is the source of truth — the head script has already applied
 * the stored theme before React runs. This reads it back on mount rather than
 * during render, because a render-time read of `localStorage` would disagree
 * with the server HTML and get thrown away as a hydration mismatch.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    setThemeState(readStoredTheme());
  }, []);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    storeTheme(next);
  };

  return { theme, setTheme };
}
