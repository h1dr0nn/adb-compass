import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import * as tauri from "../lib/tauri";
import type { ApkInfo } from "../types";

interface ApkState {
  apkInfo: ApkInfo | null;
  loading: boolean;
  error: string | null;
  selectApk: (path: string) => Promise<void>;
  clearApk: () => void;
  scanFolder: (path: string) => Promise<ApkInfo[]>;
  setApkFromList: (info: ApkInfo) => void;
}

export const useApkStore = create<ApkState>()(
  immer((set) => ({
    apkInfo: null,
    loading: false,
    error: null,

    selectApk: async (path) => {
      set((s) => {
        s.loading = true;
        s.error = null;
      });
      try {
        const info = await tauri.validateApk(path);
        set((s) => {
          if (info) {
            if (info.valid) s.apkInfo = info;
            else s.error = "Invalid APK file";
          } else {
            s.error = "File not found";
          }
        });
      } catch {
        set((s) => {
          s.error = "Failed to validate APK";
        });
      } finally {
        set((s) => {
          s.loading = false;
        });
      }
    },

    scanFolder: async (path) => {
      set((s) => {
        s.loading = true;
        s.error = null;
      });
      try {
        return await tauri.scanApksInFolder(path);
      } catch {
        set((s) => {
          s.error = "Failed to scan folder";
        });
        return [];
      } finally {
        set((s) => {
          s.loading = false;
        });
      }
    },

    clearApk: () => {
      set((s) => {
        s.apkInfo = null;
        s.error = null;
      });
    },

    setApkFromList: (info) => {
      set((s) => {
        s.apkInfo = info;
        s.error = null;
      });
    },
  })),
);
