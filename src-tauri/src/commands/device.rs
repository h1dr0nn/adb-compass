// Device Commands - Tauri commands for device management
// Handles device detection, status checking, and basic operations

use crate::adb::{executor::DeviceInfo, AdbExecutor};
use crate::error::AppError;
use serde::Serialize;

/// Response for ADB status check
#[derive(Serialize)]
pub struct AdbStatus {
    pub available: bool,
    pub version: Option<String>,
    pub error: Option<String>,
    pub adb_path: Option<String>,
    pub is_bundled: bool,
}

/// Check if ADB is available and return version
#[tauri::command]
pub fn check_adb_status() -> AdbStatus {
    let executor = AdbExecutor::new();
    let adb_path = executor.get_adb_path().to_string_lossy().to_string();
    let is_bundled = executor.is_bundled();

    match executor.check_available() {
        Ok(version) => AdbStatus {
            available: true,
            version: Some(version),
            error: None,
            adb_path: Some(adb_path),
            is_bundled,
        },
        Err(e) => AdbStatus {
            available: false,
            version: None,
            error: Some(e.message),
            adb_path: Some(adb_path),
            is_bundled,
        },
    }
}

/// Get list of connected devices
#[tauri::command]
pub fn get_devices() -> Result<Vec<DeviceInfo>, AppError> {
    let executor = AdbExecutor::new();
    executor.list_devices()
}

/// Refresh device list (same as get_devices, but can trigger server start)
#[tauri::command]
pub fn refresh_devices() -> Result<Vec<DeviceInfo>, AppError> {
    let executor = AdbExecutor::new();

    // Try to start server if needed
    let _ = executor.start_server();

    executor.list_devices()
}

/// Get a specific device property
#[tauri::command]
pub fn get_device_property(device_id: String, property: String) -> Result<String, AppError> {
    let executor = AdbExecutor::new();
    executor.get_device_prop(&device_id, &property)
}

/// Start ADB server
#[tauri::command]
pub fn start_adb_server() -> Result<(), AppError> {
    let executor = AdbExecutor::new();
    executor.start_server()
}

/// Kill ADB server
#[tauri::command]
pub fn kill_adb_server() -> Result<(), AppError> {
    let executor = AdbExecutor::new();
    executor.kill_server()
}

/// Check device requirements for APK installation
#[tauri::command]
pub fn check_device_requirements(device_id: String) -> Vec<crate::requirements::RequirementCheck> {
    let executor = AdbExecutor::new();
    executor.check_device_requirements(&device_id)
}

/// Check advanced requirements for action buttons (Input Text, etc.)
#[tauri::command]
pub fn check_action_requirements(device_id: String) -> Vec<crate::requirements::RequirementCheck> {
    let executor = AdbExecutor::new();
    executor.check_action_requirements(&device_id)
}
