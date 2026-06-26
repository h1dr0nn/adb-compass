import { create } from "zustand";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "theme";

function loadTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

interface ThemeState {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  /** Internal: set the resolved theme (called by useThemeSync). */
  applyResolved: (resolved: ResolvedTheme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: loadTheme(),
  resolvedTheme: "dark",
  setTheme: (theme) => {
    localStorage.setItem(STORAGE_KEY, theme);
    set({ theme });
  },
  applyResolved: (resolved) => set({ resolvedTheme: resolved }),
}));
