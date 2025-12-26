// Hook for managing device state
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { DeviceInfo, AdbStatus } from '../types';

interface DeviceChangedPayload {
    devices: DeviceInfo[];
}

interface UseDevicesReturn {
    devices: DeviceInfo[];
    adbStatus: AdbStatus | null;
    loading: boolean;
    error: string | null;
    refreshDevices: () => Promise<void>;
    checkAdb: () => Promise<void>;
}

export function useDevices(): UseDevicesReturn {
    const [devices, setDevices] = useState<DeviceInfo[]>([]);
    const [adbStatus, setAdbStatus] = useState<AdbStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const checkAdb = useCallback(async () => {
        try {
            const status = await invoke<AdbStatus>('check_adb_status');
            setAdbStatus(status);
            return status;
        } catch (err) {
            setError('Failed to check ADB status');
            return null;
        }
    }, []);

    const refreshDevices = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const deviceList = await invoke<DeviceInfo[]>('refresh_devices');
            setDevices(deviceList);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to get devices';
            setError(errorMessage);
            setDevices([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        const init = async () => {
            await checkAdb();
            await refreshDevices();
        };
        init();
    }, [checkAdb, refreshDevices]);

    // Listen for real-time device changes from backend
    useEffect(() => {
        const unlisten = listen<DeviceChangedPayload>('device-changed', (event) => {
            setDevices(event.payload.devices);
            setLoading(false);
        });

        return () => {
            unlisten.then(fn => fn());
        };
    }, []);

    // Backup polling every 10 seconds (reduced from 3s since we have real-time events)
    useEffect(() => {
        const interval = setInterval(() => {
            refreshDevices();
        }, 10000);

        return () => clearInterval(interval);
    }, [refreshDevices]);

    return {
        devices,
        adbStatus,
        loading,
        error,
        refreshDevices,
        checkAdb,
    };
}

