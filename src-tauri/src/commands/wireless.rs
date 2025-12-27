// Wireless ADB Commands
// Handles wireless ADB connection/disconnection

use crate::adb::AdbExecutor;
use crate::command_utils::hidden_command;

/// Enable TCP/IP mode on a USB-connected device
#[tauri::command]
pub async fn enable_tcpip(device_id: String, port: String) -> Result<String, String> {
    let adb = AdbExecutor::new();
    let port_num: u16 = port.parse().unwrap_or(5555);

    let output = hidden_command(adb.get_adb_path())
        .args(["-s", &device_id, "tcpip", &port_num.to_string()])
        .output()
        .map_err(|e| format!("Failed to enable tcpip: {}", e))?;

    if output.status.success() {
        Ok(format!("TCP/IP mode enabled on port {}", port_num))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to enable TCP/IP: {}", stderr))
    }
}

/// Connect to a device wirelessly
#[tauri::command]
pub async fn connect_wireless(ip: String, port: String) -> Result<String, String> {
    let adb = AdbExecutor::new();
    let address = format!("{}:{}", ip, port);

    let output = hidden_command(adb.get_adb_path())
        .args(["connect", &address])
        .output()
        .map_err(|e| format!("Connection failed: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let result = stdout.trim().to_string();

    if result.contains("connected") || result.contains("already connected") {
        Ok(result)
    } else {
        Err(if result.is_empty() {
            "Connection failed - no response".to_string()
        } else {
            result
        })
    }
}

/// Disconnect a wirelessly connected device
#[tauri::command]
pub async fn disconnect_wireless(ip: String, port: String) -> Result<String, String> {
    let adb = AdbExecutor::new();
    let address = format!("{}:{}", ip, port);

    let output = hidden_command(adb.get_adb_path())
        .args(["disconnect", &address])
        .output()
        .map_err(|e| format!("Disconnect failed: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.trim().to_string())
}

/// Get device IP address (for display in UI)
/// Get device IP address (for display in UI)
#[tauri::command]
pub async fn get_device_ip(device_id: String) -> Result<String, String> {
    let adb = AdbExecutor::new();

    // Strategy 1: Try to find the interface route to the internet (most reliable for active connection)
    // Run: adb shell ip route get 8.8.8.8
    let output = hidden_command(adb.get_adb_path())
        .args(["-s", &device_id, "shell", "ip", "route", "get", "8.8.8.8"])
        .output();

    if let Ok(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        // Output format: "8.8.8.8 via ... dev wlan0 src 192.168.1.5 uid ..."
        if let Some(src_pos) = stdout.find("src ") {
            let rest = &stdout[src_pos + 4..];
            if let Some(ip) = rest.split_whitespace().next() {
                return Ok(ip.to_string());
            }
        }
    }

    // Strategy 2: Fallback to listing specific interfaces (wlan0, eth0)
    for interface in ["wlan0", "eth0", "wlan1"] {
        let output = hidden_command(adb.get_adb_path())
            .args(["-s", &device_id, "shell", "ip", "addr", "show", interface])
            .output();

        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                if line.trim().starts_with("inet ") {
                    if let Some(ip_simple) = line.split_whitespace().nth(1) {
                        // remove CIDR suffix (e.g. /24)
                        let ip = ip_simple.split('/').next().unwrap_or(ip_simple);
                        return Ok(ip.to_string());
                    }
                }
            }
        }
    }

    // Strategy 3: Gross fallback to 'ifconfig' (older devices)
    let output = hidden_command(adb.get_adb_path())
        .args(["-s", &device_id, "shell", "ifconfig", "wlan0"])
        .output();

    if let Ok(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        // "inet addr:192.168.1.5 ..."
        if let Some(addr_pos) = stdout.find("addr:") {
            let rest = &stdout[addr_pos + 5..];
            if let Some(ip) = rest.split_whitespace().next() {
                return Ok(ip.to_string());
            }
        }
    }

    // Strategy 4: Broad scan of ALL interfaces (ignoring loopback)
    let output = hidden_command(adb.get_adb_path())
        .args(["-s", &device_id, "shell", "ip", "addr", "show"])
        .output();

    if let Ok(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        // Look for any "inet " that is NOT 127.0.0.1
        for line in stdout.lines() {
            if line.trim().contains("inet ") && !line.contains("127.0.0.1") {
                // split_whitespace returns an iterator directly, no need for .iter()
                if let Some(ip_part) = line.split_whitespace().find(|p| p.contains('.')) {
                    // ip_part might be "192.168.1.5/24" or "addr:192..."
                    let clean_ip = ip_part.replace("addr:", "");
                    let ip = clean_ip.split('/').next().unwrap_or(&clean_ip);
                    let ip_str = ip.to_string();
                    // Filter out unlikely IPs if needed, but for now take first valid looking one
                    if ip_str.split('.').count() == 4 {
                        return Ok(ip_str);
                    }
                }
            }
        }
    }

    Err("Could not determine IP. Ensure WiFi is connected.".to_string())
}
