// ADB Executor - Wraps adb command execution
// Provides safe, typed interface for running adb commands.
// This is now a facade over more specialized components (AdbClient, AdbDiscovery, etc.)

use crate::adb::client::{AdbClient, ExecutionConfig};
use crate::adb::command_builder::{AdbCommand, AdbCommandBuilder};
use crate::adb::discovery::AdbDiscovery;
use crate::error::AppError;
use std::path::PathBuf;
use std::time::Duration;

/// Represents the connection status of a device
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub enum DeviceStatus {
    Device,       // Connected and authorized
    Offline,      // Connected but not responding
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
#[derive(Debug, Clone, serde::Serialize, PartialEq)]
pub struct DeviceInfo {
    pub id: String,
    pub status: DeviceStatus,
    pub model: Option<String>,
    pub product: Option<String>,
}

/// Executor for ADB commands
/// Facade pattern to maintain backward compatibility while using the new modular architecture.
pub struct AdbExecutor {
    client: AdbClient,
}

impl Default for AdbExecutor {
    fn default() -> Self {
        Self::new()
    }
}

impl AdbExecutor {
    /// Create a new ADB executor using the discovered ADB path.
    pub fn new() -> Self {
        Self {
            client: AdbClient::new(),
        }
    }

    /// Create an ADB executor with a custom ADB path.
    pub fn with_path(path: PathBuf) -> Self {
        Self {
            client: AdbClient::with_path(path),
        }
    }

    /// Get the current path to the ADB executable.
    pub fn get_adb_path(&self) -> &PathBuf {
        self.client.adb_path()
    }

    /// Check if using the bundled version of ADB.
    pub fn is_bundled(&self) -> bool {
        // Bundled path logic is now inside AdbClient::discover_adb
        self.client.adb_path() != &PathBuf::from("adb")
    }

    /// Verify if ADB is available and returns the version string.
    pub fn check_available(&self) -> Result<String, AppError> {
        let output = self.client.execute(&["version"])?;
        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout);
            let first_line = version.lines().next().unwrap_or("Unknown version");
            Ok(first_line.to_string())
        } else {
            Err(AppError::from(crate::error::AdbError::NotFound))
        }
    }

    /// List all connected devices.
    pub fn list_devices(&self) -> Result<Vec<DeviceInfo>, AppError> {
        let discovery = AdbDiscovery::new(&self.client);
        discovery.list_devices()
    }

    /// Retrieve a specific property from a device.
    pub fn get_device_prop(&self, device_id: &str, prop: &str) -> Result<String, AppError> {
        let builder = AdbCommandBuilder::new().target(device_id);
        let args = builder.build(AdbCommand::GetProp(prop.to_string()));
        let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

        let output = self.client.execute(&args_refs)?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err(AppError::from(crate::error::AdbError::DeviceNotFound(
                device_id.to_string(),
            )))
        }
    }

    /// Start the ADB server.
    pub fn start_server(&self) -> Result<(), AppError> {
        let config = ExecutionConfig {
            timeout: Duration::from_secs(10),
            retries: 1,
            hidden: true,
        };
        self.client
            .execute_with_config(&["start-server"], &config)?;
        Ok(())
    }

    /// Terminate the ADB server.
    pub fn kill_server(&self) -> Result<(), AppError> {
        let config = ExecutionConfig {
            timeout: Duration::from_secs(5),
            retries: 1,
            hidden: true,
        };
        self.client.execute_with_config(&["kill-server"], &config)?;
        Ok(())
    }

    /// Retrieve a setting value from the device's settings database.
    pub fn get_setting(&self, device_id: &str, namespace: &str, key: &str) -> Option<String> {
        let builder = AdbCommandBuilder::new().target(device_id);
        let args = builder.build(AdbCommand::Shell(vec![
            "settings".into(),
            "get".into(),
            namespace.into(),
            key.into(),
        ]));
        let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

        let output = self.client.execute(&args_refs).ok()?;

        if output.status.success() {
            let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if value == "null" || value.is_empty() {
                None
            } else {
                Some(value)
            }
        } else {
            None
        }
    }

    /// Check base device requirements (legacy redirect).
    pub fn check_device_requirements(
        &self,
        device_id: &str,
    ) -> Vec<crate::requirements::RequirementCheck> {
        let checker = crate::requirements::RequirementChecker::new(self);
        checker.check_device_requirements(device_id)
    }

    /// Check advanced action requirements (legacy redirect).
    pub fn check_action_requirements(
        &self,
        device_id: &str,
    ) -> Vec<crate::requirements::RequirementCheck> {
        let checker = crate::requirements::RequirementChecker::new(self);
        checker.check_action_requirements(device_id)
    }

    /// Install an APK on a device (legacy redirect).
    pub fn install_apk(&self, device_id: &str, apk_path: &str) -> crate::apk::InstallResult {
        let installer = crate::apk::ApkInstaller::new(self);
        installer.install(device_id, apk_path)
    }

    // Exposed for legacy module use (like apk.rs and requirements.rs during transition)
    pub fn run_with_retry<F>(
        &self,
        command_builder: F,
        timeout: Duration,
        retries: u32,
    ) -> Result<std::process::Output, AppError>
    where
        F: FnMut() -> std::process::Command,
    {
        self.client
            .run_with_retry(command_builder, timeout, retries)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_device_status_from_str() {
        assert_eq!(DeviceStatus::from("device"), DeviceStatus::Device);
        assert_eq!(DeviceStatus::from("offline"), DeviceStatus::Offline);
        assert_eq!(
            DeviceStatus::from("unauthorized"),
            DeviceStatus::Unauthorized
        );
    }
}
