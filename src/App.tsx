import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe } from 'lucide-react';
import { Toaster } from 'sonner';
import { useDevices } from './hooks/useDevices';
import { useApk } from './hooks/useApk';
import { Sidebar } from './components/Sidebar';
import { DeviceList } from './components/DeviceList';
import { Settings } from './components/Settings';
import { useLanguage } from './contexts/LanguageContext';
import { useTheme } from './contexts/ThemeContext';

function App() {
  const { devices, adbStatus, loading, error, refreshDevices } = useDevices();
  const { apkInfo, selectApk, clearApk, scanFolder, setApkFromList } = useApk();
  const [showSettings, setShowSettings] = useState(false);
  const { t } = useLanguage();
  const { resolvedTheme } = useTheme();

  return (
    <div className="flex flex-col h-screen bg-surface-bg text-text-primary font-sans transition-colors duration-300 overflow-hidden">
      <Toaster
        position="bottom-right"
        theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
        toastOptions={{
          className: 'bg-surface-card border border-border text-text-primary shadow-xl',
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
            <div className="mt-1">
              <h1 className="text-xl font-bold text-text-primary leading-tight">{t.appName}</h1>
              <span className="text-xs text-text-muted font-mono">{t.version}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* ADB Status in Header */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${adbStatus?.available ? 'bg-success/10 border-success/20' : 'bg-error/10 border-error/20'}`}>
              <div className={`w-2 h-2 rounded-full ${adbStatus?.available ? 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-error'}`} />
              <span className="text-sm font-medium text-text-primary">
                {adbStatus?.available ? (adbStatus.version || 'ADB Ready') : 'ADB Not Found'}
              </span>
            </div>


          </div>
        </div>
      </motion.header>

      <div className="flex-1 flex min-h-0">
        {/* Sidebar - Fixed Left */}
        <Sidebar
          apkInfo={apkInfo}
          onSelectApk={selectApk}
          onClearApk={clearApk}
          onScanApk={scanFolder}
          onSelectApkFromList={setApkFromList}
          onOpenSettings={() => setShowSettings(true)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Dynamic Content */}
          <div className="flex-1 overflow-hidden relative px-8 py-6">
            <AnimatePresence mode="wait">
              {showSettings ? (
                <motion.div
                  key="settings"
                  className="h-full"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <Settings onBack={() => setShowSettings(false)} />
                </motion.div>
              ) : (
                <motion.div
                  key="main"
                  className="h-full flex flex-col"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex-1 overflow-y-auto pr-2">
                    <DeviceList
                      devices={devices}
                      loading={loading}
                      error={error}
                      apkInfo={apkInfo}
                      onRefresh={refreshDevices}
                    />
                  </div>

                  {/* Footer Hint */}
                  <div className="mt-4 text-center text-text-muted text-sm">
                    <p>{apkInfo ? t.selectDeviceToInstall : t.connectDevices}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
