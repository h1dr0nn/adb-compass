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

/// Status of a single bundled binary/resource.
#[derive(Serialize)]
pub struct BinaryStatus {
    pub name: String,
    pub ok: bool,
    pub detail: Option<String>,
}

/// Report the availability of every binary the app depends on, so the UI can
/// surface which tools are ready. ADB is probed by running it; the others are
/// checked for presence on disk next to the resolved ADB path.
#[tauri::command]
pub fn get_binaries() -> Vec<BinaryStatus> {
    let executor = AdbExecutor::new();
    let adb_path = executor.get_adb_path().to_path_buf();
    let bin_dir = adb_path.parent().map(|p| p.to_path_buf());

    let mut out: Vec<BinaryStatus> = Vec::new();

    // ADB — probed by running `adb version`; show the real version string.
    match executor.check_available() {
        Ok(version) => out.push(BinaryStatus {
            name: "ADB".into(),
            ok: true,
            detail: Some(
                version
                    .lines()
                    .next()
                    .unwrap_or(&version)
                    .trim()
                    .to_string(),
            ),
        }),
        Err(e) => out.push(BinaryStatus {
            name: "ADB".into(),
            ok: false,
            detail: Some(e.message),
        }),
    }

    // Lodestar — our on-device agent (agent.jar). Carries its own version,
    // bumped on each agent update.
    let agent_ok = bin_dir
        .as_ref()
        .map(|d| d.join("agent.jar").exists())
        .unwrap_or(false);
    out.push(BinaryStatus {
        name: "Lodestar Agent".into(),
        ok: agent_ok,
        detail: agent_ok.then(|| "Lodestar agent version 1.0.0".to_string()),
    });

    // scrcpy-server.jar lives in the resources dir; probe a few candidates.
    let scrcpy_exists = bin_dir
        .as_ref()
        .map(|d| {
            [
                d.join("scrcpy-server.jar"),
                d.join("../resources/scrcpy-server.jar"),
            ]
            .iter()
            .any(|p| p.exists())
        })
        .unwrap_or(false);
    out.push(BinaryStatus {
        name: "Scrcpy Server".into(),
        ok: scrcpy_exists,
        detail: scrcpy_exists.then(|| "Scrcpy server version 2.7".to_string()),
    });

    out
}

/// Get list of connected devices
#[tauri::command]
pub fn get_devices() -> Result<Vec<DeviceInfo>, AppError> {
    let executor = AdbExecutor::new();
    executor.list_devices()
}

/// Refresh device list. This is the explicit user "Refresh" action and doubles
/// as a recovery path: it BOUNCES the adb daemon (kill + start) so a wedged USB
/// monitor re-enumerates devices. A plain `start-server` is a no-op when a
/// daemon is already running, which is why a stuck daemon previously could only
/// be recovered by restarting the whole app.
#[tauri::command]
pub fn refresh_devices() -> Result<Vec<DeviceInfo>, AppError> {
    let executor = AdbExecutor::new();
    let _ = executor.kill_server();
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
pub async fn check_device_requirements(
    device_id: String,
) -> Result<Vec<crate::requirements::RequirementCheck>, String> {
    tokio::task::spawn_blocking(move || {
        let executor = AdbExecutor::new();
        executor.check_device_requirements(&device_id)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))
}

/// Check advanced requirements for action buttons (Input Text, etc.)
#[tauri::command]
pub async fn check_action_requirements(
    device_id: String,
) -> Result<Vec<crate::requirements::RequirementCheck>, String> {
    tokio::task::spawn_blocking(move || {
        let executor = AdbExecutor::new();
        executor.check_action_requirements(&device_id)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))
}
