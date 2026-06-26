import { useDeviceStore } from "../stores/deviceStore";

/** Backwards-compatible accessor for device state, now backed by Zustand. */
export function useDevices() {
  return useDeviceStore();
}
