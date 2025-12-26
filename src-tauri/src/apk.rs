// APK Module - APK file handling and installation
// Manages APK validation and installation process

use serde::Serialize;
use std::path::Path;

/// Information about an APK file
#[derive(Debug, Clone, Serialize)]
pub struct ApkInfo {
    pub path: String,
    pub file_name: String,
    pub size_bytes: u64,
    pub valid: bool,
    pub last_modified: Option<u128>,
}

impl ApkInfo {
    pub fn from_path(path: &str) -> Option<Self> {
        let path_obj = Path::new(path);

        if !path_obj.exists() {
            return None;
        }

        let file_name = path_obj
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown.apk")
            .to_string();

        let metadata = std::fs::metadata(path).ok()?;
        let size_bytes = metadata.len();

        let last_modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis());

        let valid = path_obj
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase() == "apk")
            .unwrap_or(false);

        Some(Self {
            path: path.to_string(),
            file_name,
            size_bytes,
            valid,
            last_modified,
        })
    }
}

/// Result of an APK installation
#[derive(Debug, Clone, Serialize)]
pub struct InstallResult {
    pub success: bool,
    pub device_id: String,
    pub message: String,
    pub error_code: Option<String>,
}

impl InstallResult {
    pub fn success(device_id: &str, message: &str) -> Self {
        Self {
            success: true,
            device_id: device_id.to_string(),
            message: message.to_string(),
            error_code: None,
        }
    }

    pub fn failure(device_id: &str, message: &str, error_code: Option<&str>) -> Self {
        Self {
            success: false,
            device_id: device_id.to_string(),
            message: message.to_string(),
            error_code: error_code.map(|s| s.to_string()),
        }
    }
}

/// Map ADB install error codes to user-friendly messages
pub fn map_install_error(error_output: &str) -> (String, Option<String>) {
    let error_mappings = [
        (
            "INSTALL_FAILED_ALREADY_EXISTS",
            "App is already installed. Try uninstalling first.",
        ),
        (
            "INSTALL_FAILED_INSUFFICIENT_STORAGE",
            "Not enough storage space on device.",
        ),
        (
            "INSTALL_FAILED_INVALID_APK",
            "Invalid or corrupted APK file.",
        ),
        (
            "INSTALL_FAILED_VERSION_DOWNGRADE",
            "Cannot install older version over newer one.",
        ),
        (
            "INSTALL_FAILED_USER_RESTRICTED",
            "Installation blocked by device policy.",
        ),
        (
            "INSTALL_FAILED_UPDATE_INCOMPATIBLE",
            "Update incompatible with installed version.",
        ),
        (
            "INSTALL_PARSE_FAILED_NO_CERTIFICATES",
            "APK is not signed properly.",
        ),
        (
            "INSTALL_FAILED_OLDER_SDK",
            "App requires newer Android version.",
        ),
        (
            "INSTALL_FAILED_CONFLICTING_PROVIDER",
            "Conflicts with another installed app.",
        ),
        (
            "INSTALL_FAILED_NO_MATCHING_ABIS",
            "App not compatible with device architecture.",
        ),
    ];

    for (code, message) in error_mappings {
        if error_output.contains(code) {
            return (message.to_string(), Some(code.to_string()));
        }
    }

    // Default error message
    (
        "Installation failed. Check device connection and try again.".to_string(),
        None,
    )
}
