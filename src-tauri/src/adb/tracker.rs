// Device Tracker - Real-time device tracking using adb track-devices
// Spawns adb track-devices as background process and emits events on device changes

use std::io::{BufRead, BufReader};
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use tauri::{AppHandle, Emitter, Manager};

use crate::adb::executor::{AdbExecutor, DeviceInfo};
use crate::command_utils::hidden_command;

/// Event payload for device changes
#[derive(Clone, serde::Serialize)]
pub struct DeviceChangedPayload {
    pub devices: Vec<DeviceInfo>,
}

/// Start the device tracker in a background thread
pub fn start_device_tracker(app: AppHandle) {
    let running = Arc::new(AtomicBool::new(true));
    let running_clone = running.clone();

    // Store the running flag in app state for cleanup
    app.manage(DeviceTrackerState { running });

    thread::spawn(move || {
        run_tracker(app, running_clone);
    });
}

/// State for the device tracker
pub struct DeviceTrackerState {
    pub running: Arc<AtomicBool>,
}

/// Main tracker loop
fn run_tracker(app: AppHandle, running: Arc<AtomicBool>) {
    let executor = AdbExecutor::new();
    let adb_path = executor.get_adb_path().clone();

    loop {
        if !running.load(Ordering::Relaxed) {
            break;
        }

        // Spawn adb track-devices with hidden window on Windows
        let child = hidden_command(&adb_path)
            .arg("track-devices")
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn();

        match child {
            Ok(mut child) => {
                if let Some(stdout) = child.stdout.take() {
                    let reader = BufReader::new(stdout);

                    // Read lines from track-devices output
                    for line in reader.lines() {
                        if !running.load(Ordering::Relaxed) {
                            let _ = child.kill();
                            break;
                        }

                        match line {
                            Ok(text) => {
                                // track-devices outputs length-prefixed messages
                                // but we can also just refresh device list on any output
                                if !text.trim().is_empty() {
                                    // Fetch full device info and emit event
                                    if let Ok(devices) = executor.list_devices() {
                                        let _ = app.emit(
                                            "device-changed",
                                            DeviceChangedPayload { devices },
                                        );
                                    }
                                }
                            }
                            Err(_) => break,
                        }
                    }
                }

                // Wait a bit before restarting if the process ended
                if running.load(Ordering::Relaxed) {
                    thread::sleep(std::time::Duration::from_secs(1));
                }
            }
            Err(e) => {
                eprintln!("Failed to start track-devices: {}", e);
                // Wait before retrying
                thread::sleep(std::time::Duration::from_secs(5));
            }
        }
    }
}
