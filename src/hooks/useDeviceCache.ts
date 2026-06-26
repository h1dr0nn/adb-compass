import { deviceCacheApi } from "../stores/deviceStore";

/** Backwards-compatible accessor for the SWR device cache. */
export function useDeviceCache() {
  return deviceCacheApi;
}
