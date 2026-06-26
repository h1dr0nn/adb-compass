import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { MenuDropdown } from "./MenuDropdown";
import { BinariesMenu } from "./BinariesMenu";

const appWindow = getCurrentWindow();

interface TitleBarProps {
  onSearch: () => void;
  onOpenSettings: () => void;
  onOpenWireless: () => void;
}

/** Custom window chrome (decorations:false). Left: menu + search. Right:
 * Binaries dropdown then the min/max/close window controls. */
export function TitleBar({ onSearch, onOpenSettings, onOpenWireless }: TitleBarProps) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    appWindow
      .isMaximized()
      .then((m) => !cancelled && setMaximized(m))
      .catch(() => {});
    const unlisten = appWindow.onResized(() => {
      appWindow
        .isMaximized()
        .then((m) => !cancelled && setMaximized(m))
        .catch(() => {});
    });
    return () => {
      cancelled = true;
      unlisten.then((f) => f());
    };
  }, []);

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar-cluster">
        <MenuDropdown onOpenSettings={onOpenSettings} onOpenWireless={onOpenWireless} />
        <button
          className="titlebar-icon-btn"
          onClick={onSearch}
          aria-label="Search"
          title="Search (Ctrl+K)"
        >
          <Search size={16} strokeWidth={1.75} />
        </button>
      </div>

      <div className="titlebar-drag" data-tauri-drag-region />

      <div className="titlebar-cluster titlebar-cluster--right">
        <BinariesMenu />
      </div>

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
          className="titlebar-btn"
          onClick={() => appWindow.toggleMaximize()}
          aria-label="Maximize"
        >
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M2.5 0v2.5H0V10h7.5V7.5H10V0H2.5zm0 9H1V3.5h6.5V5h-5v4zM9 6.5H3.5V1H9v5.5z"
                fill="currentColor"
              />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M0 0v10h10V0H0zm1 1h8v8H1V1z" fill="currentColor" />
            </svg>
          )}
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
  );
}
