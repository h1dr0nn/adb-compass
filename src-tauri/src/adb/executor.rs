// ADB Executor - Wraps adb command execution
// Provides safe, typed interface for running adb commands

use std::path::PathBuf;
use std::process::Command;
use crate::error::{AdbError, AppError};

/// Represents the connection status of a device
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub enum DeviceStatus {
    Device,      // Connected and authorized
    Offline,     // Connected but not responding
    Unauthorized, // Connected but not authorized for debugging
    Unknown(String),
}

impl From<&str> for DeviceStatus {
    fn from(s: &str) -> Self {
        match s.trim().to_lowercase().as_str() {
            "device" => DeviceStatus::Device,
            "offline" => DeviceStatus::Offline,
            "unauthorized" => DeviceStatus::Unauthorized,
            other => DeviceStatus::Unknown(other.to_string()),
        }
    }
}

/// Information about a connected Android device
#[derive(Debug, Clone, serde::Serialize)]
pub struct DeviceInfo {
    pub id: String,
    pub status: DeviceStatus,
    pub model: Option<String>,
    pub product: Option<String>,
}

/// Executor for ADB commands
pub struct AdbExecutor {
    adb_path: PathBuf,
}

impl Default for AdbExecutor {
    fn default() -> Self {
        Self::new()
    }
}

impl AdbExecutor {
    /// Create a new ADB executor, automatically finding bundled or system ADB
    pub fn new() -> Self {
        let adb_path = Self::find_adb();
        Self { adb_path }
    }

    /// Create an ADB executor with custom path
    pub fn with_path(path: PathBuf) -> Self {
        Self { adb_path: path }
    }

    /// Find ADB executable - tries bundled first, then system PATH
    fn find_adb() -> PathBuf {
        // Try bundled ADB first
        if let Some(bundled) = Self::find_bundled_adb() {
            return bundled;
        }

        // Fallback to system ADB
        PathBuf::from("adb")
    }

    /// Find bundled ADB in app resources
    fn find_bundled_adb() -> Option<PathBuf> {
        // Get the executable directory
        let exe_path = std::env::current_exe().ok()?;
        let exe_dir = exe_path.parent()?;

        // In development, check src-tauri/binaries
        let dev_path = exe_dir
            .parent()? // target
            .parent()? // debug or release
            .parent()? // target
            .join("binaries")
            .join(Self::adb_executable_name());

        if dev_path.exists() {
            return Some(dev_path);
        }

        // In production, resources are next to executable
        let prod_path = exe_dir.join(Self::adb_executable_name());
        if prod_path.exists() {
            return Some(prod_path);
        }

        // Check _up_/resources/ (some Tauri bundle layouts)
        let resources_path = exe_dir.join("resources").join(Self::adb_executable_name());
        if resources_path.exists() {
            return Some(resources_path);
        }

        None
    }

    /// Get platform-specific ADB executable name
    fn adb_executable_name() -> &'static str {
        if cfg!(target_os = "windows") {
            "adb.exe"
        } else {
            "adb"
        }
    }

    /// Get the current ADB path being used
    pub fn get_adb_path(&self) -> &PathBuf {
        &self.adb_path
    }

    /// Check if using bundled ADB
    pub fn is_bundled(&self) -> bool {
        self.adb_path != PathBuf::from("adb")
    }

    /// Check if ADB is available
    pub fn check_available(&self) -> Result<String, AppError> {
        let output = Command::new(&self.adb_path)
            .arg("version")
            .output()
            .map_err(|_| AppError::from(AdbError::NotFound))?;

        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout);
            // Extract first line which contains version
            let first_line = version.lines().next().unwrap_or("Unknown version");
            Ok(first_line.to_string())
        } else {
            Err(AppError::from(AdbError::NotFound))
        }
    }

    /// List connected devices
    pub fn list_devices(&self) -> Result<Vec<DeviceInfo>, AppError> {
        let output = Command::new(&self.adb_path)
            .arg("devices")
            .arg("-l")
            .output()
            .map_err(|e| AppError::from(AdbError::ExecutionFailed(e.to_string())))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::from(AdbError::ExecutionFailed(stderr.to_string())));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        self.parse_devices_output(&stdout)
    }

    /// Parse the output of `adb devices -l`
    fn parse_devices_output(&self, output: &str) -> Result<Vec<DeviceInfo>, AppError> {
        let mut devices = Vec::new();

        for line in output.lines().skip(1) {
            // Skip header "List of devices attached"
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 2 {
                continue;
            }

            let id = parts[0].to_string();
            let status = DeviceStatus::from(parts[1]);

            // Parse additional properties
            let mut model = None;
            let mut product = None;

            for part in parts.iter().skip(2) {
                if let Some(value) = part.strip_prefix("model:") {
                    model = Some(value.to_string());
                } else if let Some(value) = part.strip_prefix("product:") {
                    product = Some(value.to_string());
                }
            }

            devices.push(DeviceInfo {
                id,
                status,
                model,
                product,
            });
        }

        Ok(devices)
    }

    /// Get device property
    pub fn get_device_prop(&self, device_id: &str, prop: &str) -> Result<String, AppError> {
        let output = Command::new(&self.adb_path)
            .args(["-s", device_id, "shell", "getprop", prop])
            .output()
            .map_err(|e| AppError::from(AdbError::ExecutionFailed(e.to_string())))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err(AppError::from(AdbError::DeviceNotFound(device_id.to_string())))
        }
    }

    /// Start ADB server
    pub fn start_server(&self) -> Result<(), AppError> {
        let output = Command::new(&self.adb_path)
            .arg("start-server")
            .output()
            .map_err(|e| AppError::from(AdbError::ExecutionFailed(e.to_string())))?;

        if output.status.success() {
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(AppError::from(AdbError::ExecutionFailed(stderr.to_string())))
        }
    }

    /// Kill ADB server
    pub fn kill_server(&self) -> Result<(), AppError> {
        let output = Command::new(&self.adb_path)
            .arg("kill-server")
            .output()
            .map_err(|e| AppError::from(AdbError::ExecutionFailed(e.to_string())))?;

        if output.status.success() {
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(AppError::from(AdbError::ExecutionFailed(stderr.to_string())))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_devices_output_empty() {
        let executor = AdbExecutor::new();
        let output = "List of devices attached\n\n";
        let devices = executor.parse_devices_output(output).unwrap();
        assert!(devices.is_empty());
    }

    #[test]
    fn test_parse_devices_output_single() {
        let executor = AdbExecutor::new();
        let output = "List of devices attached\nemulator-5554    device product:sdk model:sdk_phone\n";
        let devices = executor.parse_devices_output(output).unwrap();
        assert_eq!(devices.len(), 1);
        assert_eq!(devices[0].id, "emulator-5554");
        assert_eq!(devices[0].status, DeviceStatus::Device);
    }

    #[test]
    fn test_device_status_from_str() {
        assert_eq!(DeviceStatus::from("device"), DeviceStatus::Device);
        assert_eq!(DeviceStatus::from("offline"), DeviceStatus::Offline);
        assert_eq!(DeviceStatus::from("unauthorized"), DeviceStatus::Unauthorized);
    }
}
