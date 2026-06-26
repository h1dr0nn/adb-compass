import type { ComponentType } from "react";
import { Smartphone, ScrollText, TerminalSquare } from "lucide-react";

export type Tab = "devices" | "logcat" | "terminal";

export interface TabMeta {
  id: Tab;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  title: string;
  subtitle: string;
}

export const tabs: TabMeta[] = [
  {
    id: "devices",
    label: "Devices",
    icon: Smartphone,
    title: "Device Control",
    subtitle: "Manage connected Android devices, install APKs and inspect status",
  },
  {
    id: "logcat",
    label: "Logcat",
    icon: ScrollText,
    title: "",
    subtitle: "",
  },
  {
    id: "terminal",
    label: "Terminal",
    icon: TerminalSquare,
    title: "",
    subtitle: "",
  },
];
