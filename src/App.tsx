// ADB Compass - Main Application
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Settings as SettingsIcon } from 'lucide-react';
import { Toaster } from 'sonner';
import { useDevices } from './hooks/useDevices';
import { useApk } from './hooks/useApk';
import { StatusBar } from './components/StatusBar';
import { DeviceList } from './components/DeviceList';
import { ApkDropzone } from './components/ApkDropzone';
import { Settings } from './components/Settings';
import { useLanguage } from './contexts/LanguageContext';
import { useTheme } from './contexts/ThemeContext';

function App() {
  const { devices, adbStatus, loading, error, refreshDevices } = useDevices();
  const { apkInfo, selectApk, clearApk } = useApk();
  const [showSettings, setShowSettings] = useState(false);
  const { t } = useLanguage();
  const { resolvedTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col bg-surface-bg text-text-primary font-sans transition-colors duration-300">
      <Toaster
        position="bottom-right"
        theme={resolvedTheme}
        toastOptions={{
          style: {
            background: 'var(--color-surface-card)', // fallback if sonner internal theme doesn't match perfectly
          },
          className: 'bg-surface-card border border-border text-text-primary'
        }}
      />

      {/* Header - Full Width */}
      <motion.header
        className="sticky top-0 z-50 w-full backdrop-blur-md bg-surface-bg/80 border-b border-border px-6 py-4"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-accent-secondary flex items-center justify-center text-white shadow-lg shadow-accent/20">
              <Globe size={28} strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text-primary leading-tight">{t.appName}</h1>
              <span className="text-xs text-text-muted font-mono">{t.version}</span>
            </div>
          </div>

          {!showSettings && (
            <button
              onClick={() => setShowSettings(true)}
              className="p-2.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-all duration-200"
              title={t.settings}
            >
              <SettingsIcon size={24} />
            </button>
          )}
        </div>
      </motion.header>

      <AnimatePresence mode="wait">
        {showSettings ? (
          <main key="settings" className="flex-1 overflow-hidden bg-surface-bg">
            <Settings onBack={() => setShowSettings(false)} />
          </main>
        ) : (
          <motion.div
            key="main"
            className="flex-1 flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <StatusBar
              adbStatus={adbStatus}
              loading={loading}
              onRefresh={refreshDevices}
            />

            <ApkDropzone
              apkInfo={apkInfo}
              onApkSelected={selectApk}
              onApkClear={clearApk}
            />

            {/* Main Content - Flex Grow */}
            <main className="flex-1 px-6 py-6 scroll-smooth">
              <DeviceList
                devices={devices}
                loading={loading}
                error={error}
                apkInfo={apkInfo}
              />
            </main>

            {/* Footer - Fixed at Bottom */}
            <motion.footer
              className="w-full py-4 text-center text-text-muted text-sm border-t border-border bg-surface-bg"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <p>{apkInfo ? t.selectDeviceToInstall : t.connectDevices}</p>
            </motion.footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
