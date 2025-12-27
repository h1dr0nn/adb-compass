// Shell Commands
// Execute shell commands on connected devices

use crate::adb::AdbExecutor;
use crate::command_utils::hidden_command;

/// Execute a shell command on the device
#[tauri::command]
pub async fn execute_shell(device_id: String, command: String) -> Result<String, String> {
    let adb = AdbExecutor::new();

    let output = hidden_command(adb.get_adb_path())
        .args(["-s", &device_id, "shell", &command])
        .output()
        .map_err(|e| format!("Shell command failed: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !stderr.is_empty() && stdout.is_empty() {
        Err(stderr.to_string())
    } else {
        Ok(stdout.to_string())
    }
}

/// Get logcat output (single snapshot, not streaming)
#[tauri::command]
pub async fn get_logcat(
    device_id: String,
    lines: u32,
    filter: Option<String>,
) -> Result<String, String> {
    let adb = AdbExecutor::new();

    let mut args = vec![
        "-s".to_string(),
        device_id,
        "logcat".to_string(),
        "-d".to_string(),
        "-t".to_string(),
        lines.to_string(),
    ];

    // Add filter if provided (e.g., "*:E" for errors only)
    if let Some(f) = filter {
        args.push(f);
    }

    let output = hidden_command(adb.get_adb_path())
        .args(&args)
        .output()
        .map_err(|e| format!("Logcat failed: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.to_string())
}

/// Clear logcat buffer
#[tauri::command]
pub async fn clear_logcat(device_id: String) -> Result<(), String> {
    let adb = AdbExecutor::new();

    let output = hidden_command(adb.get_adb_path())
        .args(["-s", &device_id, "logcat", "-c"])
        .output()
        .map_err(|e| format!("Failed to clear logcat: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to clear logcat: {}", stderr))
    }
}
