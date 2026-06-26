import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster } from "sonner";
import * as Tooltip from "@radix-ui/react-tooltip";
import { MirrorWindow } from "./components/modals/MirrorWindow";
import { useDevices } from "./hooks/useDevices";
import { useApk } from "./hooks/useApk";
import { useTheme } from "./hooks/useTheme";
import { useThemeSync } from "./hooks/useThemeSync";
import { useDeviceSync } from "./hooks/useDeviceSync";
import { TitleBar } from "./components/AppShell/TitleBar";
import { TopNav } from "./components/AppShell/TopNav";
import { PageHeader } from "./components/AppShell/PageHeader";
import { CommandPalette } from "./components/AppShell/CommandPalette";
import type { Tab } from "./components/AppShell/tabs";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Sidebar } from "./components/Sidebar";
import { DeviceList } from "./components/DeviceList";
import { Settings } from "./components/Settings";
import { LogcatView } from "./components/LogcatView";
import { TerminalView } from "./components/TerminalView";
import { DeviceDetailView } from "./components/DeviceDetailView";
import { ManualConnectModal } from "./components/modals/ManualConnectModal";
import { WirelessConnectModal } from "./components/modals/WirelessConnectModal";
import type { DeviceInfo } from "./types";
import "./components/AppShell/titlebar.css";

const fadeView = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.18 },
};

function AppContent() {
  const { devices, loading, error, refreshDevices, removeDevice } = useDevices();
  const { apkInfo, selectApk, clearApk, scanFolder, setApkFromList } = useApk();
  const { resolvedTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<Tab>("devices");
  const [showSettings, setShowSettings] = useState(false);
  const [showManualConnect, setShowManualConnect] = useState(false);
  const [showWireless, setShowWireless] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null);

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
    setSelectedDevice(null);
    setActiveTab(tab);
  };

  const handleDeviceSelect = (device: DeviceInfo) => {
    setShowSettings(false);
    setSelectedDevice(device);
  };

  const showPageHeader = !showSettings && !selectedDevice;

  return (
    <Tooltip.Provider delayDuration={300} skipDelayDuration={150}>
      {/* TitleBar lives OUTSIDE app-shell so it sits in the root stacking
       * context (z-5000) above any portaled modal, keeping window chrome
       * visible/usable while a modal is open (matches the search palette). */}
      <TitleBar
        onSearch={() => setShowPalette(true)}
        onOpenSettings={() => {
          setSelectedDevice(null);
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
              setSelectedDevice(null);
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

            <div className="flex-1 overflow-hidden px-6 pb-6">
              <div className="h-full rounded-[12px] overflow-hidden flex flex-col">
                <AnimatePresence mode="wait">
                  {showSettings ? (
                    <motion.div key="settings" className="h-full overflow-auto custom-scrollbar" {...fadeView}>
                      <Settings onBack={() => setShowSettings(false)} />
                    </motion.div>
                  ) : activeTab === "logcat" ? (
                    <motion.div key="logcat" className="h-full" {...fadeView}>
                      <LogcatView />
                    </motion.div>
                  ) : activeTab === "terminal" ? (
                    <motion.div key="terminal" className="h-full" {...fadeView}>
                      <TerminalView />
                    </motion.div>
                  ) : selectedDevice ? (
                    <motion.div key="device-detail" className="h-full" {...fadeView}>
                      <DeviceDetailView
                        device={selectedDevice}
                        onBack={() => setSelectedDevice(null)}
                      />
                    </motion.div>
                  ) : (
                    <motion.div key="devices" className="h-full flex min-h-0" {...fadeView}>
                      <Sidebar
                        apkInfo={apkInfo}
                        onSelectApk={selectApk}
                        onClearApk={clearApk}
                        onScanApk={scanFolder}
                        onSelectApkFromList={setApkFromList}
                        onOpenSettings={() => setShowSettings(true)}
                      />
                      <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar pl-4">
                        <DeviceList
                          devices={devices}
                          loading={loading}
                          error={error}
                          apkInfo={apkInfo}
                          onRefresh={refreshDevices}
                          onDeviceSelect={handleDeviceSelect}
                          onRemove={removeDevice}
                          onAddDevice={() => setShowManualConnect(true)}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
