// ADB Executor - Wraps adb command execution
// Provides safe, typed interface for running adb commands

use crate::error::{AdbError, AppError};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::Duration;
use wait_timeout::ChildExt;

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
    /// Execute a command with a timeout
    fn run_with_timeout(
        &self,
        cmd: &mut Command,
        timeout: Duration,
    ) -> Result<std::process::Output, AppError> {
        // Ensure we capture output
        cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

        let mut child = cmd
            .spawn()
            .map_err(|e| AppError::from(AdbError::ExecutionFailed(e.to_string())))?;

        match child
            .wait_timeout(timeout)
            .map_err(|e| AppError::from(AdbError::ExecutionFailed(e.to_string())))?
        {
            Some(_) => child
                .wait_with_output()
                .map_err(|e| AppError::from(AdbError::ExecutionFailed(e.to_string()))),
            None => {
                // Timeout occurred
                let _ = child.kill();
                let _ = child.wait();
                Err(AppError::from(AdbError::ExecutionFailed(
                    "Command timed out".to_string(),
                )))
            }
        }
    }

    /// Execute a command with retry logic
    fn run_with_retry<F>(
        &self,
        mut command_builder: F,
        timeout: Duration,
        retries: u32,
    ) -> Result<std::process::Output, AppError>
    where
        F: FnMut() -> Command,
    {
        let mut last_error = AppError::from(AdbError::ExecutionFailed("No attempts made".into()));

        for attempt in 0..=retries {
            if attempt > 0 {
                std::thread::sleep(Duration::from_millis(1000));
            }

            let mut cmd = command_builder();
            // Propagate the executor's adb path if the builder used a generic Command
            // (Assuming the builder sets the program correctly, which it should)

            match self.run_with_timeout(&mut cmd, timeout) {
                Ok(output) => {
                    return Ok(output);
                }
                Err(e) => {
                    // If it's a timeout or execution failure, we retry
                    last_error = e;
                }
            }
        }
        Err(last_error)
    }

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
        let output = self.run_with_retry(
            || {
                let mut cmd = Command::new(&self.adb_path);
                cmd.arg("version");
                cmd
            },
            Duration::from_secs(3),
            1,
        )?;

        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout);
            // Extract first line which contains version
            let first_line = version.lines().next().unwrap_or("Unknown version");
            Ok(first_line.to_string())
        } else {
            Err(AppError::from(AdbError::NotFound))
        }
    }

    /// Get device model and brand info via getprop
    fn get_device_model_info(&self, device_id: &str) -> Option<String> {
        // Helper to run getprop
        let get_prop = |prop: &str| -> Option<String> {
            Command::new(&self.adb_path)
                .args(["-s", device_id, "shell", "getprop", prop])
                .output()
                .ok()
                .filter(|o| o.status.success())
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                .filter(|s| !s.is_empty())
        };

        // Try marketname first (gives "Xiaomi 12 Pro" instead of "23129RAA4G")
        let model = get_prop("ro.product.marketname").or_else(|| get_prop("ro.product.model"));

        let brand = get_prop("ro.product.brand");

        match (brand, model) {
            (Some(b), Some(m)) => {
                // Check if model already contains brand (avoid "Redmi Redmi Note 13")
                if m.to_lowercase().starts_with(&b.to_lowercase()) {
                    Some(m)
                } else {
                    // Capitalize brand
                    let brand_cap = b
                        .chars()
                        .next()
                        .map(|c| c.to_uppercase().collect::<String>())
                        .unwrap_or_default()
                        + &b.chars().skip(1).collect::<String>();
                    Some(format!("{} {}", brand_cap, m))
                }
            }
            (None, Some(m)) => Some(m),
            (Some(b), None) => Some(b),
            (None, None) => None,
        }
    }

    /// List connected devices
    pub fn list_devices(&self) -> Result<Vec<DeviceInfo>, AppError> {
        let output = self.run_with_retry(
            || {
                let mut cmd = Command::new(&self.adb_path);
                cmd.arg("devices").arg("-l");
                cmd
            },
            Duration::from_secs(5),
            2,
        )?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::from(AdbError::ExecutionFailed(
                stderr.to_string(),
            )));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut devices = self.parse_devices_output(&stdout)?;

        // Enrich device info with getprop for devices that are connected
        // Always try to get friendly model name (ro.product.model gives "Xiaomi 12 Pro" instead of "23129RAA4G")
        for device in &mut devices {
            if device.status == DeviceStatus::Device {
                if let Some(model_info) = self.get_device_model_info(&device.id) {
                    device.model = Some(model_info);
                }
            }
        }

        Ok(devices)
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
            Err(AppError::from(AdbError::DeviceNotFound(
                device_id.to_string(),
            )))
        }
    }

    /// Start ADB server
    pub fn start_server(&self) -> Result<(), AppError> {
        let output = self.run_with_retry(
            || {
                let mut cmd = Command::new(&self.adb_path);
                cmd.arg("start-server");
                cmd
            },
            Duration::from_secs(10),
            1,
        )?;

        if output.status.success() {
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(AppError::from(AdbError::ExecutionFailed(
                stderr.to_string(),
            )))
        }
    }

    /// Kill ADB server
    pub fn kill_server(&self) -> Result<(), AppError> {
        let output = self.run_with_retry(
            || {
                let mut cmd = Command::new(&self.adb_path);
                cmd.arg("kill-server");
                cmd
            },
            Duration::from_secs(5),
            1,
        )?;

        if output.status.success() {
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(AppError::from(AdbError::ExecutionFailed(
                stderr.to_string(),
            )))
        }
    }

    /// Get Android setting value
    pub fn get_setting(&self, device_id: &str, namespace: &str, key: &str) -> Option<String> {
        let output = Command::new(&self.adb_path)
            .args(["-s", device_id, "shell", "settings", "get", namespace, key])
            .output()
            .ok()?;

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

    /// Check all requirements for a device
    pub fn check_device_requirements(
        &self,
        device_id: &str,
    ) -> Vec<crate::requirements::RequirementCheck> {
        use crate::requirements::RequirementCheck;

        let mut checks = Vec::new();

        // 1. USB Debugging (check if device is authorized)
        let usb_debug = RequirementCheck::new(
            "usb_debugging",
            "USB Debugging",
            "Device must be authorized for debugging",
        );

        // Check device status
        if let Ok(devices) = self.list_devices() {
            if let Some(device) = devices.iter().find(|d| d.id == device_id) {
                if device.status == DeviceStatus::Device {
                    checks.push(usb_debug.pass());
                } else {
                    checks.push(usb_debug.fail(
                        "Accept the USB debugging prompt on your device, or reconnect the USB cable"
                    ));
                }
            } else {
                checks.push(usb_debug.fail("Device not found. Please reconnect."));
            }
        } else {
            checks.push(usb_debug.fail("Unable to check device status"));
        }

        // Only check other requirements if device is authorized
        if checks.first().map(|c| c.passed).unwrap_or(false) {
            // 2. Developer Options
            let dev_options = RequirementCheck::new(
                "developer_options",
                "Developer Options",
                "Developer Options must be enabled",
            );

            match self.get_setting(device_id, "global", "development_settings_enabled") {
                Some(val) if val == "1" => checks.push(dev_options.pass()),
                _ => checks.push(
                    dev_options.fail("Go to Settings > About Phone > Tap Build Number 7 times"),
                ),
            }

            // 3. Install from Unknown Sources (for older Android versions)
            let unknown_sources = RequirementCheck::new(
                "unknown_sources",
                "Install Unknown Apps",
                "Permission to install apps from unknown sources",
            );

            // Check secure setting (Android < 8)
            let secure_setting = self.get_setting(device_id, "secure", "install_non_market_apps");
            // For Android 8+, this is per-app, so we'll consider it passed if not explicitly "0"
            match secure_setting {
                Some(val) if val == "0" => checks.push(
                    unknown_sources.fail("Go to Settings > Security > Enable 'Unknown Sources'"),
                ),
                _ => checks.push(unknown_sources.pass()), // Assume OK for Android 8+
            }
        }

        checks
    }

    /// Check advanced requirements for action buttons (Input Text, etc.)
    pub fn check_action_requirements(
        &self,
        device_id: &str,
    ) -> Vec<crate::requirements::RequirementCheck> {
        use crate::requirements::RequirementCheck;

        let mut checks = Vec::new();

        // 1. USB Debugging (Security Settings) - Required for Input Text
        // This is a Xiaomi/MIUI specific setting, but we check if input works
        let usb_security = RequirementCheck::new(
            "usb_debug_security",
            "USB Debugging (Security)",
            "Required for Input Text and some advanced actions",
        );

        // Try to send a test input to check if it works
        let test_result = std::process::Command::new(self.get_adb_path())
            .args(["-s", device_id, "shell", "input", "keyevent", "0"])
            .output();

        match test_result {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                let combined = format!("{}{}", stdout, stderr);

                if combined.contains("INJECT_EVENTS") || combined.contains("SecurityException") {
                    checks.push(
                        usb_security.fail(
                            "Enable 'USB debugging (Security settings)' in Developer Options",
                        ),
                    );
                } else if combined.contains("Exception") || combined.contains("error") {
                    checks.push(usb_security.fail(
                        "Enable 'USB debugging (Security settings)' or 'Disable permission monitoring'"
                    ));
                } else {
                    checks.push(usb_security.pass());
                }
            }
            Err(_) => {
                checks.push(usb_security.fail("Unable to test input capability"));
            }
        }

        checks
    }

    /// Install APK on device
    pub fn install_apk(&self, device_id: &str, apk_path: &str) -> crate::apk::InstallResult {
        use crate::apk::{map_install_error, InstallResult};

        // Verify APK file exists
        if !std::path::Path::new(apk_path).exists() {
            return InstallResult::failure(device_id, "APK file not found", None);
        }

        let output = self.run_with_retry(
            || {
                let mut cmd = Command::new(&self.adb_path);
                cmd.args(["-s", device_id, "install", "-r", apk_path]);
                cmd
            },
            Duration::from_secs(120),
            0,
        );

        match output {
            Ok(result) => {
                let stdout = String::from_utf8_lossy(&result.stdout);
                let stderr = String::from_utf8_lossy(&result.stderr);
                let combined = format!("{}{}", stdout, stderr);

                if result.status.success() && combined.contains("Success") {
                    InstallResult::success(device_id, "APK installed successfully")
                } else {
                    let (message, error_code) = map_install_error(&combined);
                    InstallResult::failure(device_id, &message, error_code.as_deref())
                }
            }
            Err(e) => InstallResult::failure(device_id, &format!("Failed to run adb: {}", e), None),
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
        let output =
            "List of devices attached\nemulator-5554    device product:sdk model:sdk_phone\n";
        let devices = executor.parse_devices_output(output).unwrap();
        assert_eq!(devices.len(), 1);
        assert_eq!(devices[0].id, "emulator-5554");
        assert_eq!(devices[0].status, DeviceStatus::Device);
    }

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
