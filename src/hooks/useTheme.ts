import { useThemeStore } from "../stores/themeStore";

/** Backwards-compatible accessor for theme state, now backed by Zustand. */
export function useTheme() {
  return useThemeStore();
}
