// Scrcpy Server Integration
// High-performance screen mirroring using scrcpy-server with H.264 decoding

use crate::adb::AdbExecutor;
use crate::command_utils::hidden_command;
use crate::error::AppError;
use image::{ImageBuffer, Rgb};
use openh264::decoder::Decoder;
use openh264::formats::YUVSource;
use serde::Serialize;
use std::io::{Cursor, Read};
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
        // Production: resource dir
        app_handle
            .path()
            .resource_dir()
            .ok()
            .map(|p| p.join("scrcpy-server.jar")),
        // Dev: relative to exe
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.join("scrcpy-server.jar"))),
        // Dev: src-tauri/resources
        std::env::current_exe().ok().and_then(|p| {
            p.parent().map(|p| {
                p.join("..")
                    .join("..")
                    .join("..")
                    .join("resources")
                    .join("scrcpy-server.jar")
            })
        }),
        // Workspace: relative
        Some(std::path::PathBuf::from("resources/scrcpy-server.jar")),
        Some(std::path::PathBuf::from(
            "src-tauri/resources/scrcpy-server.jar",
        )),
    ];

    let resource_path = possible_paths.into_iter().flatten().find(|p| {
        let exists = p.exists();
        println!("[scrcpy] Checking path {:?}: exists={}", p, exists);
        exists
    });

    let resource_path = match resource_path {
        Some(p) => p,
        None => {
            return Err(AppError::new(
                "SERVER_NOT_FOUND",
                "scrcpy-server.jar not found in any location",
            ));
        }
    };

    println!("[scrcpy] Using server jar: {:?}", resource_path);

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

    println!("[scrcpy] Server pushed successfully");
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
    let control_port = 27184;

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
        send_frame_meta={} control=false display_id={} \
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
        let device_id = device_id.to_string();
        thread::spawn(move || {
            let src = std::io::BufReader::new(stderr);
            use std::io::BufRead;
            for line in src.lines() {
                if let Ok(l) = line {
                    println!("[scrcpy-server-{}] {}", device_id, l);
                }
            }
        });
    }

    // Wait for server to start
    thread::sleep(Duration::from_millis(1000));

    // Connect to video socket with retry - wait between retries
    let mut video_socket: Option<TcpStream> = None;
    for attempt in 1..=10 {
        // Give server more time to create socket
        thread::sleep(Duration::from_millis(500));

        match TcpStream::connect(format!("127.0.0.1:{}", video_port)) {
            Ok(mut socket) => {
                println!("[scrcpy] Connected on attempt {}", attempt);

                // Read dummy byte (required for tunnel_forward=true)
                let mut dummy = [0u8; 1];
                match socket.read_exact(&mut dummy) {
                    Ok(_) => {
                        println!("[scrcpy] Received dummy byte");
                        video_socket = Some(socket);
                        break;
                    }
                    Err(e) => {
                        println!("[scrcpy] Failed to read dummy byte: {}", e);
                    }
                }
            }
            Err(e) => {
                println!("[scrcpy] Connection attempt {} failed: {}", attempt, e);
            }
        }
    }

    let video_socket = video_socket
        .ok_or_else(|| AppError::new("SOCKET_ERROR", "Failed to connect after 10 attempts"))?;

    video_socket
        .set_read_timeout(Some(Duration::from_millis(5000)))
        .ok();
    video_socket.set_nodelay(true).ok();

    let streaming = Arc::new(Mutex::new(true));

    // Store session
    let session = ScrcpySession {
        server_process: Some(server_process),
        streaming: streaming.clone(),
        video_port,
        control_port,
    };

    {
        let mut sessions = SCRCPY_SESSIONS.lock().unwrap();
        sessions.insert(device_id.to_string(), session);
    }

    // Start decode/stream thread
    let device_id_clone = device_id.to_string();
    let app_handle_clone = app_handle.clone();

    thread::spawn(move || {
        decode_and_stream(device_id_clone, video_socket, streaming, app_handle_clone);
    });

    Ok(ScrcpyStatus {
        running: true,
        device_id: Some(device_id.to_string()),
        port: Some(video_port),
        codec_info: None,
    })
}

/// Decode H.264 stream and emit JPEG frames
fn decode_and_stream(
    device_id: String,
    mut socket: TcpStream,
    streaming: Arc<Mutex<bool>>,
    app_handle: AppHandle,
) {
    // Read device name (64 bytes)
    let mut device_name = [0u8; 64];
    if let Err(e) = socket.read_exact(&mut device_name) {
        println!("[scrcpy] Failed to read device name: {}", e);
        return;
    }
    let name = String::from_utf8_lossy(&device_name);
    println!("[scrcpy] Device: {}", name.trim_end_matches('\0'));

    // Read video header (12 bytes)
    let mut header = [0u8; 12];
    if let Err(e) = socket.read_exact(&mut header) {
        println!("[scrcpy] Failed to read video header: {}", e);
        return;
    }
    println!("[scrcpy] Video header received");

    // Initialize H.264 decoder
    let mut decoder = match Decoder::new() {
        Ok(d) => d,
        Err(e) => {
            println!("[scrcpy] Failed to create decoder: {:?}", e);
            return;
        }
    };

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
                if nal_buffer.is_empty() {
                    // println!("[scrcpy] First data: {} bytes", n); // Verbose
                }
                nal_buffer.extend_from_slice(&buffer[..n]);

                // Try to decode accumulated NAL units
                while let Some(frame) = try_decode_frame(&mut decoder, &mut nal_buffer) {
                    // Convert YUV to JPEG and emit
                    if let Some(jpeg_data) = yuv_to_jpeg(&frame) {
                        let base64_data = base64::Engine::encode(
                            &base64::engine::general_purpose::STANDARD,
                            &jpeg_data,
                        );
                        let _ =
                            app_handle.emit(&format!("scrcpy-frame-{}", device_id), base64_data);
                    }
                }
            }
            Ok(_) => {
                thread::sleep(Duration::from_millis(1));
            }
            Err(e) => {
                if e.kind() != std::io::ErrorKind::WouldBlock
                    && e.kind() != std::io::ErrorKind::TimedOut
                {
                    println!("[scrcpy] Read error: {}", e);
                    break;
                }
            }
        }
    }

    println!("[scrcpy] Streaming stopped for {}", device_id);
}

/// Try to decode a frame from NAL buffer
fn try_decode_frame(decoder: &mut Decoder, nal_buffer: &mut Vec<u8>) -> Option<DecodedFrame> {
    // Find NAL unit boundaries (00 00 00 01 or 00 00 01)
    let mut start = 0;
    let mut end = 0;

    // Find first start code
    for i in 0..nal_buffer.len().saturating_sub(4) {
        if nal_buffer[i] == 0 && nal_buffer[i + 1] == 0 {
            if nal_buffer[i + 2] == 0 && nal_buffer[i + 3] == 1 {
                start = i;
                break;
            } else if nal_buffer[i + 2] == 1 {
                start = i;
                break;
            }
        }
    }

    // Find next start code
    for i in (start + 3)..nal_buffer.len().saturating_sub(4) {
        if nal_buffer[i] == 0 && nal_buffer[i + 1] == 0 {
            if nal_buffer[i + 2] == 0 && nal_buffer[i + 3] == 1 {
                end = i;
                break;
            } else if nal_buffer[i + 2] == 1 {
                end = i;
                break;
            }
        }
    }

    if end <= start {
        return None;
    }

    // Extract NAL unit
    let nal_unit: Vec<u8> = nal_buffer[start..end].to_vec();
    nal_buffer.drain(..end);

    // Decode
    match decoder.decode(&nal_unit) {
        Ok(Some(yuv)) => {
            let (width, height) = yuv.dimensions();
            let y_data = yuv.y();
            let u_data = yuv.u();
            let v_data = yuv.v();

            // Calculate strides based on actual data length
            let y_stride = y_data.len() / height;
            let uv_stride = u_data.len() / (height / 2);

            let mut rgb_data = vec![0u8; width * height * 3];

            // YUV420 to RGB conversion
            for j in 0..height {
                for i in 0..width {
                    let y_idx = j * y_stride + i;
                    let uv_idx = (j / 2) * uv_stride + (i / 2);

                    if y_idx < y_data.len() && uv_idx < u_data.len() && uv_idx < v_data.len() {
                        let y = y_data[y_idx] as f32;
                        let u = u_data[uv_idx] as f32 - 128.0;
                        let v = v_data[uv_idx] as f32 - 128.0;

                        let r = (y + 1.402 * v).clamp(0.0, 255.0) as u8;
                        let g = (y - 0.344 * u - 0.714 * v).clamp(0.0, 255.0) as u8;
                        let b = (y + 1.772 * u).clamp(0.0, 255.0) as u8;

                        let rgb_idx = (j * width + i) * 3;
                        if rgb_idx + 2 < rgb_data.len() {
                            rgb_data[rgb_idx] = r;
                            rgb_data[rgb_idx + 1] = g;
                            rgb_data[rgb_idx + 2] = b;
                        }
                    }
                }
            }

            Some(DecodedFrame {
                width: width as u32,
                height: height as u32,
                rgb_data,
            })
        }
        _ => None,
    }
}

struct DecodedFrame {
    width: u32,
    height: u32,
    rgb_data: Vec<u8>,
}

/// Convert RGB frame to JPEG
fn yuv_to_jpeg(frame: &DecodedFrame) -> Option<Vec<u8>> {
    let img: ImageBuffer<Rgb<u8>, Vec<u8>> =
        ImageBuffer::from_raw(frame.width, frame.height, frame.rgb_data.clone())?;

    let mut jpeg_data = Vec::new();
    let mut cursor = Cursor::new(&mut jpeg_data);

    img.write_to(&mut cursor, image::ImageFormat::Jpeg).ok()?;

    Some(jpeg_data)
}

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
pub fn send_control_event(_device_id: &str, _event_type: u8, _data: &[u8]) -> Result<(), AppError> {
    // TODO: Implement control socket
    Ok(())
}
