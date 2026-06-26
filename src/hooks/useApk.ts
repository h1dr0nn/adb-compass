import { useApkStore } from "../stores/apkStore";

/** Backwards-compatible accessor for APK state, now backed by Zustand. */
export function useApk() {
  return useApkStore();
}
