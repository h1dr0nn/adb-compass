import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { check } from "@tauri-apps/plugin-updater";
import { toast } from "sonner";
import {
  Menu,
  RefreshCw,
  Wifi,
  Settings as SettingsIcon,
  DownloadCloud,
  RotateCw,
  Power,
} from "lucide-react";
import { useDeviceStore } from "../../stores/deviceStore";

interface MenuDropdownProps {
  onOpenSettings: () => void;
  onOpenWireless: () => void;
}

/** Titlebar hamburger menu with app-level actions. */
export function MenuDropdown({ onOpenSettings, onOpenWireless }: MenuDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const close = () => setOpen(false);

  const checkUpdates = async () => {
    close();
    try {
      const update = await check();
      if (update) {
        toast.info(`Update available: v${update.version}`, {
          description: "Open Settings to install.",
        });
      } else {
        toast.success("You are up to date");
      }
    } catch {
      toast.error("Update check failed");
    }
  };

  const items = [
    {
      icon: <RefreshCw size={15} />,
      label: "Refresh devices",
      action: () => {
        close();
        useDeviceStore.getState().refreshDevices();
      },
    },
    {
      icon: <Wifi size={15} />,
      label: "Wireless connect",
      action: () => {
        close();
        onOpenWireless();
      },
    },
    {
      icon: <SettingsIcon size={15} />,
      label: "Settings",
      action: () => {
        close();
        onOpenSettings();
      },
    },
    {
      icon: <DownloadCloud size={15} />,
      label: "Check for updates",
      action: checkUpdates,
    },
    {
      icon: <RotateCw size={15} />,
      label: "Reload window",
      action: () => {
        close();
        window.location.reload();
      },
    },
    {
      icon: <Power size={15} />,
      label: "Quit",
      action: () => {
        close();
        getCurrentWindow().close();
      },
      danger: true,
    },
  ];

  return (
    <div ref={ref} className="relative h-full flex items-center">
      <button
        onClick={() => setOpen((v) => !v)}
        className="titlebar-icon-btn"
        aria-label="Menu"
      >
        <Menu size={16} strokeWidth={1.75} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 top-[34px] z-[5600] w-52 rounded-xl border border-border bg-surface-card p-1.5 shadow-2xl"
          >
            {items.map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                  item.danger
                    ? "text-error hover:bg-error/10"
                    : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                }`}
              >
                <span className={item.danger ? "" : "text-text-muted"}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
