// ADB Compass - Main Library
// Entry point for the Tauri application

pub mod adb;
pub mod commands;
pub mod error;

use commands::{
    check_adb_status, get_devices, refresh_devices, 
    get_device_property, start_adb_server, kill_adb_server
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            check_adb_status,
            get_devices,
            refresh_devices,
            get_device_property,
            start_adb_server,
            kill_adb_server
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
