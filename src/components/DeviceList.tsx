// DeviceList Component - Displays connected Android devices
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { DeviceInfo, ApkInfo } from '../types';
import { getDeviceStatusText } from '../types';
import { RequirementChecklist } from './RequirementChecklist';
import { InstallButton } from './InstallButton';
import { useLanguage } from '../contexts/LanguageContext';

interface DeviceListProps {
    devices: DeviceInfo[];
    loading: boolean;
    error: string | null;
    apkInfo: ApkInfo | null;
    onRefresh: () => void;
}

export function DeviceList({ devices, loading, error, apkInfo, onRefresh }: DeviceListProps) {
    const prevDevicesRef = useRef<DeviceInfo[]>([]);
    const { t } = useLanguage();

    useEffect(() => {
        const prevIds = new Set(prevDevicesRef.current.map(d => d.id));
        const currentIds = new Set(devices.map(d => d.id));

        devices.forEach(device => {
            if (!prevIds.has(device.id)) {
                toast.success(t.deviceConnected, { description: device.model || device.id });
            }
        });

        prevDevicesRef.current.forEach(device => {
            if (!currentIds.has(device.id)) {
                toast.info(t.deviceDisconnected, { description: device.model || device.id });
            }
        });

        prevDevicesRef.current = devices;
    }, [devices, t]);

    if (error) {
        return (
            <div>
                <motion.div
                    className="flex flex-col items-center justify-center py-16 text-error"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    <AlertTriangle size={64} className="mb-4 opacity-50" />
                    <h3 className="text-xl font-semibold mb-2">{t.connectionError}</h3>
                    <p className="text-text-secondary">{error}</p>
                    <button
                        onClick={onRefresh}
                        className="mt-4 px-4 py-2 bg-surface-elevated hover:bg-surface-card rounded-lg border border-border transition-colors text-sm font-medium"
                    >
                        Retry
                    </button>
                </motion.div>
            </div>
        );
    }

    if (loading && devices.length === 0) {
        return (
            <div>
                <motion.div
                    className="flex flex-col items-center justify-center py-16 text-text-secondary"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    <Loader2 size={48} className="animate-spin mb-4 text-accent" />
                    <p>{t.searching}</p>
                </motion.div>
            </div>
        );
    }

    if (devices.length === 0) {
        return (
            <div>
                <motion.div
                    className="flex flex-col items-center justify-center py-16"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <Smartphone size={64} className="mb-4 text-text-muted opacity-50" />
                    <h3 className="text-xl font-semibold text-text-primary mb-2">{t.noDevices}</h3>
                    <p className="text-text-secondary mb-6">{t.connectDevices}</p>
                    <div className="space-y-3 text-left max-w-md">
                        {[
                            t.hint1,
                            t.hint2,
                            t.hint3,
                            t.hint4,
                        ].map((hint, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-sm font-semibold flex items-center justify-center">
                                    {i + 1}
                                </span>
                                <span className="text-text-secondary text-sm">{hint}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div>
            <motion.div
                className="flex items-center justify-between mb-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            >
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-text-primary">{t.connectedDevices}</h2>
                    <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-sm font-semibold flex items-center justify-center">
                        {devices.length}
                    </span>
                </div>

                <button
                    onClick={onRefresh}
                    className="p-2 bg-surface-elevated border border-border text-text-secondary hover:text-accent hover:border-accent rounded-lg transition-all"
                    title="Refresh Devices"
                    disabled={loading}
                >
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
                <AnimatePresence mode="popLayout">
                    {devices.map((device) => (
                        <DeviceCard key={device.id} device={device} apkInfo={apkInfo} />
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}

interface DeviceCardProps {
    device: DeviceInfo;
    apkInfo: ApkInfo | null;
}

function DeviceCard({ device, apkInfo }: DeviceCardProps) {
    const statusText = getDeviceStatusText(device.status);
    const { t } = useLanguage();

    const getStatusColor = () => {
        switch (device.status) {
            case 'Device': return 'text-success bg-success/10';
            case 'Unauthorized': return 'text-warning bg-warning/10';
            default: return 'text-error bg-error/10';
        }
    };

    // Helper to translate status text if possible, though status is usually technical enum
    const displayStatus =
        device.status === 'Device' ? t.ready :
            device.status === 'Unauthorized' ? t.unauthorized :
                device.status === 'Offline' ? t.offline : statusText;

    return (
        <motion.div
            className="bg-surface-card border border-border rounded-2xl p-5 
                       hover:border-accent hover:-translate-y-1 hover:shadow-xl
                       transition-all duration-300"
            layout
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            transition={{ duration: 0.3, layout: { duration: 0.3 } }}
        >
            {/* Row 1: Icon + Device Info + Status */}
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-surface-elevated flex items-center justify-center text-accent">
                    <Smartphone size={28} />
                </div>
                <div className="flex-1">
                    <h3 className="text-base font-semibold text-text-primary">
                        {device.model || device.product || 'Android Device'}
                    </h3>
                    <p className="text-xs text-text-muted font-mono">{device.id}</p>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${getStatusColor()}`}>
                    <span className="w-2 h-2 rounded-full bg-current"></span>
                    <span>{displayStatus}</span>
                </div>
            </div>

            {/* Row 3: Warnings, Requirements, Install */}
            {device.status === 'Unauthorized' && (
                <motion.div
                    className="flex items-center gap-2 mt-3 px-3 py-2 bg-warning/10 text-warning rounded-lg text-sm"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                >
                    <AlertTriangle size={16} />
                    <span>Please accept the USB debugging prompt on your device</span>
                </motion.div>
            )}

            {device.status === 'Device' && (
                <RequirementChecklist deviceId={device.id} isAuthorized={true} />
            )}

            {device.status === 'Device' && apkInfo && (
                <div className="mt-3 pt-3 border-t border-border">
                    <InstallButton deviceId={device.id} apkPath={apkInfo.path} />
                </div>
            )}
        </motion.div>
    );
}
