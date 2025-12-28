import socket
import struct
import subprocess
import time
import sys
import os

# Configuration - adjusted for tests/ folder
ADB_PATH = r"..\src-tauri\binaries\adb.exe"
SCRCPY_SERVER_PATH = "/data/local/tmp/scrcpy-server.jar"
SCRCPY_VERSION = "2.7"
SCID = "12345678"
VIDEO_PORT = 27183
SOCKET_NAME = f"scrcpy_{SCID}"
DEVICE_ID = ""

def log(msg):
    print(msg)
    try:
        with open("debug_log.txt", "a", encoding="utf-8") as f:
            f.write(msg + "\n")
    except: pass

def run_adb(args):
    cmd = [ADB_PATH] + args
    log(f"Running: {' '.join(cmd)}")
    return subprocess.check_output(cmd).decode('utf-8').strip()

def get_device():
    try:
        lines = run_adb(["devices"]).splitlines()
        for line in lines[1:]:
            if "\tdevice" in line:
                return line.split("\t")[0]
    except Exception as e:
        log(f"Error getting device: {e}")
    return None

def main():
    global DEVICE_ID
    # Ensure we are in the tests directory or adjust path logic? 
    # Actually ADB_PATH is relative. Assuming script runs from tests/ cwd.
    
    # 1. Get Device
    DEVICE_ID = get_device()
    if not DEVICE_ID:
        log("No device found")
        return

    log(f"Device: {DEVICE_ID}")

    # 2. Cleanup & Forward
    log("Cleaning up old servers...")
    subprocess.call([ADB_PATH, "-s", DEVICE_ID, "shell", "pkill -f scrcpy"])
    
    log("Forwarding port...")
    run_adb(["-s", DEVICE_ID, "forward", f"tcp:{VIDEO_PORT}", f"localabstract:{SOCKET_NAME}"])

    # 3. Start Server
    log("Starting server...")
    # Integrity Check
    log("Checking server version...")
    try:
        ver_output = run_adb(["-s", DEVICE_ID, "shell", f"CLASSPATH={SCRCPY_SERVER_PATH} app_process / com.genymobile.scrcpy.Server -v"])
        log(f"Server Version: {ver_output}")
    except:
        log("Version check failed or aborted. Re-pushing server...")
        try:
             # Push from ../src-tauri/resources/scrcpy-server.jar
             local_jar = r"..\src-tauri\resources\scrcpy-server.jar"
             if os.path.exists(local_jar):
                 run_adb(["-s", DEVICE_ID, "push", local_jar, SCRCPY_SERVER_PATH])
                 log("Re-pushed server jar.")
                 # Retry version check
                 ver_output = run_adb(["-s", DEVICE_ID, "shell", f"CLASSPATH={SCRCPY_SERVER_PATH} app_process / com.genymobile.scrcpy.Server -v"])
                 log(f"Server Version after push: {ver_output}")
             else:
                 log(f"Local JAR not found at {local_jar}")
        except Exception as e:
             log(f"Failed to push or verify: {e}")

    # Matches Step 924 (Known Working) + control=false
    server_cmd = (
        f"CLASSPATH={SCRCPY_SERVER_PATH} app_process / com.genymobile.scrcpy.Server {SCRCPY_VERSION} "
        f"scid={SCID} log_level=info max_size=720 tunnel_forward=true audio=false control=false"
    )
    
    server_proc = subprocess.Popen(
        [ADB_PATH, "-s", DEVICE_ID, "shell", server_cmd],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    # 4. Connect and Read
    time.sleep(2) # Wait for startup
    
    log(f"Connecting to localhost:{VIDEO_PORT}...")
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect(("127.0.0.1", VIDEO_PORT))
        log("Connected!")
        
        # Dump everything
        s.settimeout(5.0) # 5s timeout
        total_data = b""
        start = time.time()
        while time.time() - start < 8:
            try:
                chunk = s.recv(1024)
                if not chunk:
                    log("Socket closed by remote")
                    break
                total_data += chunk
                log(f"Received {len(chunk)} bytes")
            except socket.timeout:
                log("Socket timeout (no more data)")
                break
        
        log(f"Total bytes received: {len(total_data)}")
        log(f"Hex dump: {total_data.hex()}")
        
        if len(total_data) >= 1:
             log(f"Byte 0 (Dummy): {total_data[0]:02x}")
        
        if len(total_data) >= 65:
             name_bytes = total_data[1:65]
             try:
                 name_str = name_bytes.decode('utf-8').replace('\x00', '')
                 log(f"Device Name: {name_str}")
             except: 
                 log("Failed to decode device name")

    except Exception as e:
        log(f"Error: {e}")
    finally:
        log("Cleaning up...")
        if server_proc.poll() is None:
            server_proc.terminate()
        
        # Read server output
        stdout, stderr = server_proc.communicate()
        if stdout:
            log(f"Server STDOUT: {stdout.decode('utf-8', errors='ignore')}")
        if stderr:
            log(f"Server STDERR: {stderr.decode('utf-8', errors='ignore')}")

        run_adb(["-s", DEVICE_ID, "forward", "--remove", f"tcp:{VIDEO_PORT}"])

if __name__ == "__main__":
    main()
