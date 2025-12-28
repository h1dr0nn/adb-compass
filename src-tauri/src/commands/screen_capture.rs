// Screen Capture Commands - Screenshot and Screen Recording
// Provides commands for capturing device screen

use crate::adb::AdbExecutor;
use crate::command_utils::hidden_command;
use crate::error::AppError;
use chrono::Local;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::process::Stdio;

#[derive(Debug, Serialize)]
pub struct CaptureResult {
    pub success: bool,
    pub path: Option<String>,
    pub error: Option<String>,
}

/// Get the capture save path from settings, or use default
fn get_capture_base_path() -> PathBuf {
    // Check localStorage for custom path (passed from frontend in future)
    // For now, use user's Pictures directory
    if let Some(home) = dirs::home_dir() {
        home.join("Pictures").join("ADB Compass")
    } else {
        PathBuf::from("./captures")
    }
}

/// Ensure capture directories exist
fn ensure_capture_dirs() -> Result<(PathBuf, PathBuf), AppError> {
    let base = get_capture_base_path();
    let screenshots_dir = base.join("screenshots");
    let recordings_dir = base.join("recordings");

    fs::create_dir_all(&screenshots_dir).map_err(|e| {
        AppError::new(
            "DIR_CREATE_FAILED",
            &format!("Failed to create screenshots directory: {}", e),
        )
    })?;

    fs::create_dir_all(&recordings_dir).map_err(|e| {
        AppError::new(
            "DIR_CREATE_FAILED",
            &format!("Failed to create recordings directory: {}", e),
        )
    })?;

    Ok((screenshots_dir, recordings_dir))
}

/// Take a screenshot and save to local file
#[tauri::command]
pub fn take_screenshot(device_id: String) -> CaptureResult {
    let (screenshots_dir, _) = match ensure_capture_dirs() {
        Ok(dirs) => dirs,
        Err(e) => {
            return CaptureResult {
                success: false,
                path: None,
                error: Some(e.message),
            }
        }
    };

    let executor = AdbExecutor::new();
    let adb_path = executor.get_adb_path();

    // Generate filename with timestamp
    let timestamp = Local::now().format("%Y%m%d_%H%M%S");
    let filename = format!("screenshot_{}.png", timestamp);
    let save_path = screenshots_dir.join(&filename);

    // Use adb exec-out to get raw PNG data
    let output = match hidden_command(adb_path)
        .args(["-s", &device_id, "exec-out", "screencap", "-p"])
        .output()
    {
        Ok(output) => output,
        Err(e) => {
            return CaptureResult {
                success: false,
                path: None,
                error: Some(format!("Failed to execute screencap: {}", e)),
            }
        }
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return CaptureResult {
            success: false,
            path: None,
            error: Some(format!("Screencap failed: {}", stderr)),
        };
    }

    // Save the PNG data to file
    if let Err(e) = fs::write(&save_path, &output.stdout) {
        return CaptureResult {
            success: false,
            path: None,
            error: Some(format!("Failed to save screenshot: {}", e)),
        };
    }

    CaptureResult {
        success: true,
        path: Some(save_path.to_string_lossy().to_string()),
        error: None,
    }
}

/// Start screen recording on device
#[tauri::command]
pub fn start_screen_recording(device_id: String) -> CaptureResult {
    let executor = AdbExecutor::new();
    let adb_path = executor.get_adb_path();

    // Start recording in background on device
    // Recording to /sdcard/adbcompass_recording.mp4
    let result = hidden_command(adb_path)
        .args([
            "-s",
            &device_id,
            "shell",
            "screenrecord",
            "--bugreport",
            "/sdcard/adbcompass_recording.mp4",
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();

    match result {
        Ok(_) => CaptureResult {
            success: true,
            path: None,
            error: None,
        },
        Err(e) => CaptureResult {
            success: false,
            path: None,
            error: Some(format!("Failed to start recording: {}", e)),
        },
    }
}

/// Stop screen recording and pull file to local
#[tauri::command]
pub fn stop_screen_recording(device_id: String) -> CaptureResult {
    let (_, recordings_dir) = match ensure_capture_dirs() {
        Ok(dirs) => dirs,
        Err(e) => {
            return CaptureResult {
                success: false,
                path: None,
                error: Some(e.message),
            }
        }
    };

    let executor = AdbExecutor::new();
    let adb_path = executor.get_adb_path();

    // Kill screenrecord process on device
    let _ = hidden_command(&adb_path)
        .args([
            "-s",
            &device_id,
            "shell",
            "pkill",
            "-SIGINT",
            "screenrecord",
        ])
        .output();

    // Wait a bit for file to be finalized
    std::thread::sleep(std::time::Duration::from_millis(1000));

    // Generate local filename
    let timestamp = Local::now().format("%Y%m%d_%H%M%S");
    let filename = format!("recording_{}.mp4", timestamp);
    let save_path = recordings_dir.join(&filename);

    // Pull recording from device
    let output = hidden_command(&adb_path)
        .args([
            "-s",
            &device_id,
            "pull",
            "/sdcard/adbcompass_recording.mp4",
            &save_path.to_string_lossy(),
        ])
        .output();

    match output {
        Ok(o) if o.status.success() => {
            // Clean up file on device
            let _ = hidden_command(&adb_path)
                .args([
                    "-s",
                    &device_id,
                    "shell",
                    "rm",
                    "/sdcard/adbcompass_recording.mp4",
                ])
                .output();

            CaptureResult {
                success: true,
                path: Some(save_path.to_string_lossy().to_string()),
                error: None,
            }
        }
        Ok(o) => {
            let stderr = String::from_utf8_lossy(&o.stderr);
            CaptureResult {
                success: false,
                path: None,
                error: Some(format!("Failed to pull recording: {}", stderr)),
            }
        }
        Err(e) => CaptureResult {
            success: false,
            path: None,
            error: Some(format!("Failed to pull recording: {}", e)),
        },
    }
}

/// Get a single frame of the device screen for preview
#[tauri::command]
pub fn get_screen_frame(device_id: String) -> Result<Vec<u8>, AppError> {
    let executor = AdbExecutor::new();
    let adb_path = executor.get_adb_path();

    let output = hidden_command(adb_path)
        .args(["-s", &device_id, "exec-out", "screencap", "-p"])
        .output()
        .map_err(|e| {
            AppError::new(
                "SCREEN_FRAME_FAILED",
                &format!("Failed to get screen: {}", e),
            )
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::new(
            "SCREEN_FRAME_FAILED",
            &format!("Screencap failed: {}", stderr),
        ));
    }

    Ok(output.stdout)
}
