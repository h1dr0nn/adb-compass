import React, { createContext, useContext, useRef, useCallback } from 'react';

// Cache entry with generic data and timestamp
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

interface DeviceCacheContextType {
    getData: <T>(key: string) => T | null;
    setData: <T>(key: string, data: T) => void;
    clearCache: (keyPrefix?: string) => void;
    // Helper for Stale-While-Revalidate pattern
    // returns cached data (if any) and a flag indicating if it's stale
    getCached: <T>(key: string, maxAge?: number) => { data: T | null; isStale: boolean };
}

const DeviceCacheContext = createContext<DeviceCacheContextType | undefined>(undefined);

// Default stale time: 5 minutes
const DEFAULT_STALE_TIME = 5 * 60 * 1000;

export function DeviceCacheProvider({ children }: { children: React.ReactNode }) {
    const cache = useRef<Map<string, CacheEntry<any>>>(new Map());

    const getData = useCallback(<T,>(key: string): T | null => {
        const entry = cache.current.get(key);
        return entry ? (entry.data as T) : null;
    }, []);

    const setData = useCallback(<T,>(key: string, data: T) => {
        cache.current.set(key, {
            data,
            timestamp: Date.now(),
        });
    }, []);

    const getCached = useCallback(<T,>(key: string, maxAge: number = DEFAULT_STALE_TIME) => {
        const entry = cache.current.get(key);
        if (!entry) {
            return { data: null, isStale: true };
        }

        const age = Date.now() - entry.timestamp;
        const isStale = age > maxAge;

        return { data: entry.data as T, isStale };
    }, []);

    const clearCache = useCallback((keyPrefix?: string) => {
        if (!keyPrefix) {
            cache.current.clear();
            return;
        }

        // Delete keys starting with prefix
        for (const key of cache.current.keys()) {
            if (key.startsWith(keyPrefix)) {
                cache.current.delete(key);
            }
        }
    }, []);

    return (
        <DeviceCacheContext.Provider value={{ getData, setData, clearCache, getCached }}>
            {children}
        </DeviceCacheContext.Provider>
    );
}

export function useDeviceCache() {
    const context = useContext(DeviceCacheContext);
    if (context === undefined) {
        throw new Error('useDeviceCache must be used within a DeviceCacheProvider');
    }
    return context;
}
