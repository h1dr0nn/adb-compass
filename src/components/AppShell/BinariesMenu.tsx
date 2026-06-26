import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Loader2 } from "lucide-react";
import * as tauri from "../../lib/tauri";
import type { BinaryStatus } from "../../types";

/** Titlebar "Binaries" button. Opens a dropdown listing every bundled tool
 * and whether it resolved OK. Lives left of the window controls. */
export function BinariesMenu() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [binaries, setBinaries] = useState<BinaryStatus[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    tauri
      .getBinaries()
      .then(setBinaries)
      .catch(() => setBinaries([]))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative h-full flex items-center">
      <button
        onClick={() => setOpen((v) => !v)}
        className="titlebar-icon-btn"
        aria-label="Binaries"
        title="Binaries"
      >
        <Package size={16} strokeWidth={1.75} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-[34px] z-[5600] w-72 rounded-xl border border-border bg-surface-card p-2 shadow-2xl"
          >
            <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Bundled tools
            </div>
            {loading ? (
              <div className="flex items-center gap-2 px-2 py-3 text-sm text-text-muted">
                <Loader2 size={14} className="animate-spin" /> Checking...
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {binaries.map((b) => (
                  <div
                    key={b.name}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-text-primary">
                        {b.name}
                      </div>
                      {b.detail && (
                        <div className="truncate text-[11px] text-text-muted">
                          {b.detail}
                        </div>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        b.ok
                          ? "bg-success/15 text-success"
                          : "bg-error/15 text-error"
                      }`}
                    >
                      {b.ok ? "Ready" : "Missing"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
