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
