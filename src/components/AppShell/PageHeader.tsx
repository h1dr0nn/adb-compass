import { motion } from "framer-motion";
import { type Tab } from "./tabs";
import { useLanguage } from "../../hooks/useLanguage";

export function PageHeader({ tab }: { tab: Tab }) {
  const { t } = useLanguage();
  const eyebrow =
    tab === "logcat"
      ? t.pageLogcat
      : tab === "terminal"
        ? t.pageTerminal
        : t.pageDeviceControl;

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
            {eyebrow}
          </span>
          <div className="h-px flex-1 bg-border/60" />
        </div>
      </div>
    </motion.div>
  );
}
