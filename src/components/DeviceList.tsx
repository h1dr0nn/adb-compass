// DeviceList Component - Displays connected Android devices
import type { DeviceInfo } from '../types';
import { getDeviceStatusText, getStatusColorClass } from '../types';
import './DeviceList.css';

interface DeviceListProps {
    devices: DeviceInfo[];
    loading: boolean;
    error: string | null;
}

export function DeviceList({ devices, loading, error }: DeviceListProps) {
    if (error) {
        return (
            <div className="device-list">
                <div className="error-state">
                    <div className="error-icon">⚠</div>
                    <h3>Connection Error</h3>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    if (loading && devices.length === 0) {
        return (
            <div className="device-list">
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Searching for devices...</p>
                </div>
            </div>
        );
    }

    if (devices.length === 0) {
        return (
            <div className="device-list">
                <div className="empty-state">
                    <div className="empty-icon">📱</div>
                    <h3>No Devices Found</h3>
                    <p>Connect an Android device via USB and enable USB Debugging</p>
                    <div className="hint-list">
                        <div className="hint-item">
                            <span className="hint-number">1</span>
                            <span>Enable Developer Options on your device</span>
                        </div>
                        <div className="hint-item">
                            <span className="hint-number">2</span>
                            <span>Turn on USB Debugging</span>
                        </div>
                        <div className="hint-item">
                            <span className="hint-number">3</span>
                            <span>Connect device via USB cable</span>
                        </div>
                        <div className="hint-item">
                            <span className="hint-number">4</span>
                            <span>Accept the debugging prompt on device</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="device-list">
            <div className="device-list-header">
                <h2>Connected Devices</h2>
                <span className="device-count">{devices.length}</span>
            </div>

            <div className="device-grid">
                {devices.map((device) => (
                    <DeviceCard key={device.id} device={device} />
                ))}
            </div>
        </div>
    );
}

interface DeviceCardProps {
    device: DeviceInfo;
}

function DeviceCard({ device }: DeviceCardProps) {
    const statusText = getDeviceStatusText(device.status);
    const statusClass = getStatusColorClass(device.status);

    return (
        <div className={`device-card ${statusClass}`}>
            <div className="device-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="5" y="2" width="14" height="20" rx="2" />
                    <line x1="12" y1="18" x2="12" y2="18.01" strokeWidth="2" strokeLinecap="round" />
                </svg>
            </div>

            <div className="device-info">
                <h3 className="device-model">
                    {device.model || device.product || 'Android Device'}
                </h3>
                <p className="device-id">{device.id}</p>
            </div>

            <div className={`device-status ${statusClass}`}>
                <span className="status-dot"></span>
                <span className="status-label">{statusText}</span>
            </div>

            {device.status === 'Unauthorized' && (
                <div className="device-warning">
                    Please accept the USB debugging prompt on your device
                </div>
            )}
        </div>
    );
}
