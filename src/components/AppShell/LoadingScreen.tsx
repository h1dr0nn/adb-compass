import { getCurrentWindow } from "@tauri-apps/api/window";
import { motion } from "framer-motion";
import { useLanguage } from "../../hooks/useLanguage";

const appWindow = getCurrentWindow();

/** Instant, lightweight launch screen shown while the Rust side boots the ADB
 * daemon + tracker in the background. Keeps the window movable/closable. */
export function LoadingScreen() {
  const { t } = useLanguage();
  return (
    <div className="app-shell">
      {/* Minimal window chrome so the user can move/close during boot. */}
      <div className="titlebar" data-tauri-drag-region>
        <div className="titlebar-drag" data-tauri-drag-region />
        <div className="titlebar-controls">
          <button
            className="titlebar-btn"
            onClick={() => appWindow.minimize()}
            aria-label="Minimize"
          >
            <svg width="10" height="1" viewBox="0 0 10 1" fill="none">
              <rect width="10" height="1" fill="currentColor" />
            </svg>
          </button>
          <button
            className="titlebar-btn titlebar-btn--close"
            onClick={() => appWindow.close()}
            aria-label="Close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M1 0L0 1l4 4-4 4 1 1 4-4 4 4 1-1-4-4 4-4-1-1-4 4L1 0z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </div>

      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center gap-4"
        data-tauri-drag-region
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <span className="text-[15px] font-semibold tracking-tight text-white/90">
          ADB Compass
        </span>
        <div className="flex items-center gap-1.5">
          <span className="loading-dot" />
          <span className="loading-dot loading-dot--2" />
          <span className="loading-dot loading-dot--3" />
        </div>
        <span className="text-[12px] text-white/45">{t.startingDaemon}</span>
      </motion.div>
    </div>
  );
}
