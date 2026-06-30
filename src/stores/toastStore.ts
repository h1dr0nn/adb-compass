import { create } from "zustand";

export type ToastVariant = "default" | "success" | "error" | "info" | "loading";

/** Inline text link on the right of a plain description row (no background). */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  /** Render the description as a click-to-copy code block. */
  copyable: boolean;
  action?: ToastAction;
  /** Auto-dismiss delay in ms; Infinity keeps it until dismissed. */
  duration: number;
}

interface ToastState {
  toasts: ToastItem[];
  /** Add a new toast, or replace one with the same id (loading -> result). */
  add: (item: ToastItem) => void;
  /** Remove one toast by id, or all when id is omitted. */
  remove: (id?: string) => void;
}

/** Cap concurrent toasts so a burst can't fill the screen. */
export const MAX_TOASTS = 4;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (item) =>
    set((s) => {
      const exists = s.toasts.some((t) => t.id === item.id);
      if (exists) {
        return { toasts: s.toasts.map((t) => (t.id === item.id ? item : t)) };
      }
      // Newest last so it stacks closest to the bottom-right corner.
      return { toasts: [...s.toasts, item].slice(-MAX_TOASTS) };
    }),
  remove: (id) =>
    set((s) => ({
      toasts: id == null ? [] : s.toasts.filter((t) => t.id !== id),
    })),
}));

let idCounter = 0;
export function nextToastId(): string {
  idCounter += 1;
  return `toast-${idCounter}`;
}
