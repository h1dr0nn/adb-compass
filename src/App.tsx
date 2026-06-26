import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster } from "sonner";
import * as Tooltip from "@radix-ui/react-tooltip";
import { MirrorWindow } from "./components/modals/MirrorWindow";
import { useDevices } from "./hooks/useDevices";
import { useTheme } from "./hooks/useTheme";
import { useThemeSync } from "./hooks/useThemeSync";
import { useDeviceSync } from "./hooks/useDeviceSync";
import { useLanguage } from "./hooks/useLanguage";
import { TitleBar } from "./components/AppShell/TitleBar";
import { TopNav } from "./components/AppShell/TopNav";
import { PageHeader } from "./components/AppShell/PageHeader";
import { CommandPalette } from "./components/AppShell/CommandPalette";
import type { Tab } from "./components/AppShell/tabs";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Sidebar } from "./components/Sidebar";
import { Settings } from "./components/Settings";
import { LogcatView } from "./components/LogcatView";
import { TerminalView } from "./components/TerminalView";
import { DeviceDetailView } from "./components/DeviceDetailView";
import { ManualConnectModal } from "./components/modals/ManualConnectModal";
import { WirelessConnectModal } from "./components/modals/WirelessConnectModal";
import { Smartphone } from "lucide-react";
import { useDeviceStore } from "./stores/deviceStore";
import "./components/AppShell/titlebar.css";

const fadeView = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.18 },
};

function AppContent() {
  const { devices } = useDevices();
  const { t } = useLanguage();
  const { resolvedTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<Tab>("devices");
  const [showSettings, setShowSettings] = useState(false);
  const [showManualConnect, setShowManualConnect] = useState(false);
  const [showWireless, setShowWireless] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  
  const selectedDeviceId = useDeviceStore((s) => s.selectedDeviceId);
  const activeDevice = devices.find((d) => d.id === selectedDeviceId);

  // Mount global side effects once.
  useDeviceSync();

  // Global command palette shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowPalette((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleTabChange = (tab: Tab) => {
    setShowSettings(false);
    setActiveTab(tab);
  };

  const showPageHeader = !showSettings;

  return (
    <Tooltip.Provider delayDuration={300} skipDelayDuration={150}>
      {/* TitleBar lives OUTSIDE app-shell so it sits in the root stacking
       * context (z-5000) above any portaled modal, keeping window chrome
       * visible/usable while a modal is open (matches the search palette). */}
      <TitleBar
        onSearch={() => setShowPalette(true)}
        onOpenSettings={() => {
          setShowSettings(true);
        }}
        onOpenWireless={() => setShowWireless(true)}
      />
      <div className="app-shell">
        <div className="app-shell__topbar glass-panel">
          <TopNav
            active={activeTab}
            onChange={handleTabChange}
            onSettingsOpen={() => {
              setShowSettings(true);
            }}
            onOpenWireless={() => setShowWireless(true)}
          />
        </div>

        <ErrorBoundary>
          <main className="app-shell__main glass-panel">
            {showPageHeader && (
              <div className="shrink-0">
                <PageHeader tab={activeTab} />
              </div>
            )}

            <div className="flex-1 overflow-hidden px-3 pb-3">
              <div className="h-full rounded-[12px] overflow-hidden flex flex-col relative">
                {/* Settings overlay — transient, so still uses AnimatePresence */}
                <AnimatePresence>
                  {showSettings && (
                    <motion.div
                      key="settings"
                      className="absolute inset-0 z-10 h-full overflow-auto custom-scrollbar bg-surface-elevated"
                      {...fadeView}
                    >
                      <Settings onBack={() => setShowSettings(false)} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* === Tab panels — always mounted, visibility via CSS === */}
                <div
                  className="h-full flex gap-3 min-h-0"
                  style={{ display: activeTab === "devices" && !showSettings ? "flex" : "none" }}
                >
                  <Sidebar />
                  {activeDevice ? (
                    <div className="flex-1 min-w-0 bg-surface-card border border-border rounded-[12px] p-4 overflow-hidden flex flex-col">
                      <DeviceDetailView device={activeDevice} />
                    </div>
                  ) : (
                    <div className="flex-1 min-w-0 flex items-center justify-center bg-surface-card border border-border rounded-[12px] p-6">
                      <div className="flex flex-col items-center justify-center max-w-sm text-center">
                        <Smartphone size={64} className="text-text-muted opacity-40 animate-pulse mb-4" />
                        <h3 className="text-lg font-semibold mb-1 text-text-secondary">{t.noDevices}</h3>
                        <p className="text-text-muted text-sm mb-6">{t.connectDevices || 'Connect a device via USB or Wi-Fi to get started.'}</p>
                        <button
                          onClick={() => setShowManualConnect(true)}
                          className="px-4 py-2 bg-accent text-white hover:bg-accent-secondary rounded-lg transition-colors text-sm font-medium shadow-md cursor-pointer"
                        >
                          {t.connectViaIp || 'Connect via IP'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div
                  className="h-full w-full"
                  style={{ display: activeTab === "logcat" && !showSettings ? "block" : "none" }}
                >
                  <LogcatView />
                </div>

                <div
                  className="h-full w-full"
                  style={{ display: activeTab === "terminal" && !showSettings ? "block" : "none" }}
                >
                  <TerminalView />
                </div>
              </div>
            </div>
          </main>
        </ErrorBoundary>

        {showManualConnect && (
          <ManualConnectModal onClose={() => setShowManualConnect(false)} />
        )}
        {showWireless && (
          <WirelessConnectModal onClose={() => setShowWireless(false)} />
        )}

        <CommandPalette
          open={showPalette}
          onOpenChange={setShowPalette}
          onSelectTab={handleTabChange}
          onOpenSettings={() => setShowSettings(true)}
          onOpenWireless={() => setShowWireless(true)}
        />

        <Toaster
          position="bottom-right"
          theme={resolvedTheme === "dark" ? "dark" : "light"}
          toastOptions={{
            className:
              "bg-surface-card border border-border text-text-primary shadow-xl",
          }}
        />
      </div>
    </Tooltip.Provider>
  );
}

export default function App() {
  const [windowLabel, setWindowLabel] = useState<string>("");

  useThemeSync();

  useEffect(() => {
    setWindowLabel(getCurrentWindow().label);
  }, []);

  if (windowLabel.startsWith("mirror-")) {
    return (
      <div className="h-screen bg-black overflow-hidden font-sans">
        <MirrorWindow />
      </div>
    );
  }

  return <AppContent />;
}
