// Device Overview Tab - Shows device information with live data
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Smartphone, Cpu, HardDrive, Battery, BatteryCharging,
    Wifi, Signal, Monitor, MemoryStick, Loader2, Building2,
    Shield, Hash
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { DeviceInfo, getDeviceStatusText } from '../../types';
import { listContainer, listItem } from '../../lib/animations';

interface DeviceOverviewProps {
    device: DeviceInfo;
}

interface DeviceProps {
    model: string;
    android_version: string;
    sdk_version: string;
    battery_level: number | null;
    is_charging: boolean;
    screen_resolution: string | null;
    storage_total: string | null;
    storage_free: string | null;
    ram_total: string | null;
    manufacturer: string | null;
    cpu: string | null;
    build_number: string | null;
    security_patch: string | null;
}

interface InfoCardProps {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    loading?: boolean;
}

function InfoCard({ icon, label, value, loading }: InfoCardProps) {
    return (
        <motion.div
            variants={listItem}
            className="bg-surface-card border border-border rounded-xl p-4 hover:border-accent/30 transition-colors"
        >
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    {icon}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-xs text-text-muted uppercase tracking-wide mb-1">{label}</p>
                    {loading ? (
                        <div className="flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin text-accent" />
                            <span className="text-sm text-text-muted">Loading...</span>
                        </div>
                    ) : (
                        <p className="text-sm font-semibold text-text-primary truncate">
                            {value || 'Unknown'}
                        </p>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

// Helper component for value with secondary text
function ValueWithSub({ main, sub }: { main: string | null | undefined; sub?: string | null }) {
    if (!main) return <>Unknown</>;
    return (
        <>
            {main}
            {sub && <span className="text-text-secondary font-normal"> ({sub})</span>}
        </>
    );
}

export function DeviceOverview({ device }: DeviceOverviewProps) {
    const [props, setProps] = useState<DeviceProps | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProps = async () => {
            setLoading(true);
            try {
                const result = await invoke<DeviceProps>('get_device_props', { deviceId: device.id });
                setProps(result);
            } catch (e) {
                console.error('Failed to fetch device props:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchProps();
    }, [device.id]);

    const getBatteryIcon = () => {
        if (props?.is_charging) {
            return <BatteryCharging className="text-accent" size={20} />;
        }
        return <Battery className="text-accent" size={20} />;
    };

    return (
        <div className="h-full overflow-hidden">
            <div className="h-full overflow-y-auto custom-scrollbar pr-2">
                <motion.div
                    variants={listContainer}
                    initial="initial"
                    animate="animate"
                    className="grid grid-cols-2 lg:grid-cols-3 gap-4"
                >
                    {/* Row 1: Identity */}
                    <InfoCard
                        icon={<Smartphone className="text-accent" size={20} />}
                        label="Device ID"
                        value={device.id}
                    />

                    <InfoCard
                        icon={<Building2 className="text-accent" size={20} />}
                        label="Manufacturer"
                        value={props?.manufacturer}
                        loading={loading}
                    />

                    <InfoCard
                        icon={<Cpu className="text-accent" size={20} />}
                        label="Model"
                        value={
                            <ValueWithSub
                                main={props?.model || device.model}
                                sub={props?.android_version ? `Android ${props.android_version}` : null}
                            />
                        }
                        loading={loading}
                    />

                    {/* Row 2: Hardware */}
                    <InfoCard
                        icon={<Monitor className="text-accent" size={20} />}
                        label="Screen"
                        value={props?.screen_resolution}
                        loading={loading}
                    />

                    <InfoCard
                        icon={<HardDrive className="text-accent" size={20} />}
                        label="Storage"
                        value={
                            <ValueWithSub
                                main={props?.storage_total}
                                sub={props?.storage_free ? `${props.storage_free} free` : null}
                            />
                        }
                        loading={loading}
                    />

                    <InfoCard
                        icon={<MemoryStick className="text-accent" size={20} />}
                        label="RAM"
                        value={props?.ram_total}
                        loading={loading}
                    />

                    {/* Row 3: System */}
                    <InfoCard
                        icon={<Cpu className="text-accent" size={20} />}
                        label="Chipset"
                        value={props?.cpu}
                        loading={loading}
                    />

                    <InfoCard
                        icon={getBatteryIcon()}
                        label="Battery"
                        value={
                            <ValueWithSub
                                main={props?.battery_level !== null && props?.battery_level !== undefined
                                    ? `${props.battery_level}%`
                                    : null}
                                sub={props?.is_charging ? 'Charging' : null}
                            />
                        }
                        loading={loading}
                    />

                    <InfoCard
                        icon={<Hash className="text-accent" size={20} />}
                        label="Build"
                        value={props?.build_number}
                        loading={loading}
                    />

                    {/* Row 4: Security & Connection */}
                    <InfoCard
                        icon={<Shield className="text-accent" size={20} />}
                        label="Security Patch"
                        value={props?.security_patch}
                        loading={loading}
                    />

                    <InfoCard
                        icon={<Signal className="text-accent" size={20} />}
                        label="Connection"
                        value={device.id.includes(':') ? 'Wireless' : 'USB'}
                    />

                    <InfoCard
                        icon={<Wifi className="text-accent" size={20} />}
                        label="Status"
                        value={getDeviceStatusText(device.status)}
                    />
                </motion.div>
            </div>
        </div>
    );
}
