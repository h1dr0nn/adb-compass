import { motion } from "framer-motion";
import { tabs, type Tab } from "./tabs";

export function PageHeader({ tab }: { tab: Tab }) {
  const meta = tabs.find((t) => t.id === tab)!;
  const isDevices = tab === "devices";

  return (
    <motion.div
      key={tab}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="px-3 pt-3 pb-2"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            {isDevices
              ? "Device Control"
              : tab === "logcat"
              ? "Live Logcat"
              : tab === "terminal"
              ? "ADB Shell"
              : meta.label}
          </span>
          <div className="h-px flex-1 bg-border/60" />
        </div>
        {!isDevices && meta.title && (
          <h1 className="text-[30px] font-bold text-text-primary tracking-tight leading-tight">
            {meta.title}
          </h1>
        )}
        {!isDevices && meta.subtitle && (
          <p className="text-[14px] text-text-secondary/80 max-w-[720px] leading-relaxed">
            {meta.subtitle}.
          </p>
        )}
      </div>
    </motion.div>
  );
}
