export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "cnc-theme";
export const DEFAULT_THEME: Theme = "dark";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/** Put the theme on the document. `color-scheme` is what makes native
 *  controls — the machine-scale range input — match the rest of the page. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function storeTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // A blocked storage (private window, site data off) costs the preference
    // between reloads, never the page.
  }
}

/**
 * Runs before first paint, from a blocking inline script in the document head,
 * so the stored theme is on `<html>` by the time anything is drawn. Without it
 * the page paints dark and then flips to light — worse than either theme.
 *
 * Inlined as a string because it has to execute ahead of React, which means it
 * cannot import from this module. Keep it in sync with `applyTheme` above.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t!=="light"&&t!=="dark"){t=${JSON.stringify(
  DEFAULT_THEME,
)}}var r=document.documentElement;r.classList.toggle("dark",t==="dark");r.style.colorScheme=t}catch(e){document.documentElement.classList.add("dark")}})()`;
