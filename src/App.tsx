// ADB Compass - Main Application
import { useDevices } from './hooks/useDevices';
import { StatusBar } from './components/StatusBar';
import { DeviceList } from './components/DeviceList';
import './App.css';

function App() {
  const { devices, adbStatus, loading, error, refreshDevices } = useDevices();

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </div>
            <div className="logo-text">
              <h1>ADB Compass</h1>
              <span className="version">v0.1.0</span>
            </div>
          </div>
        </div>
      </header>

      <StatusBar
        adbStatus={adbStatus}
        loading={loading}
        onRefresh={refreshDevices}
      />

      <main className="app-main">
        <DeviceList
          devices={devices}
          loading={loading}
          error={error}
        />
      </main>

      <footer className="app-footer">
        <p>Connect Android devices to get started</p>
      </footer>
    </div>
  );
}

export default App;
