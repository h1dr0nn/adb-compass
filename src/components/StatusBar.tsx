// StatusBar Component - Shows ADB status and quick actions
import type { AdbStatus } from '../types';
import './StatusBar.css';

interface StatusBarProps {
    adbStatus: AdbStatus | null;
    loading: boolean;
    onRefresh: () => void;
}

export function StatusBar({ adbStatus, loading, onRefresh }: StatusBarProps) {
    const getStatusIcon = () => {
        if (!adbStatus) return '○';
        return adbStatus.available ? '●' : '○';
    };

    const getStatusClass = () => {
        if (!adbStatus) return 'status-unknown';
        return adbStatus.available ? 'status-ok' : 'status-error';
    };

    return (
        <div className="status-bar">
            <div className="status-left">
                <span className={`status-indicator ${getStatusClass()}`}>
                    {getStatusIcon()}
                </span>
                <span className="status-text">
                    {!adbStatus ? 'Checking ADB...' :
                        adbStatus.available
                            ? adbStatus.version || 'ADB Ready'
                            : 'ADB Not Found'}
                </span>
            </div>

            <div className="status-right">
                <button
                    className={`refresh-btn ${loading ? 'loading' : ''}`}
                    onClick={onRefresh}
                    disabled={loading}
                    title="Refresh devices"
                >
                    <svg
                        className="refresh-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
