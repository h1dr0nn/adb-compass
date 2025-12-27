// File Transfer Commands - Push, pull, list files on device
// Provides file management capabilities via ADB

use crate::adb::AdbExecutor;
use crate::command_utils::hidden_command;
use crate::error::AppError;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct FileInfo {
    pub name: String,
    pub is_directory: bool,
    pub size: Option<u64>,
    pub permissions: Option<String>,
}

/// List files in a directory on the device
#[tauri::command]
pub fn list_files(device_id: String, path: String) -> Result<Vec<FileInfo>, AppError> {
    let executor = AdbExecutor::new();
    let adb_path = executor.get_adb_path();

    // Use ls -la to get detailed file listing
    let output = hidden_command(adb_path)
        .args(["-s", &device_id, "shell", "ls", "-la", &path])
        .output()
        .map_err(|e| AppError::new("LIST_FILES_FAILED", &format!("Failed to list files: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::new(
            "LIST_FILES_FAILED",
            &format!("List files failed: {}", stderr),
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let files = parse_ls_output(&stdout);

    Ok(files)
}

fn parse_ls_output(output: &str) -> Vec<FileInfo> {
    let mut files = Vec::new();

    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("total") {
            continue;
        }

        // Format: drwxrwxrwx user group size date time name
        // or: -rw-r--r-- user group size date time name
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 7 {
            continue;
        }

        let permissions = parts[0];
        let is_directory = permissions.starts_with('d');
        let size: Option<u64> = parts[4].parse().ok();

        // Name is everything after the date/time (parts 5, 6)
        // Handle names with spaces by joining remaining parts
        let name = if parts.len() > 7 {
            parts[7..].join(" ")
        } else if parts.len() == 7 {
            parts[6].to_string()
        } else {
            continue;
        };

        // Skip . and .. entries
        if name == "." || name == ".." {
            continue;
        }

        // Handle symlinks: remove " -> target" part
        let name = name.split(" -> ").next().unwrap_or(&name).to_string();

        files.push(FileInfo {
            name,
            is_directory,
            size: if is_directory { None } else { size },
            permissions: Some(permissions.to_string()),
        });
    }

    // Sort: directories first, then by name
    files.sort_by(|a, b| match (a.is_directory, b.is_directory) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    files
}

/// Push a file from local to device
#[tauri::command]
pub fn push_file(
    device_id: String,
    local_path: String,
    remote_path: String,
) -> Result<String, AppError> {
    let executor = AdbExecutor::new();
    let adb_path = executor.get_adb_path();

    let output = hidden_command(adb_path)
        .args(["-s", &device_id, "push", &local_path, &remote_path])
        .output()
        .map_err(|e| AppError::new("PUSH_FAILED", &format!("Failed to push file: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::new(
            "PUSH_FAILED",
            &format!("Push failed: {}", stderr),
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(stdout)
}

/// Pull a file from device to local
#[tauri::command]
pub fn pull_file(
    device_id: String,
    remote_path: String,
    local_path: String,
) -> Result<String, AppError> {
    let executor = AdbExecutor::new();
    let adb_path = executor.get_adb_path();

    let output = hidden_command(adb_path)
        .args(["-s", &device_id, "pull", &remote_path, &local_path])
        .output()
        .map_err(|e| AppError::new("PULL_FAILED", &format!("Failed to pull file: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::new(
            "PULL_FAILED",
            &format!("Pull failed: {}", stderr),
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(stdout)
}

/// Delete a file or directory on device
#[tauri::command]
pub fn delete_remote_file(device_id: String, remote_path: String) -> Result<(), AppError> {
    let executor = AdbExecutor::new();
    let adb_path = executor.get_adb_path();

    // Try rm -rf to handle both files and directories
    let output = hidden_command(adb_path)
        .args(["-s", &device_id, "shell", "rm", "-rf", &remote_path])
        .output()
        .map_err(|e| AppError::new("DELETE_FAILED", &format!("Failed to delete: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::new(
            "DELETE_FAILED",
            &format!("Delete failed: {}", stderr),
        ));
    }

    Ok(())
}

/// Create a directory on device
#[tauri::command]
pub fn create_remote_directory(device_id: String, remote_path: String) -> Result<(), AppError> {
    let executor = AdbExecutor::new();
    let adb_path = executor.get_adb_path();

    let output = hidden_command(adb_path)
        .args(["-s", &device_id, "shell", "mkdir", "-p", &remote_path])
        .output()
        .map_err(|e| {
            AppError::new(
                "MKDIR_FAILED",
                &format!("Failed to create directory: {}", e),
            )
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::new(
            "MKDIR_FAILED",
            &format!("Create directory failed: {}", stderr),
        ));
    }

    Ok(())
}
