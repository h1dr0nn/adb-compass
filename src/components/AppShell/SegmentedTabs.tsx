import clsx from "clsx";
import { motion } from "framer-motion";
import { tabs, type Tab } from "./tabs";

interface SegmentedTabsProps {
  active: Tab;
  onChange: (t: Tab) => void;
}

export function SegmentedTabs({ active, onChange }: SegmentedTabsProps) {
  return (
    <div className="relative inline-flex items-center gap-1 rounded-[12px] bg-surface-elevated/60 p-1 shadow-[0_0_0_1px_var(--color-border)]">
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={clsx(
              "relative inline-flex items-center gap-2 rounded-[9px] px-3 h-8 text-[13px] font-medium",
              "transition-colors duration-150 cursor-pointer",
              isActive
                ? "text-text-primary"
                : "text-text-muted hover:text-text-primary",
            )}
          >
            {isActive && (
              <motion.span
                layoutId="adb-tab-pill"
                className="absolute inset-0 z-0 rounded-[9px] bg-surface-card shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_var(--color-border)]"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-2">
              <Icon size={14} strokeWidth={1.8} />
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
