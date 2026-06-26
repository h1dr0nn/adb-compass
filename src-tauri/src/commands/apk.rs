// APK Commands - Tauri commands for APK handling
// Handles APK validation and installation

use crate::adb::AdbExecutor;
use crate::apk::{ApkInfo, InstallResult};

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

/// Global state to manage the active directory watcher for APK folder
pub struct ApkWatcherState {
    pub watcher: Mutex<Option<RecommendedWatcher>>,
}

/// Validate APK file and return info
#[tauri::command]
pub async fn validate_apk(path: String) -> Option<ApkInfo> {
    ApkInfo::from_path(&path)
}

/// Install APK on a specific device
#[tauri::command]
pub async fn install_apk(device_id: String, apk_path: String) -> InstallResult {
    let executor = AdbExecutor::new();
    executor.install_apk(&device_id, &apk_path)
}

/// Scan a folder for APK files and set up a file watcher
#[tauri::command]
pub async fn scan_apks_in_folder(
    app: AppHandle,
    state: State<'_, ApkWatcherState>,
    path: String,
) -> Result<Vec<ApkInfo>, String> {
    let mut apks = Vec::new();
    let path_buf = std::path::PathBuf::from(&path);

    if let Ok(entries) = std::fs::read_dir(&path_buf) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if entry_path.is_file() {
                if let Some(ext) = entry_path.extension() {
                    if ext.to_string_lossy().to_lowercase() == "apk" {
                        if let Some(path_str) = entry_path.to_str() {
                            if let Some(info) = ApkInfo::from_path(path_str) {
                                if info.valid {
                                    apks.push(info);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Set up file watcher for this folder
    let app_clone = app.clone();
    let path_clone = path.clone();

    let watcher_res =
        notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
            if let Ok(event) = res {
                // We care about file creation, deletion, or modification of .apk files
                let has_apk_change = event.paths.iter().any(|p| {
                    p.extension()
                        .map(|ext| ext.to_string_lossy().to_lowercase() == "apk")
                        .unwrap_or(false)
                });

                if has_apk_change {
                    // Emit event to frontend
                    let _ = app_clone.emit("apk-folder-changed", path_clone.clone());
                }
            }
        });

    match watcher_res {
        Ok(mut watcher) => {
            if let Ok(_) = watcher.watch(&path_buf, RecursiveMode::NonRecursive) {
                let mut guard = state.watcher.lock().unwrap();
                *guard = Some(watcher);
            }
        }
        Err(e) => {
            println!("Failed to create directory watcher: {:?}", e);
        }
    }

    Ok(apks)
}
