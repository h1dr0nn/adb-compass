import { Settings as SettingsIcon, Wifi } from "lucide-react";
import { SegmentedTabs } from "./SegmentedTabs";
import { DevicePicker } from "./DevicePicker";
import type { Tab } from "./tabs";
import { useLanguage } from "../../hooks/useLanguage";
import { AppTooltip } from "../ui/Tooltip";

interface TopNavProps {
  active: Tab;
  onChange: (t: Tab) => void;
  onSettingsOpen: () => void;
  onOpenWireless: () => void;
}

export function TopNav({ active, onChange, onSettingsOpen, onOpenWireless }: TopNavProps) {
  const { t } = useLanguage();

  return (
    <header className="relative h-full">
      {/* Center: segmented tabs, absolutely centered in the whole bar so
       * uneven left/right cluster widths don't shift it off-center. */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <SegmentedTabs active={active} onChange={onChange} />
      </div>

      <div className="flex items-center justify-between p-3 h-full gap-6">
        <div className="flex items-center gap-3 shrink-0">
          <img src="/icon.png" alt="" className="w-9 h-9 rounded-[10px] shadow-md" />
          <div className="flex flex-col leading-tight">
            <span className="text-[15px] font-bold text-text-primary">
              {t.appName}
            </span>
            <span className="text-[10.5px] text-text-muted font-mono">
              {t.version}
            </span>
          </div>
        </div>

        {/* Right cluster with its own subtle backing surface */}
        <div className="flex items-center gap-1 shrink-0 rounded-[10px] bg-surface-elevated/60 p-1 shadow-[0_0_0_1px_var(--color-border)]">
          <DevicePicker />

          <AppTooltip content={t.wirelessAdb}>
            <button
              onClick={onOpenWireless}
              aria-label="Wireless connect"
              className="flex h-8 w-8 items-center justify-center rounded-[6px] text-text-muted hover:text-accent hover:bg-surface-hover/60 transition-colors"
            >
              <Wifi size={16} strokeWidth={1.8} />
            </button>
          </AppTooltip>

          <AppTooltip content={t.settings}>
            <button
              onClick={onSettingsOpen}
              aria-label="Settings"
              className="flex h-8 w-8 items-center justify-center rounded-[6px] text-text-muted hover:text-text-primary hover:bg-surface-hover/60 transition-colors"
            >
              <SettingsIcon size={16} strokeWidth={1.8} />
            </button>
          </AppTooltip>
        </div>
      </div>
    </header>
  );
}
