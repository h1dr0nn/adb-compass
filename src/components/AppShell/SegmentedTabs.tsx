import clsx from "clsx";
import { motion } from "framer-motion";
import { tabs, type Tab } from "./tabs";
import { useLanguage } from "../../hooks/useLanguage";

interface SegmentedTabsProps {
  active: Tab;
  onChange: (t: Tab) => void;
}

const tabLabelKey: Record<Tab, "tabDevices" | "tabLogcat" | "tabTerminal"> = {
  devices: "tabDevices",
  logcat: "tabLogcat",
  terminal: "tabTerminal",
};

export function SegmentedTabs({ active, onChange }: SegmentedTabsProps) {
  const { t } = useLanguage();
  return (
    <div className="relative inline-flex items-center gap-1 rounded-[10px] bg-surface-elevated/60 p-1 shadow-[0_0_0_1px_var(--color-border)]">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={clsx(
              "relative inline-flex items-center gap-2 rounded-[6px] px-3 h-8 text-[13px] font-medium",
              "transition-colors duration-150 cursor-pointer",
              isActive
                ? "text-text-primary"
                : "text-text-muted hover:text-text-primary",
            )}
          >
            {isActive && (
              <motion.span
                layoutId="adb-tab-pill"
                className="absolute inset-0 z-0 rounded-[6px] bg-surface-card shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_var(--color-border)]"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-2">
              <Icon size={14} strokeWidth={1.8} />
              {t[tabLabelKey[tab.id]]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
