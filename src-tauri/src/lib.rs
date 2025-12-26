// ADB Compass - Main Library
// Entry point for the Tauri application

pub mod adb;
pub mod apk;
pub mod commands;
pub mod error;
pub mod requirements;

use adb::start_device_tracker;
use commands::{
    check_adb_status, check_device_requirements, get_device_property, get_devices, install_apk,
    kill_adb_server, refresh_devices, start_adb_server, validate_apk,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Start real-time device tracking
            start_device_tracker(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_adb_status,
            get_devices,
            refresh_devices,
            get_device_property,
            start_adb_server,
            kill_adb_server,
            check_device_requirements,
            validate_apk,
            install_apk
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
