use crate::adb::AdbExecutor;
use crate::command_utils::hidden_command;
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Child, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, Runtime, State};

pub struct LogcatState {
    pub streams: Arc<Mutex<HashMap<String, Child>>>,
}

impl LogcatState {
    pub fn new() -> Self {
        Self {
            streams: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[derive(Clone, serde::Serialize)]
pub struct LogLinePayload {
    pub device_id: String,
    pub line: String,
}

#[tauri::command]
pub async fn start_logcat_stream<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, LogcatState>,
    device_id: String,
) -> Result<(), String> {
    let mut streams = state.streams.lock().unwrap();

    // Stop existing stream for this device if any
    if let Some(mut child) = streams.remove(&device_id) {
        let _ = child.kill();
    }

    let adb = AdbExecutor::new();
    let adb_path = adb.get_adb_path().to_string_lossy().to_string();

    let mut child = hidden_command(adb_path)
        .args(["-s", &device_id, "logcat", "-v", "time"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn logcat: {}", e))?;

    let stdout = child
        .stdout
        .take()
        .ok_or("Failed to capture logcat stdout")?;

    streams.insert(device_id.clone(), child);

    let device_id_clone = device_id.clone();
    let app_handle = app.clone();

    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            match line {
                Ok(text) => {
                    // Skip empty lines or headers
                    if text.trim().is_empty() || text.contains("--------- beginning of") {
                        continue;
                    }
                    let _ = app_handle.emit(
                        &format!("logcat-line-{}", device_id_clone),
                        LogLinePayload {
                            device_id: device_id_clone.clone(),
                            line: text,
                        },
                    );
                }
                Err(_) => break,
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_logcat_stream(
    state: State<'_, LogcatState>,
    device_id: String,
) -> Result<(), String> {
    let mut streams = state.streams.lock().unwrap();
    if let Some(mut child) = streams.remove(&device_id) {
        let _ = child.kill();
    }
    Ok(())
}

#[tauri::command]
pub async fn export_logcat() -> Result<(), String> {
    // This will be handled by the frontend using tauri-plugin-dialog
    Ok(())
}
