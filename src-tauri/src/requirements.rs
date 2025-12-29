// Requirements Module - Device requirement checking
// Validates device settings required for APK installation

use serde::Serialize;

/// A single requirement check result
#[derive(Debug, Clone, Serialize)]
pub struct RequirementCheck {
    pub id: String,
    pub name: String,
    pub description: String,
    pub passed: bool,
    pub hint: Option<String>,
}

impl RequirementCheck {
    pub fn new(id: &str, name: &str, description: &str) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            description: description.to_string(),
            passed: false,
            hint: None,
        }
    }

    pub fn pass(mut self) -> Self {
        self.passed = true;
        self.hint = None;
        self
    }

    pub fn fail(mut self, hint: &str) -> Self {
        self.passed = false;
        self.hint = Some(hint.to_string());
        self
    }
}

/// All requirements for a device
#[derive(Debug, Clone, Serialize)]
pub struct DeviceRequirements {
    pub device_id: String,
    pub checks: Vec<RequirementCheck>,
    pub all_passed: bool,
}

impl DeviceRequirements {
    pub fn new(device_id: &str, checks: Vec<RequirementCheck>) -> Self {
        let all_passed = checks.iter().all(|c| c.passed);
        Self {
            device_id: device_id.to_string(),
            checks,
            all_passed,
        }
    }
}

/// Checker for device requirements
pub struct RequirementChecker<'a> {
    executor: &'a crate::adb::AdbExecutor,
}

impl<'a> RequirementChecker<'a> {
    pub fn new(executor: &'a crate::adb::AdbExecutor) -> Self {
        Self { executor }
    }

    /// Check all base requirements for a device (USB debugging, Dev options, etc)
    pub fn check_device_requirements(&self, device_id: &str) -> Vec<RequirementCheck> {
        let mut checks = Vec::new();

        // 1. USB Debugging
        let usb_debug = RequirementCheck::new(
            "usb_debugging",
            "USB Debugging",
            "Device must be authorized for debugging",
        );

        if let Ok(devices) = self.executor.list_devices() {
            if let Some(device) = devices.iter().find(|d| d.id == device_id) {
                if device.status == crate::adb::executor::DeviceStatus::Device {
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

        // Only check others if authorized
        if checks.first().map(|c| c.passed).unwrap_or(false) {
            // 2. Developer Options
            let dev_options = RequirementCheck::new(
                "developer_options",
                "Developer Options",
                "Developer Options must be enabled",
            );

            match self
                .executor
                .get_setting(device_id, "global", "development_settings_enabled")
            {
                Some(val) if val == "1" => checks.push(dev_options.pass()),
                _ => checks.push(
                    dev_options.fail("Go to Settings > About Phone > Tap Build Number 7 times"),
                ),
            }

            // 3. Install from Unknown Sources
            let unknown_sources = RequirementCheck::new(
                "unknown_sources",
                "Install Unknown Apps",
                "Permission to install apps from unknown sources",
            );

            let secure_setting =
                self.executor
                    .get_setting(device_id, "secure", "install_non_market_apps");
            match secure_setting {
                Some(val) if val == "0" => checks.push(
                    unknown_sources.fail("Go to Settings > Security > Enable 'Unknown Sources'"),
                ),
                _ => checks.push(unknown_sources.pass()),
            }
        }

        checks
    }

    /// Check advanced requirements for action buttons
    pub fn check_action_requirements(&self, device_id: &str) -> Vec<RequirementCheck> {
        let mut checks = Vec::new();

        let usb_security = RequirementCheck::new(
            "usb_debug_security",
            "USB Debugging (Security)",
            "Required for Input Text and some advanced actions",
        );

        // Test input capability
        let test_args = ["-s", device_id, "shell", "input", "keyevent", "0"];
        let test_result = std::process::Command::new(self.executor.get_adb_path())
            .args(&test_args)
            .hide_window()
            .output();

        use crate::command_utils::CommandExt2;

        match test_result {
            Ok(output) => {
                let combined = format!(
                    "{}{}",
                    String::from_utf8_lossy(&output.stdout),
                    String::from_utf8_lossy(&output.stderr)
                );
                if combined.contains("INJECT_EVENTS") || combined.contains("SecurityException") {
                    checks.push(
                        usb_security.fail(
                            "Enable 'USB debugging (Security settings)' in Developer Options",
                        ),
                    );
                } else if combined.contains("Exception") || combined.contains("error") {
                    checks.push(usb_security.fail("Enable 'USB debugging (Security settings)' or 'Disable permission monitoring'"));
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
}
