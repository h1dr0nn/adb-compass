use crate::adb::executor::AdbExecutor;
use crate::command_utils::TokioCommandExt;
use crate::error::AppError;
use lazy_static::lazy_static;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;

lazy_static! {
    static ref AGENT_START_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::new(());
}

pub struct AgentManager {
    executor: AdbExecutor,
    port: u16,
}

impl AgentManager {
    pub fn new(executor: AdbExecutor) -> Self {
        Self {
            executor,
            port: 12345,
        }
    }

    fn find_agent_jar(&self) -> Result<PathBuf, AppError> {
        let adb_path = self.executor.get_adb_path();
        let bin_dir = adb_path.parent();

        let possible_paths = [
            bin_dir.map(|p| p.join("agent.jar")),
            bin_dir.map(|p| p.join("binaries").join("agent.jar")),
            bin_dir.map(|p| p.join("resources").join("binaries").join("agent.jar")),
            std::env::current_exe().ok().and_then(|p| {
                p.parent()?
                    .parent()?
                    .parent()?
                    .join("src-tauri")
                    .join("binaries")
                    .join("agent.jar")
                    .into()
            }),
            std::env::current_exe()
                .ok()
                .and_then(|p| p.parent()?.join("binaries").join("agent.jar").into()),
            Some(
                PathBuf::from("src-tauri")
                    .join("binaries")
                    .join("agent.jar"),
            ),
            Some(PathBuf::from("binaries").join("agent.jar")),
            Some(PathBuf::from("android-agent").join("agent.jar")),
        ];

        possible_paths
            .into_iter()
            .flatten()
            .find(|p| p.exists())
            .ok_or_else(|| {
                AppError::new(
                    "AGENT_NOT_FOUND",
                    "agent.jar not found in bundled or development paths",
                )
            })
    }

    /// Prepare and start the agent on the specified device.
    pub async fn start_agent(&self, device_id: &str) -> Result<(), AppError> {
        // 1. Push the JAR to the device
        let agent_path = self.find_agent_jar()?;

        let adb_path = self.executor.get_adb_path();

        // Push command: adb -s <id> push <path> /data/local/tmp/agent.jar
        let output = tokio::process::Command::new(adb_path)
            .hide_window()
            .args([
                "-s",
                device_id,
                "push",
                agent_path.to_str().unwrap_or(""),
                "/data/local/tmp/agent.jar",
            ])
            .output()
            .await
            .map_err(|e| AppError::from(crate::error::AdbError::ExecutionFailed(e.to_string())))?;

        if !output.status.success() {
            return Err(AppError::from(crate::error::AdbError::ExecutionFailed(
                String::from_utf8_lossy(&output.stderr).to_string(),
            )));
        }

        // 2. Start the agent using app_process
        let start_cmd = format!(
            "CLASSPATH=/data/local/tmp/agent.jar app_process / com.h1dr0n.adbcompass.Main {} >/dev/null 2>&1 &",
            self.port
        );

        // We start it in background
        tokio::process::Command::new(adb_path)
            .hide_window()
            .args(["-s", device_id, "shell", &start_cmd])
            .spawn()
            .map_err(|e| AppError::from(crate::error::AdbError::ExecutionFailed(e.to_string())))?;

        // Give it a moment to start
        tokio::time::sleep(Duration::from_millis(1000)).await;

        Ok(())
    }

    async fn stop_agent(&self, device_id: &str) {
        let adb_path = self.executor.get_adb_path();
        let _ = tokio::process::Command::new(adb_path)
            .hide_window()
            .args([
                "-s",
                device_id,
                "shell",
                "pkill",
                "-f",
                "com.h1dr0n.adbcompass",
            ])
            .output()
            .await;
        tokio::time::sleep(Duration::from_millis(300)).await;
    }

    fn local_port(&self, device_id: &str) -> u16 {
        let mut hash = 2166136261u32;
        for byte in device_id.as_bytes() {
            hash ^= u32::from(*byte);
            hash = hash.wrapping_mul(16777619);
        }
        20000 + (hash % 30000) as u16
    }

    async fn setup_forward(&self, device_id: &str) -> Result<u16, AppError> {
        let local_port = self.local_port(device_id);
        let adb_path = self.executor.get_adb_path();

        // Drop stale host-side forwards first. This is local to the chosen
        // computed port, so one device cannot poison the next app launch.
        let _ = tokio::process::Command::new(adb_path.clone())
            .hide_window()
            .args([
                "-s",
                device_id,
                "forward",
                "--remove",
                &format!("tcp:{}", local_port),
            ])
            .output()
            .await;

        let forward_output = tokio::process::Command::new(adb_path)
            .hide_window()
            .args([
                "-s",
                device_id,
                "forward",
                &format!("tcp:{}", local_port),
                &format!("tcp:{}", self.port),
            ])
            .output()
            .await
            .map_err(|e| AppError::from(crate::error::AdbError::ExecutionFailed(e.to_string())))?;

        if !forward_output.status.success() {
            return Err(AppError::from(crate::error::AdbError::ExecutionFailed(
                String::from_utf8_lossy(&forward_output.stderr).to_string(),
            )));
        }

        Ok(local_port)
    }

    async fn connect_local(
        &self,
        local_port: u16,
        timeout: Duration,
    ) -> Result<TcpStream, AppError> {
        let addr = format!("127.0.0.1:{}", local_port);
        tokio::time::timeout(timeout, TcpStream::connect(&addr))
            .await
            .map_err(|_| {
                AppError::from(crate::error::AdbError::ExecutionFailed(
                    "Timed out connecting to agent".to_string(),
                ))
            })?
            .map_err(|e| {
                AppError::from(crate::error::AdbError::ExecutionFailed(format!(
                    "Socket connect failed: {}",
                    e
                )))
            })
    }

    async fn probe_local(&self, local_port: u16) -> bool {
        let mut stream = match self
            .connect_local(local_port, Duration::from_millis(800))
            .await
        {
            Ok(stream) => stream,
            Err(_) => return false,
        };

        if stream
            .write_all(b"{\"type\":\"PING\",\"data\":{}}\n")
            .await
            .is_err()
        {
            return false;
        }

        let mut reader = BufReader::new(stream);
        let mut response = String::new();
        match tokio::time::timeout(Duration::from_millis(800), reader.read_line(&mut response))
            .await
        {
            Ok(Ok(bytes)) if bytes > 0 => response.contains("\"status\":\"PONG\""),
            _ => false,
        }
    }

    /// Ensures the agent is running and connected. If not, attempts to start it.
    async fn ensure_agent(&self, device_id: &str) -> Result<TcpStream, AppError> {
        let local_port = self.setup_forward(device_id).await?;

        if self.probe_local(local_port).await {
            return self
                .connect_local(local_port, Duration::from_millis(800))
                .await;
        }

        let _guard = AGENT_START_LOCK.lock().await;
        let local_port = self.setup_forward(device_id).await?;
        if self.probe_local(local_port).await {
            return self
                .connect_local(local_port, Duration::from_millis(800))
                .await;
        }

        self.stop_agent(device_id).await;
        self.start_agent(device_id).await?;
        let local_port = self.setup_forward(device_id).await?;
        for _ in 0..5 {
            if self.probe_local(local_port).await {
                return self
                    .connect_local(local_port, Duration::from_millis(800))
                    .await;
            }
            tokio::time::sleep(Duration::from_millis(400)).await;
        }

        Err(AppError::from(crate::error::AdbError::ExecutionFailed(
            "Agent did not respond to PING after start".to_string(),
        )))
    }

    /// Send a command to the agent and receive a response.
    pub async fn send_command(
        &self,
        device_id: &str,
        cmd_type: &str,
        data: Value,
    ) -> Result<Value, AppError> {
        let mut stream = self.ensure_agent(device_id).await?;

        let request = json!({
            "type": cmd_type,
            "data": data
        });

        let mut request_str = request.to_string();
        request_str.push('\n');

        stream
            .write_all(request_str.as_bytes())
            .await
            .map_err(|e| AppError::from(crate::error::AdbError::ExecutionFailed(e.to_string())))?;

        let mut reader = BufReader::new(stream);
        let mut response_str = String::new();
        reader.read_line(&mut response_str).await.map_err(|e| {
            AppError::from(crate::error::AdbError::ExecutionFailed(format!(
                "Read failure: {}",
                e
            )))
        })?;

        let response: Value = serde_json::from_str(&response_str).map_err(|e| {
            AppError::from(crate::error::AdbError::ExecutionFailed(format!(
                "JSON parse error: {}",
                e
            )))
        })?;

        Ok(response)
    }

    pub async fn list_files_fast(&self, device_id: &str, path: &str) -> Result<Value, AppError> {
        let resp = self
            .send_command(device_id, "LIST_FILES", json!({ "path": path }))
            .await?;
        let data = resp["data"]["files"].clone();
        Ok(if data.is_null() { json!([]) } else { data })
    }

    pub async fn get_apps_full(
        &self,
        device_id: &str,
        include_system: bool,
    ) -> Result<Value, AppError> {
        let resp = self
            .send_command(
                device_id,
                "GET_APPS",
                json!({ "include_system": include_system }),
            )
            .await?;
        let data = resp["data"]["apps"].clone();
        Ok(if data.is_null() { json!([]) } else { data })
    }

    pub async fn get_app_icon(&self, device_id: &str, package: &str) -> Result<Value, AppError> {
        let resp = self
            .send_command(device_id, "GET_ICON", json!({ "package": package }))
            .await?;
        let data = resp["data"]["icon"].clone();
        Ok(if data.is_null() { json!("") } else { data })
    }

    pub async fn get_performance_stats(&self, device_id: &str) -> Result<Value, AppError> {
        let resp = self.send_command(device_id, "GET_STATS", json!({})).await?;
        let data = resp["data"]["stats"].clone();
        Ok(if data.is_null() {
            json!({ "cpu": 0, "ram": 0 })
        } else {
            data
        })
    }

    pub async fn get_clipboard(&self, device_id: &str) -> Result<Value, AppError> {
        let resp = self
            .send_command(device_id, "GET_CLIPBOARD", json!({}))
            .await?;
        let data = resp["data"]["text"].clone();
        Ok(if data.is_null() { json!("") } else { data })
    }

    pub async fn set_clipboard(&self, device_id: &str, text: &str) -> Result<Value, AppError> {
        let resp = self
            .send_command(device_id, "SET_CLIPBOARD", json!({ "text": text }))
            .await?;
        let data = resp["data"]["success"].clone();
        Ok(if data.is_null() { json!(false) } else { data })
    }

    pub async fn inject_tap(&self, device_id: &str, x: i32, y: i32) -> Result<Value, AppError> {
        let resp = self
            .send_command(
                device_id,
                "INJECT_INPUT",
                json!({ "input_type": "TAP", "x": x, "y": y }),
            )
            .await?;
        let data = resp["data"]["success"].clone();
        Ok(if data.is_null() { json!(false) } else { data })
    }

    pub async fn build_index(&self, device_id: &str, path: &str) -> Result<Value, AppError> {
        let resp = self
            .send_command(device_id, "INDEX_FILES", json!({ "path": path }))
            .await?;
        let data = resp["data"]["status"].clone();
        Ok(if data.is_null() { json!("") } else { data })
    }

    pub async fn search_files_fast(&self, device_id: &str, query: &str) -> Result<Value, AppError> {
        let resp = self
            .send_command(device_id, "SEARCH_FILES", json!({ "query": query }))
            .await?;
        let data = resp["data"].clone();
        Ok(if data.is_null() {
            json!({ "results": [], "is_indexing": false })
        } else {
            data
        })
    }
}
