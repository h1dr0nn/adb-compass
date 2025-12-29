// Device Tracker - Real-time device tracking using adb track-devices
// Spawns adb track-devices as background process and emits events on device changes

use std::io::{BufRead, BufReader};
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

use crate::adb::executor::{AdbExecutor, DeviceInfo, DeviceStatus};
use crate::command_utils::hidden_command;

/// Debounce delay to avoid rapid successive device list fetches
const DEBOUNCE_MS: u64 = 500;

/// Event payload for device changes
#[derive(Clone, serde::Serialize)]
pub struct DeviceChangedPayload {
    pub devices: Vec<DeviceInfo>,
}

/// Start the device tracker in a background thread
pub fn start_device_tracker(app: AppHandle) {
    let running = Arc::new(AtomicBool::new(true));
    let last_devices = Arc::new(Mutex::new(Vec::<DeviceInfo>::new()));

    let running_clone = running.clone();
    let last_devices_clone = last_devices.clone();
    let app_handle = app.clone();

    // Store state for cleanup
    app.manage(DeviceTrackerState { running });

    // Thread 1: Official ADB tracker (Events-driven)
    thread::spawn(move || {
        run_tracker(app_handle, running_clone, last_devices_clone);
    });
}

/// State for the device tracker
pub struct DeviceTrackerState {
    pub running: Arc<AtomicBool>,
}

/// Helper to emit if list changed
fn emit_if_changed(
    app: &AppHandle,
    executor: &AdbExecutor,
    last_devices: &Arc<Mutex<Vec<DeviceInfo>>>,
) {
    if let Ok(devices) = executor.list_devices() {
        let mut last = last_devices.lock().unwrap();
        if *last != devices {
            *last = devices.clone();
            let _ = app.emit("device-changed", DeviceChangedPayload { devices });
        }
    }
}

/// Main tracker loop
fn run_tracker(
    app: AppHandle,
    running: Arc<AtomicBool>,
    last_devices: Arc<Mutex<Vec<DeviceInfo>>>,
) {
    let executor = AdbExecutor::new();
    let adb_path = executor.get_adb_path().clone();
    let mut last_emit_time = Instant::now() - Duration::from_secs(10);

    // Spawn a subordinate heartbeat thread for this tracker session
    let app_heartbeat = app.clone();
    let running_heartbeat = running.clone();
    let last_devices_heartbeat = last_devices.clone();

    thread::spawn(move || {
        let executor = AdbExecutor::new();
        loop {
            if !running_heartbeat.load(Ordering::Relaxed) {
                break;
            }

            // Check if we have any "transitional" devices
            let has_transitional = {
                let last = last_devices_heartbeat.lock().unwrap();
                last.iter().any(|d| {
                    matches!(
                        d.status,
                        DeviceStatus::Unauthorized | DeviceStatus::Unknown(_)
                    )
                })
            };

            // Fast poll (2s) if transitional, slow poll (10s) otherwise
            let sleep_secs = if has_transitional { 2 } else { 10 };
            thread::sleep(Duration::from_secs(sleep_secs));

            if !running_heartbeat.load(Ordering::Relaxed) {
                break;
            }
            emit_if_changed(&app_heartbeat, &executor, &last_devices_heartbeat);
        }
    });

    loop {
        if !running.load(Ordering::Relaxed) {
            break;
        }

        let child = hidden_command(&adb_path)
            .arg("track-devices")
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn();

        match child {
            Ok(mut child) => {
                if let Some(stdout) = child.stdout.take() {
                    let reader = BufReader::new(stdout);

                    for line in reader.lines() {
                        if !running.load(Ordering::Relaxed) {
                            let _ = child.kill();
                            break;
                        }

                        match line {
                            Ok(text) => {
                                if !text.trim().is_empty() {
                                    let now = Instant::now();
                                    if now.duration_since(last_emit_time)
                                        >= Duration::from_millis(DEBOUNCE_MS)
                                    {
                                        emit_if_changed(&app, &executor, &last_devices);
                                        last_emit_time = now;
                                    }
                                }
                            }
                            Err(_) => break,
                        }
                    }
                }
                if running.load(Ordering::Relaxed) {
                    thread::sleep(Duration::from_secs(1));
                }
            }
            Err(e) => {
                eprintln!("Failed to start track-devices: {}", e);
                thread::sleep(Duration::from_secs(5));
            }
        }
    }
}
