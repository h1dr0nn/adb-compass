// Device Actions - Advanced device control commands
// Provides reboot, input, uninstall, and info commands

use crate::adb::AdbExecutor;
use crate::error::AppError;
use serde::Serialize;
use std::process::Stdio;

#[derive(Debug, Serialize)]
pub struct DeviceProps {
    pub model: String,
    pub android_version: String,
    pub sdk_version: String,
    pub battery_level: Option<u8>,
    pub is_charging: bool,
}

/// Reboot device with optional mode (recovery, bootloader)
#[tauri::command]
pub fn reboot_device(device_id: String, mode: Option<String>) -> Result<(), AppError> {
    let executor = AdbExecutor::new();
    let adb_path = executor.get_adb_path();

    let mut cmd = std::process::Command::new(adb_path);
    cmd.args(["-s", &device_id, "reboot"]);

    if let Some(m) = &mode {
        if !m.is_empty() {
            cmd.arg(m);
        }
    }

    cmd.stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| AppError::new("REBOOT_FAILED", &format!("Failed to reboot: {}", e)))?;

    Ok(())
}

/// Input text to device's current focused input
#[tauri::command]
pub fn input_text(device_id: String, text: String) -> Result<(), AppError> {
    let executor = AdbExecutor::new();
    let adb_path = executor.get_adb_path();

    // Escape special characters for adb shell input text
    // Space -> %s, special chars need escaping
    let escaped_text = text
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\'', "\\'")
        .replace(' ', "%s")
        .replace('&', "\\&")
        .replace('|', "\\|")
        .replace(';', "\\;")
        .replace('(', "\\(")
        .replace(')', "\\)")
        .replace('<', "\\<")
        .replace('>', "\\>");

    let output = std::process::Command::new(adb_path)
        .args(["-s", &device_id, "shell", "input", "text", &escaped_text])
        .output()
        .map_err(|e| AppError::new("INPUT_FAILED", &format!("Failed to input text: {}", e)))?;

    // Android shell outputs errors to stdout, not stderr
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    // Check for error in both stdout and stderr
    if stdout.contains("Exception") || stdout.contains("Error") || stdout.contains("error") {
        return Err(AppError::new(
            "INPUT_FAILED",
            &format!("Input failed: {}", stdout.trim()),
        ));
    }

    if !output.status.success() {
        return Err(AppError::new(
            "INPUT_FAILED",
            &format!(
                "Input failed: {}",
                if stderr.is_empty() {
                    stdout.trim()
                } else {
                    stderr.trim()
                }
                .to_string()
            ),
        ));
    }

    Ok(())
}

/// Uninstall an app by package name
#[tauri::command]
pub fn uninstall_app(device_id: String, package_name: String) -> Result<String, AppError> {
    let executor = AdbExecutor::new();
    let adb_path = executor.get_adb_path();

    let output = std::process::Command::new(adb_path)
        .args(["-s", &device_id, "uninstall", &package_name])
        .output()
        .map_err(|e| AppError::new("UNINSTALL_FAILED", &format!("Failed to uninstall: {}", e)))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();

    if stdout.contains("Success") {
        Ok("Successfully uninstalled".to_string())
    } else {
        Err(AppError::new(
            "UNINSTALL_FAILED",
            &format!("Uninstall failed: {}", stdout.trim()),
        ))
    }
}

/// List installed packages
#[tauri::command]
pub fn list_packages(device_id: String, include_system: bool) -> Result<Vec<String>, AppError> {
    let executor = AdbExecutor::new();
    let adb_path = executor.get_adb_path();

    let mut args = vec!["-s", &device_id, "shell", "pm", "list", "packages"];

    // -3 = third party only, no flag = all packages
    if !include_system {
        args.push("-3");
    }

    let output = std::process::Command::new(adb_path)
        .args(&args)
        .output()
        .map_err(|e| {
            AppError::new(
                "LIST_PACKAGES_FAILED",
                &format!("Failed to list packages: {}", e),
            )
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::new(
            "LIST_PACKAGES_FAILED",
            &format!("List packages failed: {}", stderr),
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let packages: Vec<String> = stdout
        .lines()
        .filter_map(|line| line.strip_prefix("package:").map(|s| s.trim().to_string()))
        .collect();

    Ok(packages)
}

/// Get device properties (model, version, battery)
#[tauri::command]
pub fn get_device_props(device_id: String) -> Result<DeviceProps, AppError> {
    let executor = AdbExecutor::new();
    let adb_path = executor.get_adb_path();

    // Get properties
    let props_output = std::process::Command::new(adb_path)
        .args(["-s", &device_id, "shell", "getprop"])
        .output()
        .map_err(|e| AppError::new("GET_PROPS_FAILED", &format!("Failed to get props: {}", e)))?;

    let props_str = String::from_utf8_lossy(&props_output.stdout);

    let model =
        extract_prop(&props_str, "ro.product.model").unwrap_or_else(|| "Unknown".to_string());
    let android_version = extract_prop(&props_str, "ro.build.version.release")
        .unwrap_or_else(|| "Unknown".to_string());
    let sdk_version =
        extract_prop(&props_str, "ro.build.version.sdk").unwrap_or_else(|| "Unknown".to_string());

    // Get battery info
    let battery_output = std::process::Command::new(adb_path)
        .args(["-s", &device_id, "shell", "dumpsys", "battery"])
        .output()
        .ok();

    let (battery_level, is_charging) = if let Some(output) = battery_output {
        let battery_str = String::from_utf8_lossy(&output.stdout);

        let level = battery_str
            .lines()
            .find(|l| l.trim().starts_with("level:"))
            .and_then(|l| l.split(':').nth(1))
            .and_then(|v| v.trim().parse::<u8>().ok());

        let charging = battery_str.contains("USB powered: true")
            || battery_str.contains("AC powered: true")
            || battery_str.contains("Wireless powered: true");

        (level, charging)
    } else {
        (None, false)
    };

    Ok(DeviceProps {
        model,
        android_version,
        sdk_version,
        battery_level,
        is_charging,
    })
}

fn extract_prop(output: &str, key: &str) -> Option<String> {
    // Format: [key]: [value]
    let pattern = format!("[{}]:", key);
    output
        .lines()
        .find(|line| line.contains(&pattern))
        .and_then(|line| {
            // Find the value between last [ and ]
            let value_start = line.rfind('[')? + 1;
            let value_end = line.rfind(']')?;
            if value_start < value_end {
                Some(line[value_start..value_end].to_string())
            } else {
                None
            }
        })
}
