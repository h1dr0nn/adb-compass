// Scrcpy Commands - High-performance screen mirroring
// Commands for starting/stopping scrcpy server and streaming

use crate::error::AppError;
use crate::services::scrcpy::{self, ScrcpyConfig, ScrcpyStatus};
use tauri::AppHandle;

/// Start scrcpy server on a device
#[tauri::command]
pub fn start_scrcpy_server(
    device_id: String,
    max_size: Option<u32>,
    bit_rate: Option<u32>,
    max_fps: Option<u8>,
    app_handle: AppHandle,
) -> Result<ScrcpyStatus, AppError> {
    let mut config = ScrcpyConfig::default();

    if let Some(size) = max_size {
        config.max_size = size;
    }
    if let Some(rate) = bit_rate {
        config.bit_rate = rate;
    }
    if let Some(fps) = max_fps {
        config.max_fps = fps;
    }

    scrcpy::start_server(&device_id, config, &app_handle)
}

/// Stop scrcpy server for a device
#[tauri::command]
pub fn stop_scrcpy_server(device_id: String) -> Result<(), AppError> {
    scrcpy::stop_server(&device_id)
}

/// Get scrcpy status for a device
#[tauri::command]
pub fn get_scrcpy_status(device_id: String) -> ScrcpyStatus {
    scrcpy::get_status(&device_id)
}

/// Read a chunk of video data from the scrcpy stream
#[tauri::command]
pub fn read_scrcpy_frame(device_id: String) -> Result<Vec<u8>, AppError> {
    scrcpy::read_video_frame(&device_id)
}

/// Send a touch event to the device via scrcpy
#[tauri::command]
pub fn scrcpy_touch(
    device_id: String,
    action: u8, // 0 = down, 1 = up, 2 = move
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> Result<(), AppError> {
    // Scrcpy touch event format:
    // type(1) + action(1) + pointerId(8) + position(12) + screenSize(8) + pressure(2) + buttons(4)
    let mut data = Vec::with_capacity(36);

    // Action
    data.push(action);

    // Pointer ID (8 bytes, big endian) - using 0
    data.extend_from_slice(&0u64.to_be_bytes());

    // Position - x, y as fixed point (4 bytes each)
    let x_fixed = ((x as u64) << 16) / width as u64;
    let y_fixed = ((y as u64) << 16) / height as u64;
    data.extend_from_slice(&(x_fixed as u32).to_be_bytes());
    data.extend_from_slice(&(y_fixed as u32).to_be_bytes());

    // Screen size
    data.extend_from_slice(&(width as u16).to_be_bytes());
    data.extend_from_slice(&(height as u16).to_be_bytes());

    // Pressure (2 bytes) - 0xFFFF for max
    data.extend_from_slice(&0xFFFFu16.to_be_bytes());

    // Buttons (4 bytes) - 0 for none
    data.extend_from_slice(&0u32.to_be_bytes());

    scrcpy::send_control_event(&device_id, 2, &data) // 2 = INJECT_TOUCH_EVENT
}

/// Send a scroll event to the device via scrcpy
#[tauri::command]
pub fn scrcpy_scroll(
    device_id: String,
    x: u32,
    y: u32,
    h_scroll: i32,
    v_scroll: i32,
    width: u32,
    height: u32,
) -> Result<(), AppError> {
    // Scrcpy scroll event format:
    // position(12) + screenSize(8) + hScroll(4) + vScroll(4) + buttons(4)
    let mut data = Vec::with_capacity(32);

    // Position
    let x_fixed = ((x as u64) << 16) / width as u64;
    let y_fixed = ((y as u64) << 16) / height as u64;
    data.extend_from_slice(&(x_fixed as u32).to_be_bytes());
    data.extend_from_slice(&(y_fixed as u32).to_be_bytes());

    // Screen size
    data.extend_from_slice(&(width as u16).to_be_bytes());
    data.extend_from_slice(&(height as u16).to_be_bytes());

    // Scroll amounts
    data.extend_from_slice(&h_scroll.to_be_bytes());
    data.extend_from_slice(&v_scroll.to_be_bytes());

    // Buttons
    data.extend_from_slice(&0u32.to_be_bytes());

    scrcpy::send_control_event(&device_id, 3, &data) // 3 = INJECT_SCROLL_EVENT
}
