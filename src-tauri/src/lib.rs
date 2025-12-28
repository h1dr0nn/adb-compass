// ADB Compass - Main Library
// Entry point for the Tauri application

pub mod adb;
pub mod apk;
pub mod command_utils;
pub mod commands;
pub mod error;
pub mod requirements;

use adb::{start_device_tracker, AdbExecutor};
use commands::{
    check_action_requirements,
    check_adb_status,
    check_device_requirements,
    // Shell
    clear_logcat,
    // Wireless
    connect_wireless,
    create_remote_directory,
    delete_remote_file,
    disconnect_wireless,
    enable_tcpip,
    execute_shell,
    get_device_ip,
    get_device_property,
    get_device_props,
    get_devices,
    get_logcat,
    // Screen Capture
    get_screen_frame,
    input_text,
    install_apk,
    kill_adb_server,
    // File Transfer
    list_files,
    list_packages,
    pull_file,
    push_file,
    // Device Actions
    reboot_device,
    refresh_devices,
    scan_apks_in_folder,
    start_adb_server,
    start_screen_recording,
    stop_screen_recording,
    take_screenshot,
    uninstall_app,
    validate_apk,
};
use tauri::RunEvent;

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
            check_action_requirements,
            validate_apk,
            install_apk,
            scan_apks_in_folder,
            // Device Actions
            reboot_device,
            input_text,
            uninstall_app,
            list_packages,
            get_device_props,
            // File Transfer
            list_files,
            push_file,
            pull_file,
            delete_remote_file,
            create_remote_directory,
            // Wireless
            connect_wireless,
            disconnect_wireless,
            enable_tcpip,
            get_device_ip,
            // Shell
            execute_shell,
            get_logcat,
            clear_logcat,
            // Screen Capture
            take_screenshot,
            start_screen_recording,
            stop_screen_recording,
            get_screen_frame
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let RunEvent::Exit = event {
                // Kill ADB server when app closes to prevent orphan processes
                let executor = AdbExecutor::new();
                let _ = executor.kill_server();
            }
        });
}
