import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist } from "zustand/middleware";
import * as tauri from "../lib/tauri";
import type { ApkInfo } from "../types";

interface ApkState {
  apkInfo: ApkInfo | null;
  folderPath: string | null;
  scannedApks: ApkInfo[];
  manualApks: ApkInfo[];
  folderHistory: string[];
  loading: boolean;
  error: string | null;
  selectApk: (path: string) => Promise<void>;
  clearApk: () => void;
  scanFolder: (path: string) => Promise<ApkInfo[]>;
  setApkFromList: (info: ApkInfo) => void;
  setScannedApks: (apks: ApkInfo[]) => void;
  setManualApks: (apks: ApkInfo[]) => void;
  removeFromHistory: (path: string) => void;
  clearAll: () => void;
}

export const useApkStore = create<ApkState>()(
  persist(
    immer((set) => ({
      apkInfo: null,
      folderPath: null,
      scannedApks: [],
      manualApks: [],
      folderHistory: [],
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
              if (info.valid) {
                s.apkInfo = info;
                // Add to manual list if it's not in the scanned list
                if (!s.manualApks.some((a) => a.path === path) && !s.scannedApks.some((a) => a.path === path)) {
                  s.manualApks.push(info);
                }
              } else {
                s.error = "Invalid APK file";
              }
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
          const apks = await tauri.scanApksInFolder(path);
          set((s) => {
            s.scannedApks = apks;
            s.folderPath = path;
            if (!s.folderHistory.includes(path)) {
              s.folderHistory.push(path);
            }
          });
          return apks;
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

      setScannedApks: (apks) => {
        set((s) => {
          s.scannedApks = apks;
        });
      },

      setManualApks: (apks) => {
        set((s) => {
          s.manualApks = apks;
        });
      },

      removeFromHistory: (path) => {
        set((s) => {
          s.folderHistory = s.folderHistory.filter((p) => p !== path);
          if (s.folderPath === path) {
            s.folderPath = null;
            s.scannedApks = [];
          }
        });
      },

      clearAll: () => {
        set((s) => {
          s.apkInfo = null;
          s.folderPath = null;
          s.scannedApks = [];
          s.manualApks = [];
          s.error = null;
        });
      },
    })),
    {
      name: "adb-compass-apk-storage",
      partialize: (state) => ({
        apkInfo: state.apkInfo,
        folderPath: state.folderPath,
        scannedApks: state.scannedApks,
        manualApks: state.manualApks,
        folderHistory: state.folderHistory,
      }),
    }
  )
);
