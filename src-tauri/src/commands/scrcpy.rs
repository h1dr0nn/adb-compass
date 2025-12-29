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
    // Type 2 = INJECT_TOUCH_EVENT: type(1) + action(1) + pointerId(8) + position(4+4+2+2) + pressure(2) + action_button(4) + buttons(4) = 31 bytes data (type byte is sent separately)
    let mut data = Vec::with_capacity(31);

    // Action (1 byte)
    data.push(action);

    // Pointer ID (8 bytes)
    data.extend_from_slice(&0u64.to_be_bytes());

    // Position - x, y as raw pixel coordinates relative to the screen size (4 bytes each)
    data.extend_from_slice(&x.to_be_bytes());
    data.extend_from_slice(&y.to_be_bytes());

    // Screen size (2 + 2 bytes) - MUST match the video frame dimensions
    data.extend_from_slice(&(width as u16).to_be_bytes());
    data.extend_from_slice(&(height as u16).to_be_bytes());

    // Pressure (2 bytes)
    data.extend_from_slice(&0xFFFFu16.to_be_bytes());

    // Action button (4 bytes)
    data.extend_from_slice(&0u32.to_be_bytes());

    // Buttons (4 bytes)
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
    // Type 3 = INJECT_SCROLL_EVENT: type(1) + position(4+4+2+2) + hScroll(4) + vScroll(4) + buttons(4) = 24 bytes data
    let mut data = Vec::with_capacity(24);

    // Position - x, y as raw pixel coordinates (4 bytes each)
    data.extend_from_slice(&x.to_be_bytes());
    data.extend_from_slice(&y.to_be_bytes());

    // Screen size (2 + 2 bytes)
    data.extend_from_slice(&(width as u16).to_be_bytes());
    data.extend_from_slice(&(height as u16).to_be_bytes());

    // Scroll amounts
    data.extend_from_slice(&h_scroll.to_be_bytes());
    data.extend_from_slice(&v_scroll.to_be_bytes());

    // Buttons
    data.extend_from_slice(&0u32.to_be_bytes());

    scrcpy::send_control_event(&device_id, 3, &data) // 3 = INJECT_SCROLL_EVENT
}

#[tauri::command]
pub fn scrcpy_key(
    device_id: String,
    action: u8, // 0 = down, 1 = up
    keycode: u32,
    metastate: u32,
) -> Result<(), AppError> {
    // Type 0 = INJECT_KEYCODE_EVENT: type(1) + action(1) + keycode(4) + repeat(4) + metastate(4) = 13 bytes
    let mut data = Vec::with_capacity(13);
    data.push(action);
    data.extend_from_slice(&keycode.to_be_bytes());
    data.extend_from_slice(&0u32.to_be_bytes()); // Repeat
    data.extend_from_slice(&metastate.to_be_bytes());

    scrcpy::send_control_event(&device_id, 0, &data)
}

#[tauri::command]
pub fn scrcpy_text(device_id: String, text: String) -> Result<(), AppError> {
    // Type 1 = INJECT_TEXT_EVENT: type(1) + length(4) + text(n)
    let text_bytes = text.as_bytes();
    let mut data = Vec::with_capacity(4 + text_bytes.len());
    data.extend_from_slice(&(text_bytes.len() as u32).to_be_bytes());
    data.extend_from_slice(text_bytes);

    scrcpy::send_control_event(&device_id, 1, &data)
}

/// Request scrcpy sync (re-emit SPS/PPS/IDR headers)
#[tauri::command]
pub fn request_scrcpy_sync(
    device_id: String,
    window_label: String,
    app_handle: AppHandle,
) -> Result<(), AppError> {
    scrcpy::sync_session(&device_id, &window_label, &app_handle)
}
