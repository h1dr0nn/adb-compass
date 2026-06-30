// APK Commands - Tauri commands for APK handling
// Handles APK validation and installation

use crate::adb::AdbExecutor;
use crate::apk::{ApkInfo, InstallResult};

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
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

/// Extract the APK's launcher icon as a data URL (best effort).
#[tauri::command]
pub async fn get_apk_icon(path: String) -> Option<String> {
    tokio::task::spawn_blocking(move || crate::apk::extract_apk_icon(&path))
        .await
        .ok()
        .flatten()
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
                    let ext = ext.to_string_lossy().to_lowercase();
                    if matches!(ext.as_str(), "apk" | "xapk" | "apks" | "apkm") {
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

    // Set up file watcher for this folder. Debounce bursts (a single file copy
    // fires Create + several Modify events) into one emit so the frontend does
    // not rescan-thrash or read a half-written APK.
    let app_clone = app.clone();
    let path_clone = path.clone();
    let last_emit: Arc<Mutex<Option<Instant>>> = Arc::new(Mutex::new(None));
    const DEBOUNCE: Duration = Duration::from_millis(400);

    let watcher_res =
        notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
            if let Ok(event) = res {
                // Emit on any change in the (non-recursive) folder. Renames and
                // deletes don't always carry an installable extension, and the
                // folder holds .apk/.xapk/.apks/.apkm — so let the frontend
                // re-scan and decide rather than filtering by extension here.
                if matches!(
                    event.kind,
                    notify::EventKind::Access(_)
                ) {
                    return; // ignore pure read/access events
                }

                let now = Instant::now();
                let should_emit = {
                    let mut guard = last_emit.lock().unwrap_or_else(|e| e.into_inner());
                    let ready = guard.map(|t| now.duration_since(t) >= DEBOUNCE).unwrap_or(true);
                    if ready {
                        *guard = Some(now);
                    }
                    ready
                };
                if should_emit {
                    let _ = app_clone.emit("apk-folder-changed", path_clone.clone());
                }
            }
        });

    match watcher_res {
        Ok(mut watcher) => match watcher.watch(&path_buf, RecursiveMode::NonRecursive) {
            Ok(_) => {
                let mut guard = state.watcher.lock().unwrap_or_else(|e| e.into_inner());
                *guard = Some(watcher);
            }
            Err(e) => {
                eprintln!("Failed to watch APK folder {:?}: {:?}", path_buf, e);
            }
        },
        Err(e) => {
            eprintln!("Failed to create directory watcher: {:?}", e);
        }
    }

    Ok(apks)
}
