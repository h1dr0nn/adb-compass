// Centralized, type-safe Tauri IPC layer.
//
// Every backend command and event used by the frontend is wrapped here so
// components never call `invoke`/`listen` directly. One export per command,
// grouped by domain. Add new wrappers here when wiring up a feature rather
// than calling `invoke` inline.

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  AdbStatus,
  ApkInfo,
  BinaryStatus,
  DeviceInfo,
  DeviceProps,
  FileInfo,
  InstallResult,
  RequirementCheck,
} from "../types";

// ───────────────────────── Devices ─────────────────────────

export const checkAdbStatus = (): Promise<AdbStatus> =>
  invoke("check_adb_status");

export const getDevices = <T = DeviceInfo[]>(): Promise<T> =>
  invoke("get_devices");

export const getBinaries = (): Promise<BinaryStatus[]> =>
  invoke("get_binaries");

export const refreshDevices = (): Promise<DeviceInfo[]> =>
  invoke("refresh_devices");

export const getDeviceProps = <T = DeviceProps>(
  deviceId: string,
): Promise<T> => invoke("get_device_props", { deviceId });

export const testAgentConnection = (deviceId: string): Promise<unknown> =>
  invoke("test_agent_connection", { deviceId });

// ───────────────────────── APK ─────────────────────────

export const validateApk = (path: string): Promise<ApkInfo | null> =>
  invoke("validate_apk", { path });

export const scanApksInFolder = (path: string): Promise<ApkInfo[]> =>
  invoke("scan_apks_in_folder", { path });

export const installApk = (
  deviceId: string,
  apkPath: string,
): Promise<InstallResult> => invoke("install_apk", { deviceId, apkPath });

// ───────────────────────── Requirements ─────────────────────────

export const checkDeviceRequirements = (
  deviceId: string,
): Promise<RequirementCheck[]> =>
  invoke("check_device_requirements", { deviceId });

export const checkActionRequirements = (
  deviceId: string,
): Promise<RequirementCheck[]> =>
  invoke("check_action_requirements", { deviceId });

// ───────────────────────── Device Actions ─────────────────────────

export const rebootDevice = (
  deviceId: string,
  mode: string | null,
): Promise<void> => invoke("reboot_device", { deviceId, mode });

export const inputText = (deviceId: string, text: string): Promise<void> =>
  invoke("input_text", { deviceId, text });

export const inputTap = (
  deviceId: string,
  x: number,
  y: number,
): Promise<void> => invoke("input_tap", { deviceId, x, y });

// ───────────────────────── Apps ─────────────────────────

export const getAppsFull = <T>(
  deviceId: string,
  includeSystem: boolean,
): Promise<T> => invoke("get_apps_full", { deviceId, includeSystem });

export const listPackages = (
  deviceId: string,
  includeSystem: boolean,
): Promise<string[]> => invoke("list_packages", { deviceId, includeSystem });

export const uninstallApp = (
  deviceId: string,
  packageName: string,
): Promise<void> => invoke("uninstall_app", { deviceId, packageName });

// ───────────────────────── Quick Actions ─────────────────────────

export const setDarkMode = (
  deviceId: string,
  enabled: boolean,
): Promise<void> => invoke("set_dark_mode", { deviceId, enabled });

export const setShowTaps = (
  deviceId: string,
  enabled: boolean,
): Promise<void> => invoke("set_show_taps", { deviceId, enabled });

export const setAnimations = (
  deviceId: string,
  scale: number,
): Promise<void> => invoke("set_animations", { deviceId, scale });

// ───────────────────────── File Transfer ─────────────────────────

export const listFiles = (
  deviceId: string,
  path: string,
): Promise<FileInfo[]> => invoke("list_files", { deviceId, path });

export const listFilesFast = <T = FileInfo[]>(
  deviceId: string,
  path: string,
): Promise<T> => invoke("list_files_fast", { deviceId, path });

export const pushFile = (
  deviceId: string,
  localPath: string,
  remotePath: string,
): Promise<void> => invoke("push_file", { deviceId, localPath, remotePath });

export const pullFile = (
  deviceId: string,
  remotePath: string,
  localPath: string,
): Promise<void> => invoke("pull_file", { deviceId, remotePath, localPath });

export const deleteRemoteFile = (
  deviceId: string,
  remotePath: string,
): Promise<void> => invoke("delete_remote_file", { deviceId, remotePath });

export const createRemoteDirectory = (
  deviceId: string,
  remotePath: string,
): Promise<void> =>
  invoke("create_remote_directory", { deviceId, remotePath });

// ───────────────────────── Wireless ─────────────────────────

export const connectWireless = (ip: string, port: string): Promise<string> =>
  invoke("connect_wireless", { ip, port });

export const disconnectWireless = (
  ip: string,
  port: string,
): Promise<string> => invoke("disconnect_wireless", { ip, port });

export const enableTcpip = (deviceId: string, port: string): Promise<string> =>
  invoke("enable_tcpip", { deviceId, port });

export const getDeviceIp = (deviceId: string): Promise<string> =>
  invoke("get_device_ip", { deviceId });

// ───────────────────────── Shell ─────────────────────────

export const executeShell = (
  deviceId: string,
  command: string,
): Promise<string> => invoke("execute_shell", { deviceId, command });

// ───────────────────────── Logcat ─────────────────────────

export const startLogcatStream = (deviceId: string): Promise<void> =>
  invoke("start_logcat_stream", { deviceId });

export const stopLogcatStream = (deviceId: string): Promise<void> =>
  invoke("stop_logcat_stream", { deviceId });

export const getLogcat = (
  deviceId: string,
  lines: number,
  filter: string | undefined,
): Promise<string> => invoke("get_logcat", { deviceId, lines, filter });

export const clearLogcat = (deviceId: string): Promise<void> =>
  invoke("clear_logcat", { deviceId });

// ───────────────────────── Screen Capture ─────────────────────────

export const takeScreenshot = <T = CaptureResult>(args: {
  deviceId: string;
  customSavePath: string | undefined;
}): Promise<T> => invoke("take_screenshot", args);

export const startScreenRecording = (deviceId: string): Promise<void> =>
  invoke("start_screen_recording", { deviceId });

export const stopScreenRecording = <T = CaptureResult>(args: {
  deviceId: string;
  customSavePath: string | undefined;
}): Promise<T> => invoke("stop_screen_recording", args);

export const getScreenFrame = (deviceId: string): Promise<number[]> =>
  invoke("get_screen_frame", { deviceId });

export const openCapturesFolder = (
  customSavePath: string | null,
): Promise<void> => invoke("open_captures_folder", { customSavePath });

// `save_capture_file` is invoked with two distinct payload shapes (raw
// logcat export vs. base64 media capture). Keep both keys exact; the caller
// picks the return type.
type SaveCaptureFileArgs =
  | { path: string; content: string }
  | {
      dataBase64: string;
      filename: string;
      subfolder: string;
      customBasePath: string | null;
      absolutePath: string | undefined;
    };

export const saveCaptureFile = <T = void>(
  args: SaveCaptureFileArgs,
): Promise<T> => invoke("save_capture_file", args);

// ───────────────────────── Scrcpy ─────────────────────────

export const getScrcpyStatus = <T = { running: boolean }>(
  deviceId: string,
): Promise<T> => invoke("get_scrcpy_status", { deviceId });

export const startScrcpyServer = <T = ScrcpyStatus>(args: {
  deviceId: string;
  maxSize: number;
  bitRate: number;
  maxFps: number;
}): Promise<T> => invoke("start_scrcpy_server", args);

export const stopScrcpyServer = (deviceId: string): Promise<void> =>
  invoke("stop_scrcpy_server", { deviceId });

export const requestScrcpySync = (
  deviceId: string,
  windowLabel: string,
): Promise<void> =>
  invoke("request_scrcpy_sync", { deviceId, windowLabel });

export const scrcpyTouch = (args: {
  deviceId: string;
  action: number;
  x: number;
  y: number;
  width: number;
  height: number;
}): Promise<void> => invoke("scrcpy_touch", args);

export const scrcpyScroll = (args: {
  deviceId: string;
  x: number;
  y: number;
  hScroll: number;
  vScroll: number;
  width: number;
  height: number;
}): Promise<void> => invoke("scrcpy_scroll", args);

export const scrcpyKey = (args: {
  deviceId: string;
  action: number;
  keycode: number;
  metastate: number;
}): Promise<void> => invoke("scrcpy_key", args);

export const scrcpyText = (deviceId: string, text: string): Promise<void> =>
  invoke("scrcpy_text", { deviceId, text });

// ───────────────────────── Media ─────────────────────────

export const getDefaultMediaDir = (): Promise<string> =>
  invoke("get_default_media_dir");

// ───────────────────────── Events ─────────────────────────

export const onDeviceChanged = (
  cb: (devices: DeviceInfo[]) => void,
): Promise<UnlistenFn> =>
  listen<{ devices: DeviceInfo[] }>("device-changed", (e) =>
    cb(e.payload.devices),
  );

/** Fired once when the Rust-side ADB daemon + device tracker are up. */
export const onAppReady = (cb: () => void): Promise<UnlistenFn> =>
  listen("app-ready", () => cb());

/** Synchronous check for readiness, in case the "app-ready" event fired before
 * the listener attached. */
export const isAppReady = (): Promise<boolean> => invoke("is_app_ready");

export const onApkFolderChanged = (
  cb: (path: string) => void,
): Promise<UnlistenFn> =>
  listen<string>("apk-folder-changed", (e) =>
    cb(e.payload),
  );

export const onLogcatLine = (
  deviceId: string,
  cb: (lines: string[]) => void,
): Promise<UnlistenFn> => {
  const sanitizedId = deviceId.replace(/[^a-zA-Z0-9]/g, "_");
  return listen<{ lines: string[] }>(`logcat-line-${sanitizedId}`, (e) =>
    cb(e.payload.lines),
  );
};

// Backend sanitizes scrcpy event ids with `.`/`:` -> `_` only (see
// src-tauri scrcpy service), unlike logcat which replaces all non-alphanumerics.
const sanitizeScrcpyId = (deviceId: string): string =>
  deviceId.replace(/\./g, "_").replace(/:/g, "_");

export const onScrcpyFrame = (
  deviceId: string,
  cb: (payload: string) => void,
): Promise<UnlistenFn> =>
  listen<string>(`scrcpy-frame-${sanitizeScrcpyId(deviceId)}`, (e) =>
    cb(e.payload),
  );

export const onScrcpySync = (
  windowLabel: string,
  deviceId: string,
  cb: (payload: string) => void,
): Promise<UnlistenFn> =>
  listen<string>(
    `scrcpy-sync-${windowLabel}-${sanitizeScrcpyId(deviceId)}`,
    (e) => cb(e.payload),
  );

// Local return-type aliases for commands whose payload types live in the
// consuming components rather than `../types`. Callers may override via the
// generic parameter.
interface CaptureResult {
  success: boolean;
  path?: string;
  error?: string;
}

interface ScrcpyStatus {
  running: boolean;
  device_id: string | null;
  port: number | null;
}
