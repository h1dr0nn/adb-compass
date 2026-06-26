import { useLangStore } from "../stores/langStore";

/** Backwards-compatible accessor for language state, now backed by Zustand. */
export function useLanguage() {
  return useLangStore();
}
