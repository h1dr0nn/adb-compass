import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Monitor, Smartphone, AppWindow, FolderOpen, Download
} from 'lucide-react';
import * as tauri from '../lib/tauri';
import { DeviceInfo } from '../types';
import { pageTransition, tabContent } from '../lib/animations';
import { DeviceOverview } from './device/DeviceOverview';
import { ScreenCapture } from './device/ScreenCapture';
import { AppManager } from './device/AppManager';
import { FileManager } from './device/FileManager';
import { InstallButton } from './InstallButton';
import { useApkStore } from '../stores/apkStore';
import { useDeviceStatus } from '../hooks/useDeviceStatus';

// Tab definitions
type TabId = 'overview' | 'screen' | 'apps' | 'files';

interface Tab {
    id: TabId;
    label: string;
    icon: React.ReactNode;
}

interface DeviceDetailViewProps {
    device: DeviceInfo;
}

export function DeviceDetailView({ device }: DeviceDetailViewProps) {
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const apkInfo = useApkStore((s) => s.apkInfo);
    const { getStatusTranslation } = useDeviceStatus();

    const displayStatus = getStatusTranslation(device.status);

    const getStatusColor = () => {
        switch (device.status) {
            case 'Device': return 'text-success bg-success/10 border border-success/20';
            case 'Unauthorized': return 'text-warning bg-warning/10 border border-warning/20';
            case 'Offline': return 'text-text-muted bg-surface-elevated border border-border/50';
            default: return 'text-error bg-error/10 border border-error/20';
        }
    };

    // Eagerly initialize service (Agent) as soon as we enter detail view
    useEffect(() => {
        if (device.status === 'Device') {
            console.log(`[DeviceDetailView] Eagerly connecting to agent for ${device.id}...`);
            tauri.testAgentConnection(device.id)
                .then(() => console.log(`[DeviceDetailView] Agent connected for ${device.id}`))
                .catch((err) => console.error(`[DeviceDetailView] Failed to eagerly connect to agent:`, err));
        }
    }, [device.id, device.status]);

    const tabs: Tab[] = [
        { id: 'overview', label: 'Overview', icon: <Smartphone size={16} /> },
        { id: 'screen', label: 'Screen', icon: <Monitor size={16} /> },
        { id: 'apps', label: 'Apps', icon: <AppWindow size={16} /> },
        { id: 'files', label: 'Files', icon: <FolderOpen size={16} /> },
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return <DeviceOverview device={device} />;
            case 'screen':
                return <ScreenCapture device={device} />;
            case 'apps':
                return <AppManager device={device} />;
            case 'files':
                return <FileManager device={device} />;
            default:
                return null;
        }
    };

    return (
        <motion.div
            className="h-full w-full min-w-0 flex flex-col"
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-border/50">
                <div className="flex flex-col">
                    <h2 className="text-xl font-bold text-text-primary leading-tight">
                        {device.model || device.product || 'Android Device'}
                    </h2>
                    <p className="text-xs text-text-muted font-mono mt-1">
                        {device.id}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {/* Device Status Badge */}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${getStatusColor()}`}>
                        <span className="w-2 h-2 rounded-full bg-current"></span>
                        <span>{displayStatus}</span>
                    </div>

                    {/* Install button */}
                    {apkInfo && device.status === 'Device' ? (
                        <InstallButton
                            deviceId={device.id}
                            apkPath={apkInfo.path}
                        />
                    ) : (
                        <button
                            disabled
                            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-text-muted text-sm font-semibold bg-surface-elevated/50 border border-border cursor-not-allowed opacity-50 h-10"
                        >
                            <Download size={16} />
                            <span>Install</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 p-1 bg-surface-elevated rounded-xl border border-border mb-6 overflow-hidden">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === tab.id
                            ? 'text-text-primary'
                            : 'text-text-muted hover:text-text-secondary'
                            }`}
                    >
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute inset-0 bg-surface-card rounded-lg shadow-sm border border-border/50"
                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            />
                        )}
                        <span className="relative z-10">{tab.icon}</span>
                        <span className="relative z-10">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 w-full min-w-0 overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        variants={tabContent}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="h-full w-full min-w-0"
                    >
                        {renderTabContent()}
                    </motion.div>
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
