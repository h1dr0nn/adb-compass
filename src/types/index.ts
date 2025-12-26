// TypeScript types for ADB Compass

// Device status enum
export type DeviceStatus =
  | 'Device'
  | 'Offline'
  | 'Unauthorized'
  | { Unknown: string };

// Device information from backend
export interface DeviceInfo {
  id: string;
  status: DeviceStatus;
  model: string | null;
  product: string | null;
}

// ADB status response
export interface AdbStatus {
  available: boolean;
  version: string | null;
  error: string | null;
  adb_path: string | null;
  is_bundled: boolean;
}

// Application error from backend
export interface AppError {
  code: string;
  message: string;
  details: string | null;
}

// Helper function to get device status display text
export function getDeviceStatusText(status: DeviceStatus): string {
  if (status === 'Device') return 'Connected';
  if (status === 'Offline') return 'Offline';
  if (status === 'Unauthorized') return 'Unauthorized';
  if (typeof status === 'object' && 'Unknown' in status) {
    return status.Unknown;
  }
  return 'Unknown';
}

// Helper function to get status color class
export function getStatusColorClass(status: DeviceStatus): string {
  if (status === 'Device') return 'status-connected';
  if (status === 'Offline') return 'status-offline';
  if (status === 'Unauthorized') return 'status-warning';
  return 'status-unknown';
}

// Requirement check result from backend
export interface RequirementCheck {
  id: string;
  name: string;
  description: string;
  passed: boolean;
  hint: string | null;
}

// APK file information
export interface ApkInfo {
  path: string;
  file_name: string;
  size_bytes: number;
  valid: boolean;
  last_modified?: number;
}

// APK installation result
export interface InstallResult {
  success: boolean;
  device_id: string;
  message: string;
  error_code: string | null;
}


