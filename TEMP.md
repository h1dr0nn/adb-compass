# Android Agent Features - Pending Frontend Integration

Đây là danh sách các tính năng đã có sẵn trong Android Agent (Java) nhưng chưa được tích hợp vào giao diện frontend. Backend Rust (Tauri commands) đã có sẵn cho hầu hết các tính năng này.

---

## 1. ✅ Đã Triển Khai Hoàn Chỉnh

| Feature                     | Agent Command          | Frontend Component |
| --------------------------- | ---------------------- | ------------------ |
| Danh sách ứng dụng với icon | `GET_APPS`             | `AppManager.tsx`   |
| Lọc app hệ thống            | `include_system` param | `AppManager.tsx`   |
| Duyệt file nhanh            | `LIST_FILES`           | `FileManager.tsx`  |

---

## 2. 🔶 Chưa Tích Hợp Frontend (Backend đã sẵn sàng)

### 2.1. Performance Monitoring (GET_STATS)

**Mô tả:** Theo dõi CPU, RAM, Pin theo thời gian thực.

**Agent Service:** `PerformanceService.java`

- `getCpuUsage()` - % CPU đang sử dụng
- `getMemoryInfo()` - RAM total/used/free (KB)
- `getBatteryInfo()` - Mức pin (%), nhiệt độ (°C), trạng thái sạc

**Backend Command:** `get_performance_stats` (đã có trong `agent.rs`)

**Gợi ý UI:**

- Widget hiển thị CPU/RAM/Pin trên Device Card
- Hoặc tab riêng "Performance" với biểu đồ realtime
- Cập nhật mỗi 2-5 giây

---

### 2.2. Clipboard Sync (GET_CLIPBOARD / SET_CLIPBOARD)

**Mô tả:** Đồng bộ clipboard giữa PC và điện thoại.

**Agent Service:** `ClipboardService.java`

- `getClipboardText()` - Lấy nội dung clipboard điện thoại
- `setClipboardText(text)` - Gửi text từ PC vào clipboard điện thoại

**Backend Commands:**

- `get_clipboard` (đã có trong `agent.rs`)
- `set_clipboard` (đã có trong `agent.rs`)

**Gợi ý UI:**

- Nút "Sync Clipboard" trong Panel hoặc QuickActions
- Popup hiển thị nội dung clipboard với nút Copy/Paste
- Tự động sync khi focus vào app (tùy chọn)

---

### 2.3. File Search / Indexing (SEARCH_FILES / INDEX_FILES)

**Mô tả:** Tìm kiếm file siêu nhanh bằng index tạo sẵn trên device.

**Agent Service:** `IndexingService.java`

- `buildIndex(path)` - Xây dựng index cho thư mục (async)
- `search(query)` - Tìm kiếm tức thì trong index
- `isIndexing()` - Kiểm tra đang indexing hay không

**Backend Commands:**

- `build_index` (đã có trong `agent.rs`)
- `search_files_fast` (đã có trong `agent.rs`)

**Gợi ý UI:**

- Thanh tìm kiếm trong `FileManager.tsx`
- Nút "Build Index" với loading indicator
- Hiển thị kết quả tìm kiếm với đường dẫn đầy đủ
- Badge "Indexing..." khi đang build

---

### 2.4. Input Injection (INJECT_INPUT - TAP)

**Mô tả:** Mô phỏng chạm màn hình từ xa (cho mirroring/control).

**Agent Service:** `InputService.java`

- `injectTap(x, y)` - Mô phỏng tap tại tọa độ (x, y)

**Backend Command:** `inject_tap_fast` (đã có trong `agent.rs`)

**Gợi ý UI:**

- Tích hợp vào Screen Mirroring (khi bật control mode)
- Click vào preview → gửi tap đến device
- Có thể mở rộng thêm swipe, long-press sau này

---

### 2.5. Agent Version Check (GET_VERSION)

**Mô tả:** Kiểm tra phiên bản Agent đang chạy trên device.

**Agent Command:** `GET_VERSION` → trả về `{ "version": "1.1.0" }`

**Backend:** Chưa có command riêng, có thể dùng `test_agent_connection`

**Gợi ý UI:**

- Hiển thị trong Device Card: "Agent v1.1.0 ✓"
- Cảnh báo nếu version cũ hơn yêu cầu

---

## 3. 🔴 Chưa Triển Khai (Cần thêm Java code)

### 3.1. INJECT_INPUT - SWIPE / LONG_PRESS / TEXT

**Mô tả:** Mở rộng input injection cho các thao tác khác.

**Cần thêm vào `InputService.java`:**

```java
public boolean injectSwipe(int x1, int y1, int x2, int y2, int duration);
public boolean injectLongPress(int x, int y, int duration);
public boolean injectText(String text);
```

---

### 3.2. Screenshot qua Agent (nhanh hơn screencap)

**Mô tả:** Chụp màn hình thông qua SurfaceControl (như scrcpy).

**Cần tạo mới:** `ScreenshotService.java`

- Sử dụng hidden API `SurfaceControl.screenshot()`
- Trả về Base64 PNG/JPEG

---

### 3.3. FPS Monitor

**Mô tả:** Theo dõi FPS của app đang foreground.

**Cần thêm vào `PerformanceService.java`:**

- Đọc từ `/sys/class/graphics/fb0/`
- Hoặc sử dụng `dumpsys SurfaceFlinger --latency`

---

### 3.4. Process List / Kill Process

**Mô tả:** Xem danh sách process và kill app.

**Cần tạo mới:** Mở rộng `AppService.java`

```java
public JSONArray getRunningProcesses();
public boolean forceStopApp(String packageName);
```

---

## 4. Thứ Tự Ưu Tiên Đề Xuất

1. **Performance Monitoring** - UI đơn giản, giá trị cao
2. **Clipboard Sync** - Tính năng hay dùng
3. **File Search** - File Manager đã có sẵn
4. **Input Injection Tap** - Cần cho Screen Control
5. **Version Check** - Đơn giản, nên làm sớm

---

## 5. Files Liên Quan

**Android Agent (Java):**

- `android-agent/src/com/h1dr0n/adbcompass/SocketServer.java` - Main handler
- `android-agent/src/com/h1dr0n/adbcompass/services/*.java` - Các service

**Rust Backend:**

- `src-tauri/src/adb/agent_manager.rs` - Agent communication
- `src-tauri/src/commands/agent.rs` - Tauri commands

**Frontend (React):**

- `src/components/device/AppManager.tsx` - App list
- `src/components/device/FileManager.tsx` - File browser
- `src/components/device/Performance.tsx` - (Cần tạo mới)
- `src/components/device/ClipboardSync.tsx` - (Cần tạo mới)
