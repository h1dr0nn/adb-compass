import { useEffect } from "react";
import { useThemeStore, type ResolvedTheme } from "../stores/themeStore";

/** Resolves theme preference (incl. "system") to a concrete light/dark value
 * and reflects it onto <html data-theme>. Tailwind v4 + the CSS variables
 * re-resolve all colors from that attribute. Call once at the app root. */
export function useThemeSync(): void {
  const theme = useThemeStore((s) => s.theme);
  const applyResolved = useThemeStore((s) => s.applyResolved);

  useEffect(() => {
    const apply = (resolved: ResolvedTheme) => {
      document.documentElement.setAttribute("data-theme", resolved);
      applyResolved(resolved);
    };

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      apply(mq.matches ? "dark" : "light");
      const onChange = (e: MediaQueryListEvent) =>
        apply(e.matches ? "dark" : "light");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }

    apply(theme);
  }, [theme, applyResolved]);
}
