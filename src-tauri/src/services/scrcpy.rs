// Scrcpy Server Integration
// High-performance screen mirroring using scrcpy-server with H.264 decoding

use crate::adb::AdbExecutor;
use crate::command_utils::hidden_command;
use crate::error::AppError;
use base64;
use serde::Serialize;
use std::io::{BufRead, Read};
use std::net::TcpStream;
use std::process::{Child, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

const SCRCPY_SERVER_PATH: &str = "/data/local/tmp/scrcpy-server.jar";
const SCRCPY_SERVER_VERSION: &str = "2.7";

const TARGET_FPS: u32 = 30;

#[derive(Debug, Clone, Serialize)]
pub struct ScrcpyConfig {
    pub max_size: u32,
    pub bit_rate: u32,
    pub max_fps: u8,
    pub lock_video_orientation: i8,
    pub tunnel_forward: bool,
    pub send_frame_meta: bool,
    pub control: bool,
    pub display_id: u32,
    pub show_touches: bool,
    pub stay_awake: bool,
    pub power_off_on_close: bool,
    pub cleanup: bool,
    pub power_on: bool,
}

impl Default for ScrcpyConfig {
    fn default() -> Self {
        Self {
            max_size: 512,       // Lower res for better performance
            bit_rate: 4_000_000, // 4 Mbps
            max_fps: TARGET_FPS as u8,
            lock_video_orientation: -1,
            tunnel_forward: true,
            send_frame_meta: false,
            control: true,
            display_id: 0,
            show_touches: false,
            stay_awake: true,
            power_off_on_close: false,
            cleanup: true,
            power_on: true,
        }
    }
}

#[derive(Debug, Serialize, Clone)]
pub struct ScrcpyStatus {
    pub running: bool,
    pub device_id: Option<String>,
    pub port: Option<u16>,
    pub codec_info: Option<Vec<u8>>,
}

struct ScrcpySession {
    server_process: Option<Child>,
    streaming: Arc<Mutex<bool>>,
    video_port: u16,
    #[allow(dead_code)]
    control_port: u16,
    control_socket: Option<Arc<Mutex<TcpStream>>>,
    last_sps: Arc<Mutex<Option<Vec<u8>>>>,
    last_pps: Arc<Mutex<Option<Vec<u8>>>>,
    last_idr: Arc<Mutex<Option<Vec<u8>>>>,
}

lazy_static::lazy_static! {
    static ref SCRCPY_SESSIONS: Arc<Mutex<std::collections::HashMap<String, ScrcpySession>>> =
        Arc::new(Mutex::new(std::collections::HashMap::new()));
}

/// Push scrcpy-server.jar to device
pub fn push_scrcpy_server(device_id: &str, app_handle: &AppHandle) -> Result<(), AppError> {
    let executor = AdbExecutor::new();
    let adb_path = executor.get_adb_path();

    // Try multiple paths to find scrcpy-server.jar
    let possible_paths = [
        // Production: resource dir (standard Tauri location)
        app_handle
            .path()
            .resource_dir()
            .ok()
            .map(|p| p.join("resources").join("scrcpy-server.jar")),
        app_handle
            .path()
            .resource_dir()
            .ok()
            .map(|p| p.join("scrcpy-server.jar")),
        // Dev: src-tauri/resources
        std::env::current_exe().ok().and_then(|p| {
            // target/debug/tauri-app.exe -> target/debug -> target -> src-tauri -> resources
            p.parent()?
                .parent()?
                .parent()?
                .join("src-tauri")
                .join("resources")
                .join("scrcpy-server.jar")
                .into()
        }),
        // Dev fallback: parent of exe/resources (for different build layouts)
        std::env::current_exe().ok().and_then(|p| {
            p.parent()?
                .join("resources")
                .join("scrcpy-server.jar")
                .into()
        }),
        // Workspace root
        Some(std::path::PathBuf::from(
            "src-tauri/resources/scrcpy-server.jar",
        )),
        Some(std::path::PathBuf::from("resources/scrcpy-server.jar")),
    ];

    let resource_path = possible_paths.into_iter().flatten().find(|p| p.exists());

    let resource_path = match resource_path {
        Some(p) => p,
        None => {
            return Err(AppError::new(
                "SERVER_NOT_FOUND",
                &format!(
                    "scrcpy-server.jar not found. Please ensure it exists in src-tauri/resources/"
                ),
            ));
        }
    };

    let output = hidden_command(&adb_path)
        .args([
            "-s",
            device_id,
            "push",
            resource_path.to_str().unwrap_or(""),
            SCRCPY_SERVER_PATH,
        ])
        .output()
        .map_err(|e| AppError::new("PUSH_FAILED", &format!("Failed to push server: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::new(
            "PUSH_FAILED",
            &format!("Push failed: {}", stderr),
        ));
    }

    Ok(())
}

/// Start scrcpy server and begin streaming
pub fn start_server(
    device_id: &str,
    config: ScrcpyConfig,
    app_handle: &AppHandle,
) -> Result<ScrcpyStatus, AppError> {
    let executor = AdbExecutor::new();
    let adb_path = executor.get_adb_path();

    // Kill existing scrcpy server instances to avoid "Address already in use"
    let _ = hidden_command(&adb_path)
        .args(["-s", device_id, "shell", "pkill -f scrcpy"])
        .output();

    // Push server
    push_scrcpy_server(device_id, app_handle)?;

    let video_port = 27183;

    // Forward video socket
    let socket_name = "scrcpy_12345678"; // Must match "scrcpy_" + scid (8 chars)
    let forward_output = hidden_command(&adb_path)
        .args([
            "-s",
            device_id,
            "forward",
            &format!("tcp:{}", video_port),
            &format!("localabstract:{}", socket_name),
        ])
        .output()
        .map_err(|e| AppError::new("FORWARD_FAILED", &format!("Failed to forward: {}", e)))?;

    if !forward_output.status.success() {
        return Err(AppError::new("FORWARD_FAILED", "Forward failed"));
    }

    // Note: scrcpy v2.7 requirement:
    // 1. First argument MUST be client version (e.g., "2.7")
    // 2. Subsequent arguments are key=value pairs
    // 3. scid must be provided
    // 4. video_bit_rate argument causes crash on some devices/versions, omitting to use default (8Mbps)
    let server_args = format!(
        "CLASSPATH={} app_process / com.genymobile.scrcpy.Server {} \
        scid=12345678 log_level=verbose max_size={} max_fps={} \
        lock_video_orientation={} tunnel_forward={} \
        send_frame_meta={} control=true display_id={} \
        show_touches={} stay_awake={} power_off_on_close={} \
        cleanup={} power_on={} audio=false video=true",
        SCRCPY_SERVER_PATH,
        SCRCPY_SERVER_VERSION, // "2.7"
        config.max_size,
        config.max_fps,
        config.lock_video_orientation,
        config.tunnel_forward,
        config.send_frame_meta,
        config.display_id,
        config.show_touches,
        config.stay_awake,
        config.power_off_on_close,
        config.cleanup,
        config.power_on,
    );

    let mut server_process = hidden_command(&adb_path)
        .args(["-s", device_id, "shell", &server_args])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| AppError::new("SERVER_START_FAILED", &format!("Failed to start: {}", e)))?;

    // Spawn thread to log server stderr (critical for debugging)
    if let Some(stderr) = server_process.stderr.take() {
        thread::spawn(move || {
            let src = std::io::BufReader::new(stderr);
            for line in src.lines() {
                if let Ok(_l) = line {
                    // scrcpy server output
                }
            }
        });
    }

    // Wait for server to start
    thread::sleep(Duration::from_millis(1000));

    // Connect to video socket with retry - wait between retries
    let mut video_socket: Option<TcpStream> = None;
    for _attempt in 1..=10 {
        // Give server more time to create socket
        thread::sleep(Duration::from_millis(500));

        match TcpStream::connect(format!("127.0.0.1:{}", video_port)) {
            Ok(mut socket) => {
                // Read dummy byte (required for tunnel_forward=true)
                let mut dummy = [0u8; 1];
                match socket.read_exact(&mut dummy) {
                    Ok(_) => {
                        video_socket = Some(socket);
                        break;
                    }
                    Err(_e) => {
                        // Failed to read dummy byte
                    }
                }
            }
            Err(_e) => {
                // Connection attempt failed
            }
        }
    }

    let video_socket = video_socket.ok_or_else(|| {
        AppError::new("SOCKET_ERROR", "Failed to connect video after 10 attempts")
    })?;

    video_socket
        .set_read_timeout(Some(Duration::from_millis(5000)))
        .ok();
    video_socket.set_nodelay(true).ok();

    // Connect to control socket
    let mut control_socket: Option<TcpStream> = None;
    for _ in 0..5 {
        if let Ok(socket) = TcpStream::connect(format!("127.0.0.1:{}", video_port)) {
            socket.set_nodelay(true).ok();
            control_socket = Some(socket);
            break;
        }
        thread::sleep(Duration::from_millis(200));
    }

    let control_socket = control_socket
        .ok_or_else(|| AppError::new("CONTROL_SOCKET_ERROR", "Failed to connect control socket"))?;

    let streaming = Arc::new(Mutex::new(true));

    // Store session
    let session = ScrcpySession {
        server_process: Some(server_process),
        streaming: streaming.clone(),
        video_port,
        control_port: video_port, // Reusing same forwarded port for both connections
        control_socket: Some(Arc::new(Mutex::new(control_socket))),
        last_sps: Arc::new(Mutex::new(None)),
        last_pps: Arc::new(Mutex::new(None)),
        last_idr: Arc::new(Mutex::new(None)),
    };

    let last_sps = session.last_sps.clone();
    let last_pps = session.last_pps.clone();
    let last_idr = session.last_idr.clone();

    {
        let mut sessions = SCRCPY_SESSIONS.lock().unwrap();
        sessions.insert(device_id.to_string(), session);
    }

    // Start decode/stream thread
    let device_id_clone = device_id.to_string();
    let app_handle_clone = app_handle.clone();

    thread::spawn(move || {
        decode_and_stream(
            device_id_clone,
            video_socket,
            streaming,
            app_handle_clone,
            last_sps,
            last_pps,
            last_idr,
        );
    });

    Ok(ScrcpyStatus {
        running: true,
        device_id: Some(device_id.to_string()),
        port: Some(video_port),
        codec_info: None,
    })
}

/// Stream raw H.264 NAL units to frontend
fn decode_and_stream(
    device_id: String,
    mut socket: TcpStream,
    streaming: Arc<Mutex<bool>>,
    app_handle: AppHandle,
    last_sps: Arc<Mutex<Option<Vec<u8>>>>,
    last_pps: Arc<Mutex<Option<Vec<u8>>>>,
    last_idr: Arc<Mutex<Option<Vec<u8>>>>,
) {
    // Read device name (64 bytes)
    let mut device_name = [0u8; 64];
    if let Err(_e) = socket.read_exact(&mut device_name) {
        return;
    }

    // Read video header (12 bytes)
    let mut header = [0u8; 12];
    if let Err(_e) = socket.read_exact(&mut header) {
        return;
    }

    // We don't need OpenH264 anymore!
    // Just a buffer to hold incoming stream
    let mut buffer = vec![0u8; 65536];
    let mut nal_buffer: Vec<u8> = Vec::with_capacity(1024 * 1024);

    loop {
        // Check if still streaming
        {
            if !*streaming.lock().unwrap() {
                break;
            }
        }

        // Read from socket
        match socket.read(&mut buffer) {
            Ok(n) if n > 0 => {
                nal_buffer.extend_from_slice(&buffer[..n]);

                // Extract and emit all complete NAL units
                while let Some(nal_data) = extract_next_nal(&mut nal_buffer) {
                    // Cache SPS/PPS headers
                    if nal_data.len() > 4 {
                        // Find NAL type (usually byte 4 or 3 depending on start code)
                        let nal_type_byte = if nal_data[2] == 0 && nal_data[3] == 1 {
                            nal_data[4]
                        } else {
                            nal_data[3]
                        };
                        let nal_type = nal_type_byte & 0x1F;

                        if nal_type == 7 {
                            *last_sps.lock().unwrap() = Some(nal_data.clone());
                        } else if nal_type == 8 {
                            *last_pps.lock().unwrap() = Some(nal_data.clone());
                        } else if nal_type == 5 {
                            *last_idr.lock().unwrap() = Some(nal_data.clone());
                        }
                    }

                    // Encode to Base64 (raw H.264 with start codes)
                    let base64_data = base64::Engine::encode(
                        &base64::engine::general_purpose::STANDARD,
                        &nal_data,
                    );

                    // Emit 'scrcpy-h264-frame-{device_id}'
                    // Sanitize device_id for Tauri event name requirements (alphanumeric, -, /, :, _)
                    let sanitized_id = device_id.replace('.', "_").replace(':', "_");
                    let _ = app_handle.emit(&format!("scrcpy-frame-{}", sanitized_id), base64_data);
                }
            }
            Ok(_) => {
                // Connection closed (0 bytes)

                break;
            }
            Err(e) => {
                if e.kind() != std::io::ErrorKind::WouldBlock
                    && e.kind() != std::io::ErrorKind::TimedOut
                {
                    break;
                }
            }
        }
    }
}

/// Extract next NAL unit from buffer and prepend annex-b start code
fn extract_next_nal(nal_buffer: &mut Vec<u8>) -> Option<Vec<u8>> {
    // NAL start codes are 00 00 00 01 or 00 00 01

    // Helper to find start code sequence
    let find_start = |data: &[u8]| -> Option<usize> {
        for i in 0..data.len().saturating_sub(3) {
            if data[i] == 0 && data[i + 1] == 0 {
                if data[i + 2] == 1 {
                    return Some(i); // 00 00 01
                }
                if data.len() > i + 3 && data[i + 2] == 0 && data[i + 3] == 1 {
                    return Some(i); // 00 00 00 01
                }
            }
        }
        None
    };

    let start_idx = match find_start(nal_buffer) {
        Some(idx) => idx,
        None => return None, // No start code yet
    };

    // Before the start code is garbage or previous data?
    // Usually we drain up to start code.
    if start_idx > 0 {
        nal_buffer.drain(..start_idx);
    }

    // Now nal_buffer starts with 00 ...
    // We need to find the NEXT start code to define the END of this NAL
    // Skip the current start code prefix (3 or 4 bytes)
    let prefix_len = if nal_buffer.len() > 3 && nal_buffer[2] == 0 && nal_buffer[3] == 1 {
        4
    } else {
        3
    };

    // Search for next start code after current prefix
    let end_idx = match find_start(&nal_buffer[prefix_len..]) {
        Some(offset) => prefix_len + offset,
        None => return None, // Incomplete NAL
    };

    // Extract complete NAL (including start code)
    let nal_unit = nal_buffer[..end_idx].to_vec();

    // Remove from buffer
    nal_buffer.drain(..end_idx);

    Some(nal_unit)
}

// Removing unused functions try_decode_frame and yuv_to_jpeg

/// Stop scrcpy server
pub fn stop_server(device_id: &str) -> Result<(), AppError> {
    let executor = AdbExecutor::new();
    let adb_path = executor.get_adb_path();

    {
        let mut sessions = SCRCPY_SESSIONS.lock().unwrap();
        if let Some(mut session) = sessions.remove(device_id) {
            *session.streaming.lock().unwrap() = false;

            if let Some(mut process) = session.server_process.take() {
                let _ = process.kill();
            }
        }
    }

    let _ = hidden_command(&adb_path)
        .args(["-s", device_id, "forward", "--remove-all"])
        .output();

    let _ = hidden_command(&adb_path)
        .args(["-s", device_id, "shell", "pkill", "-f", "scrcpy"])
        .output();

    Ok(())
}

/// Get scrcpy status
pub fn get_status(device_id: &str) -> ScrcpyStatus {
    let sessions = SCRCPY_SESSIONS.lock().unwrap();
    if let Some(session) = sessions.get(device_id) {
        ScrcpyStatus {
            running: true,
            device_id: Some(device_id.to_string()),
            port: Some(session.video_port),
            codec_info: None,
        }
    } else {
        ScrcpyStatus {
            running: false,
            device_id: None,
            port: None,
            codec_info: None,
        }
    }
}

/// Read single frame (legacy)
pub fn read_video_frame(_device_id: &str) -> Result<Vec<u8>, AppError> {
    Err(AppError::new("DEPRECATED", "Use event-based streaming"))
}

/// Send control event
pub fn send_control_event(device_id: &str, event_type: u8, data: &[u8]) -> Result<(), AppError> {
    let sessions = SCRCPY_SESSIONS.lock().unwrap();
    if let Some(session) = sessions.get(device_id) {
        if let Some(socket_arc) = &session.control_socket {
            let mut socket = socket_arc.lock().unwrap();

            // Scrcpy control message: [Type (1 byte)] + [Data]
            let mut message = Vec::with_capacity(data.len() + 1);
            message.push(event_type);
            message.extend_from_slice(data);

            use std::io::Write;
            socket
                .write_all(&message)
                .map_err(|e| AppError::new("CONTROL_WRITE_FAILED", &format!("{}", e)))?;
            socket.flush().ok();
        }
    }
    Ok(())
}

/// Synchronize a new client by re-emitting cached SPS/PPS/IDR headers to a private event channel
pub fn sync_session(
    device_id: &str,
    window_label: &str,
    app_handle: &AppHandle,
) -> Result<(), AppError> {
    let sessions = SCRCPY_SESSIONS.lock().unwrap();
    if let Some(session) = sessions.get(device_id) {
        let sps = session.last_sps.lock().unwrap().clone();
        let pps = session.last_pps.lock().unwrap().clone();
        let idr = session.last_idr.lock().unwrap().clone();

        let sanitized_id = device_id.replace('.', "_").replace(':', "_");
        // Private sync event for this specific window
        let sync_event = format!("scrcpy-sync-{}-{}", window_label, sanitized_id);

        // Atomic Sync: Emit all config packets as quickly as possible to prevent interspersing Delta frames
        if let Some(sps_data) = sps {
            let base64_sps =
                base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &sps_data);
            app_handle.emit(&sync_event, base64_sps).ok();
        }

        if let Some(pps_data) = pps {
            let base64_pps =
                base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &pps_data);
            app_handle.emit(&sync_event, base64_pps).ok();
        }

        if let Some(idr_data) = idr {
            let base64_idr =
                base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &idr_data);
            app_handle.emit(&sync_event, base64_idr).ok();
        }
    }
    Ok(())
}
