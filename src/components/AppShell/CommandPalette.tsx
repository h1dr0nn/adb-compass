import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Smartphone,
  ScrollText,
  TerminalSquare,
  Settings as SettingsIcon,
  Wifi,
  RefreshCw,
  CornerDownLeft,
} from "lucide-react";
import { useDeviceStore } from "../../stores/deviceStore";
import type { Tab } from "./tabs";

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTab: (tab: Tab) => void;
  onOpenSettings: () => void;
  onOpenWireless: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  onSelectTab,
  onOpenSettings,
  onOpenWireless,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const devices = useDeviceStore((s) => s.devices);
  const setSelectedDevice = useDeviceStore((s) => s.setSelectedDevice);

  const items = useMemo<CommandItem[]>(() => {
    const close = () => onOpenChange(false);
    const nav: CommandItem[] = [
      {
        id: "tab-devices",
        label: "Go to Devices",
        hint: "Tab",
        icon: <Smartphone size={15} />,
        run: () => {
          onSelectTab("devices");
          close();
        },
      },
      {
        id: "tab-logcat",
        label: "Go to Logcat",
        hint: "Tab",
        icon: <ScrollText size={15} />,
        run: () => {
          onSelectTab("logcat");
          close();
        },
      },
      {
        id: "tab-terminal",
        label: "Go to Terminal",
        hint: "Tab",
        icon: <TerminalSquare size={15} />,
        run: () => {
          onSelectTab("terminal");
          close();
        },
      },
      {
        id: "act-wireless",
        label: "Wireless connect",
        hint: "Action",
        icon: <Wifi size={15} />,
        run: () => {
          onOpenWireless();
          close();
        },
      },
      {
        id: "act-refresh",
        label: "Refresh devices",
        hint: "Action",
        icon: <RefreshCw size={15} />,
        run: () => {
          useDeviceStore.getState().refreshDevices();
          close();
        },
      },
      {
        id: "act-settings",
        label: "Open Settings",
        hint: "Action",
        icon: <SettingsIcon size={15} />,
        run: () => {
          onOpenSettings();
          close();
        },
      },
    ];
    const deviceItems: CommandItem[] = devices.map((d) => ({
      id: `dev-${d.id}`,
      label: `Select ${d.model || d.id}`,
      hint: "Device",
      icon: (
        <Smartphone
          size={15}
          className={d.status === "Device" ? "text-accent" : "text-text-muted"}
        />
      ),
      run: () => {
        setSelectedDevice(d.id);
        onOpenChange(false);
      },
    }));
    return [...nav, ...deviceItems];
  }, [devices, onOpenChange, onSelectTab, onOpenSettings, onOpenWireless, setSelectedDevice]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => (i + 1) % Math.max(filtered.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => (i - 1 + filtered.length) % Math.max(filtered.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[index]?.run();
    } else if (e.key === "Escape") {
      onOpenChange(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop sits below the titlebar (z-5000) so window chrome stays
           * visible and draggable. */}
          <motion.div
            className="fixed inset-0 z-[2999] bg-[var(--color-overlay)] backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="fixed left-1/2 top-[calc(32px+14vh)] z-[3000] w-[560px] max-w-[90vw] -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-surface-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Search size={18} className="text-text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search actions, devices..."
                className="flex-1 bg-transparent text-[15px] text-text-primary placeholder:text-text-muted focus:outline-none"
              />
            </div>
            <div className="max-h-[340px] overflow-y-auto custom-scrollbar p-2">
              {filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-text-muted">
                  No matches
                </div>
              ) : (
                filtered.map((item, i) => (
                  <button
                    key={item.id}
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => item.run()}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      i === index
                        ? "bg-accent/10 text-text-primary"
                        : "text-text-secondary hover:bg-surface-hover"
                    }`}
                  >
                    <span className="text-text-muted">{item.icon}</span>
                    <span className="flex-1 text-[14px]">{item.label}</span>
                    {item.hint && (
                      <span className="text-[10px] uppercase tracking-wider text-text-muted">
                        {item.hint}
                      </span>
                    )}
                    {i === index && (
                      <CornerDownLeft size={14} className="text-text-muted" />
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
