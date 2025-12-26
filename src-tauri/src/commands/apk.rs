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

/// Scan a folder for APK files
#[tauri::command]
pub fn scan_apks_in_folder(path: String) -> Vec<ApkInfo> {
    let mut apks = Vec::new();
    let path_buf = std::path::PathBuf::from(path);

    if let Ok(entries) = std::fs::read_dir(path_buf) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext.to_string_lossy().to_lowercase() == "apk" {
                        if let Some(path_str) = path.to_str() {
                            if let Some(info) = ApkInfo::from_path(path_str) {
                                if info.valid {
                                    apks.push(info);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    apks
}
