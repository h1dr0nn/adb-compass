use crate::adb::{AdbExecutor, AgentManager};
use serde_json::json;

#[tauri::command]
pub async fn test_agent_connection(device_id: String) -> Result<serde_json::Value, String> {
    let executor = AdbExecutor::new();
    let manager = AgentManager::new(executor);

    // 1. Start agent
    manager
        .start_agent(&device_id)
        .await
        .map_err(|e| e.to_string())?;

    // 2. Ping agent
    let response = manager
        .send_command(&device_id, "PING", json!({}))
        .await
        .map_err(|e| e.to_string())?;

    Ok(response)
}

#[tauri::command]
pub async fn get_apps_full(
    device_id: String,
    include_system: bool,
) -> Result<serde_json::Value, String> {
    let executor = AdbExecutor::new();
    let manager = AgentManager::new(executor);

    let response = manager
        .get_apps_full(&device_id, include_system)
        .await
        .map_err(|e| e.to_string())?;

    Ok(response)
}

#[tauri::command]
pub async fn get_app_icon(device_id: String, package: String) -> Result<serde_json::Value, String> {
    let executor = AdbExecutor::new();
    let manager = AgentManager::new(executor);

    let response = manager
        .get_app_icon(&device_id, &package)
        .await
        .map_err(|e| e.to_string())?;

    Ok(response)
}

#[tauri::command]
pub async fn list_files_fast(device_id: String, path: String) -> Result<serde_json::Value, String> {
    let executor = AdbExecutor::new();
    let manager = AgentManager::new(executor);

    let response = manager
        .list_files_fast(&device_id, &path)
        .await
        .map_err(|e| e.to_string())?;

    Ok(response)
}

#[tauri::command]
pub async fn get_performance_stats(device_id: String) -> Result<serde_json::Value, String> {
    let executor = AdbExecutor::new();
    let manager = AgentManager::new(executor);

    let response = manager
        .get_performance_stats(&device_id)
        .await
        .map_err(|e| e.to_string())?;

    Ok(response)
}

#[tauri::command]
pub async fn get_clipboard(device_id: String) -> Result<serde_json::Value, String> {
    let executor = AdbExecutor::new();
    let manager = AgentManager::new(executor);

    let response = manager
        .get_clipboard(&device_id)
        .await
        .map_err(|e| e.to_string())?;

    Ok(response)
}

#[tauri::command]
pub async fn set_clipboard(device_id: String, text: String) -> Result<serde_json::Value, String> {
    let executor = AdbExecutor::new();
    let manager = AgentManager::new(executor);

    let response = manager
        .set_clipboard(&device_id, &text)
        .await
        .map_err(|e| e.to_string())?;

    Ok(response)
}

#[tauri::command]
pub async fn inject_tap_fast(
    device_id: String,
    x: i32,
    y: i32,
) -> Result<serde_json::Value, String> {
    let executor = AdbExecutor::new();
    let manager = AgentManager::new(executor);

    let response = manager
        .inject_tap(&device_id, x, y)
        .await
        .map_err(|e| e.to_string())?;

    Ok(response)
}

#[tauri::command]
pub async fn build_index(device_id: String, path: String) -> Result<serde_json::Value, String> {
    let executor = AdbExecutor::new();
    let manager = AgentManager::new(executor);

    let response = manager
        .build_index(&device_id, &path)
        .await
        .map_err(|e| e.to_string())?;

    Ok(response)
}

#[tauri::command]
pub async fn search_files_fast(
    device_id: String,
    query: String,
) -> Result<serde_json::Value, String> {
    let executor = AdbExecutor::new();
    let manager = AgentManager::new(executor);

    let response = manager
        .search_files_fast(&device_id, &query)
        .await
        .map_err(|e| e.to_string())?;

    Ok(response)
}
