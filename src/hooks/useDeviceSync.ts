import { useEffect, useRef } from "react";
import { appToast } from "../components/ui/AppToast";
import { useDeviceStore } from "../stores/deviceStore";
import { useLangStore } from "../stores/langStore";
import * as tauri from "../lib/tauri";
import type { DeviceInfo } from "../types";

const RECONNECT_INTERVAL_MS = 15000;

/** Owns device-list side effects: initial load, backend event subscription,
 * background reconnection of offline wireless devices, and connect/disconnect
 * toasts. Mount once at the app root. */
export function useDeviceSync(): void {
  const devices = useDeviceStore((s) => s.devices);
  const prevDevicesRef = useRef<DeviceInfo[]>(devices);
  const isReconnectingRef = useRef(false);

  // Connect / disconnect toasts on device-list changes.
  useEffect(() => {
    const { t } = useLangStore.getState();
    const prevConnected = new Set(
      prevDevicesRef.current.filter((d) => d.status === "Device").map((d) => d.id),
    );
    const currentConnected = new Set(
      devices.filter((d) => d.status === "Device").map((d) => d.id),
    );

    devices.forEach((d) => {
      if (d.status === "Device" && !prevConnected.has(d.id)) {
        appToast({ title: t.toastDevice, description: `${d.model || d.id}: ${t.msgConnected}`, variant: "success" });
      }
    });
    prevDevicesRef.current.forEach((prev) => {
      if (prev.status === "Device" && !currentConnected.has(prev.id)) {
        appToast({ title: t.toastDevice, description: `${prev.model || prev.id}: ${t.msgDisconnected}`, variant: "info" });
      }
    });

    prevDevicesRef.current = devices;

    // Keep the global device selection valid as devices come and go.
    useDeviceStore.getState().ensureSelection();
  }, [devices]);

  // Initial load + backend event subscription.
  useEffect(() => {
    const store = useDeviceStore.getState();
    store.checkAdb();
    // Light initial list: the Rust setup already started a single clean daemon,
    // so just read it. The manual Refresh button (refreshDevices) is the heavy
    // recovery path that bounces the daemon — don't bounce on every boot.
    tauri
      .getDevices()
      .then((d) => useDeviceStore.getState().mergeDevices(d))
      .catch(() => {});

    const unlistenPromise = tauri.onDeviceChanged((fresh) => {
      useDeviceStore.getState().mergeDevices(fresh);
    });

    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, []);

  // Background reconnect for offline wireless devices.
  useEffect(() => {
    const reconnect = async () => {
      if (isReconnectingRef.current) return;

      const offlineWireless = useDeviceStore
        .getState()
        .devices.filter(
          (d) =>
            d.status === "Offline" && d.id.includes(".") && d.id.includes(":"),
        );
      if (offlineWireless.length === 0) return;

      isReconnectingRef.current = true;
      try {
        await Promise.all(
          offlineWireless.map(async (device) => {
            try {
              const [ip, port] = device.id.split(":");
              await tauri.connectWireless(ip, port || "5555");
            } catch {
              // Ignore background reconnection errors.
            }
          }),
        );
        const fresh = await tauri.getDevices();
        useDeviceStore.getState().mergeDevices(fresh);
      } finally {
        isReconnectingRef.current = false;
      }
    };

    const interval = setInterval(reconnect, RECONNECT_INTERVAL_MS);
    reconnect();
    return () => clearInterval(interval);
  }, []);
}
