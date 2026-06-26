import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import * as tauri from "../lib/tauri";
import type { AdbStatus, DeviceInfo } from "../types";

const STORAGE_KEY = "adb-compass-devices";

function loadPersisted(): DeviceInfo[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as DeviceInfo[];
  } catch (e) {
    console.error("Failed to load devices from storage", e);
  }
  return [];
}

function persist(devices: DeviceInfo[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
}

/** Merge a fresh ADB list into the known list: fresh devices win, missing
 * ones are kept but marked Offline (preserving model/product). */
function mergeLists(
  prev: DeviceInfo[],
  fresh: DeviceInfo[],
): DeviceInfo[] {
  const freshMap = new Map(fresh.map((d) => [d.id, d]));
  const merged: DeviceInfo[] = [];

  prev.forEach((p) => {
    const f = freshMap.get(p.id);
    if (f) {
      merged.push(f);
      freshMap.delete(p.id);
    } else {
      merged.push({ ...p, status: "Offline" });
    }
  });

  freshMap.forEach((d) => merged.push(d));
  return merged;
}

interface DeviceState {
  devices: DeviceInfo[];
  adbStatus: AdbStatus | null;
  loading: boolean;
  error: string | null;
  /** Globally selected device id (driven by the header DevicePicker). */
  selectedDeviceId: string | null;
  mergeDevices: (fresh: DeviceInfo[]) => void;
  checkAdb: () => Promise<AdbStatus | null>;
  refreshDevices: () => Promise<void>;
  removeDevice: (deviceId: string) => void;
  addManualDevice: (ip: string) => void;
  setSelectedDevice: (deviceId: string | null) => void;
  clearCache: (keyPrefix?: string) => void;
  /** Ensure a sensible selection: keep current if still authorized,
   * otherwise fall back to the first authorized device (or null). */
  ensureSelection: () => void;
}

export const useDeviceStore = create<DeviceState>()(
  immer((set, get) => ({
    devices: loadPersisted(),
    adbStatus: null,
    loading: true,
    error: null,
    selectedDeviceId: null,

    mergeDevices: (fresh) => {
      set((s) => {
        s.devices = mergeLists(s.devices, fresh);
      });
      persist(get().devices);
    },

    checkAdb: async () => {
      try {
        const status = await tauri.checkAdbStatus();
        set((s) => {
          s.adbStatus = status;
        });
        return status;
      } catch (err) {
        console.error("Failed to check ADB status", err);
        return null;
      }
    },

    refreshDevices: async () => {
      set((s) => {
        s.loading = true;
      });
      const startTime = Date.now();
      try {
        const fresh = await tauri.refreshDevices();
        get().mergeDevices(fresh);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to get devices";
        set((s) => {
          s.error = message;
        });
      } finally {
        // Keep the refresh animation visible for at least 500ms.
        const elapsed = Date.now() - startTime;
        if (elapsed < 500) {
          await new Promise((r) => setTimeout(r, 500 - elapsed));
        }
        set((s) => {
          s.loading = false;
        });
      }
    },

    removeDevice: (deviceId) => {
      set((s) => {
        s.devices = s.devices.filter((d) => d.id !== deviceId);
      });
      get().clearCache(deviceId);
      persist(get().devices);
    },

    addManualDevice: (ip) => {
      set((s) => {
        if (s.devices.find((d) => d.id === ip)) return;
        s.devices.push({
          id: ip,
          status: "Offline",
          model: "Connecting...",
          product: ip,
        });
      });
      persist(get().devices);
    },

    setSelectedDevice: (deviceId) => {
      set((s) => {
        s.selectedDeviceId = deviceId;
      });
    },

    clearCache: (keyPrefix) => {
      deviceCacheApi.clearCache(keyPrefix);
    },

    ensureSelection: () => {
      set((s) => {
        const current = s.devices.find((d) => d.id === s.selectedDeviceId);
        if (current && current.status === "Device") return;
        const firstAuthorized = s.devices.find((d) => d.status === "Device");
        s.selectedDeviceId = firstAuthorized ? firstAuthorized.id : null;
      });
    },
  })),
);

// ───────────── Stale-While-Revalidate cache (module-scoped) ─────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const DEFAULT_STALE_TIME = 5 * 60 * 1000;
const deviceCache = new Map<string, CacheEntry<unknown>>();

export const deviceCacheApi = {
  getData: <T,>(key: string): T | null => {
    const entry = deviceCache.get(key);
    return entry ? (entry.data as T) : null;
  },
  setData: <T,>(key: string, data: T): void => {
    deviceCache.set(key, { data, timestamp: Date.now() });
  },
  getCached: <T,>(
    key: string,
    maxAge: number = DEFAULT_STALE_TIME,
  ): { data: T | null; isStale: boolean } => {
    const entry = deviceCache.get(key);
    if (!entry) return { data: null, isStale: true };
    const isStale = Date.now() - entry.timestamp > maxAge;
    return { data: entry.data as T, isStale };
  },
  clearCache: (keyPrefix?: string): void => {
    if (!keyPrefix) {
      deviceCache.clear();
      return;
    }
    for (const key of deviceCache.keys()) {
      if (key.startsWith(keyPrefix)) deviceCache.delete(key);
    }
  },
};
