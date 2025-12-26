// APK Commands - Tauri commands for APK handling
// Handles APK validation and installation

use crate::adb::AdbExecutor;
use crate::apk::{ApkInfo, InstallResult};

/// Validate APK file and return info
#[tauri::command]
pub fn validate_apk(path: String) -> Option<ApkInfo> {
    ApkInfo::from_path(&path)
}

/// Install APK on a specific device
#[tauri::command]
pub fn install_apk(device_id: String, apk_path: String) -> InstallResult {
    let executor = AdbExecutor::new();
    executor.install_apk(&device_id, &apk_path)
}
