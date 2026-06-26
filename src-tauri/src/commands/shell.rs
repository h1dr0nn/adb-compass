// Shell Commands
// Execute shell commands on connected devices

use crate::adb::AdbExecutor;
use crate::command_utils::hidden_command;

fn split_arguments(cmd: &str) -> Vec<String> {
    let mut args = Vec::new();
    let mut current = String::new();
    let mut in_double_quote = false;
    let mut in_single_quote = false;
    let mut chars = cmd.chars().peekable();

    while let Some(c) = chars.next() {
        match c {
            '"' if !in_single_quote => {
                in_double_quote = !in_double_quote;
            }
            '\'' if !in_double_quote => {
                in_single_quote = !in_single_quote;
            }
            '\\' => {
                if let Some(&next_c) = chars.peek() {
                    if next_c == '"' || next_c == '\'' || next_c == '\\' || next_c == ' ' {
                        current.push(next_c);
                        chars.next();
                    } else {
                        current.push(c);
                    }
                } else {
                    current.push(c);
                }
            }
            ' ' | '\t' => {
                if in_double_quote || in_single_quote {
                    current.push(c);
                } else if !current.is_empty() {
                    args.push(current);
                    current = String::new();
                }
            }
            _ => {
                current.push(c);
            }
        }
    }
    if !current.is_empty() {
        args.push(current);
    }
    args
}

/// Execute a shell command on the device (or host if it is an adb command)
#[tauri::command]
pub async fn execute_shell(device_id: String, command: String) -> Result<String, String> {
    let adb = AdbExecutor::new();

    let trimmed = command.trim();
    if trimmed.starts_with("adb ") || trimmed == "adb" {
        let mut args = split_arguments(trimmed);
        if !args.is_empty() {
            let has_s = args.iter().any(|arg| arg == "-s");
            if !has_s && !device_id.is_empty() {
                args.insert(1, "-s".to_string());
                args.insert(2, device_id.clone());
            }

            let output = hidden_command(adb.get_adb_path())
                .args(&args[1..])
                .output()
                .map_err(|e| format!("ADB command failed: {}", e))?;

            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);

            if !stderr.is_empty() && stdout.is_empty() {
                return Err(stderr.to_string());
            } else {
                return Ok(stdout.to_string());
            }
        }
    }

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
        "-v".to_string(),
        "threadtime".to_string(),
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
