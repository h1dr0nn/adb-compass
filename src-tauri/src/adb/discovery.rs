// ADB Discovery - Device enumeration and property retrieval
// Handles parsing adb devices output and enriching with getprop info.

use crate::adb::client::AdbClient;
use crate::adb::command_builder::{AdbCommand, AdbCommandBuilder};
use crate::adb::executor::{DeviceInfo, DeviceStatus};
use crate::error::AppError;

/// Handles discovering and identifying connected Android devices.
pub struct AdbDiscovery<'a> {
    client: &'a AdbClient,
}

impl<'a> AdbDiscovery<'a> {
    /// Create a new discovery instance using the provided client.
    pub fn new(client: &'a AdbClient) -> Self {
        Self { client }
    }

    /// List all connected devices with their basic status and optional properties.
    pub fn list_devices(&self) -> Result<Vec<DeviceInfo>, AppError> {
        let output = self.client.execute(&["devices", "-l"])?;
        let stdout = String::from_utf8_lossy(&output.stdout);

        let mut devices = self.parse_devices_output(&stdout);

        // Enrich device info for connected devices
        for device in &mut devices {
            if device.status == DeviceStatus::Device {
                if let Some(model_info) = self.get_device_model_info(&device.id) {
                    device.model = Some(model_info);
                }
            }
        }

        Ok(devices)
    }

    /// Parse the output of `adb devices -l`.
    fn parse_devices_output(&self, output: &str) -> Vec<DeviceInfo> {
        let mut devices = Vec::new();

        for line in output.lines().skip(1) {
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

        devices
    }

    /// Retrieve detailed model information using getprop.
    fn get_device_model_info(&self, device_id: &str) -> Option<String> {
        let fetch_prop = |prop: &str| -> Option<String> {
            let builder = AdbCommandBuilder::new().target(device_id);
            let args = builder.build(AdbCommand::GetProp(prop.to_string()));
            let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

            self.client
                .execute(&args_refs)
                .ok()
                .filter(|o| o.status.success())
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                .filter(|s| !s.is_empty())
        };

        let model = fetch_prop("ro.product.marketname").or_else(|| fetch_prop("ro.product.model"));
        let brand = fetch_prop("ro.product.brand");

        match (brand, model) {
            (Some(b), Some(m)) => {
                if m.to_lowercase().starts_with(&b.to_lowercase()) {
                    Some(m)
                } else {
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
}
