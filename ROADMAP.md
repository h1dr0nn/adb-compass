# Project Roadmap

This document outlines the planned development phases and feature milestones for the project.
The roadmap is intended to be flexible and may evolve as implementation progresses.

---

## ✅ Completed Phases

### Phase 1 — Foundation & Device Detection

**Goal:** Establish a stable technical base and reliably detect Android devices.

- [x] Project initialization (Tauri + Rust + React)
- [x] Repository structure and build setup
- [x] Android platform-tools integration strategy
- [x] Basic logging and error handling framework
- [x] Integrate adb as an external process
- [x] Implement real-time device tracking using adb track-devices
- [x] Device model definition (id, status, metadata)
- [x] Device state machine (offline, unauthorized, authorized, ready)
- [x] Emit device connection / disconnection events to frontend

---

### Phase 2 — Requirement Validation & APK Installation

**Goal:** Validate device settings and enable safe APK installation.

- [x] Define standardized requirement checklist
- [x] Detect Developer Mode / USB Debugging / installation restrictions
- [x] Map detection results into structured requirement status
- [x] Provide actionable hints for each failed requirement
- [x] APK file selection handling and validation
- [x] Pre-install compatibility checks (SDK level, device readiness)
- [x] APK installation via adb with progress and result reporting
- [x] Parse adb output and map errors to user-friendly messages

---

### Phase 3 — Frontend UX & Advanced Features

**Goal:** Deliver clear UX and expand device management capabilities.

- [x] Device list and selection UI
- [x] Requirement checklist UI with pass/fail indicators
- [x] Guided flow from device detection to installation
- [x] Installation progress feedback and error display
- [x] Device Card Action Grid (Info, Uninstall, Reboot, Input, Files)
- [x] Advanced Tools Tab (Wireless Connect, Logcat, Terminal)
- [x] Multi-device support improvements
- [x] adb version compatibility checks and timeout/retry strategy
- [x] Graceful handling of disconnected devices during operations

---

### Phase 4 — Polish & Distribution

**Goal:** Prepare the application for broader usage and distribution.

- [x] UI and interaction polish
- [x] Application icon and branding
- [x] Platform-specific packaging and signing
- [x] Performance optimizations
- [x] Documentation updates (README, usage guides)
- [x] Wireless ADB support
- [x] Device logcat viewer
- [x] App uninstall / manage installed apps

---

## 🚧 Upcoming Phases

### Phase 5 — Layout Redesign & Device Detail View ✅

**Goal:** Redesign the interface layout following Apple HIG principles with new Device Detail View feature.

**Design Principles:**
- **Clarity:** Content-focused with proper whitespace and typography
- **Deference:** Subtle, elegant UI that supports content
- **Depth:** Visual layers and smooth motion for hierarchy

**Completed:**
- [x] Design tokens (`src/styles/tokens.css`) - spacing, typography, shadows, transitions
- [x] Animation variants (`src/lib/animations.ts`) - page, card, modal, tab, list animations
- [x] Device Detail View (`src/components/DeviceDetailView.tsx`) - 4-tab interface (Overview, Screen, Apps, Files)
- [x] Device Overview tab (`src/components/device/DeviceOverview.tsx`)
- [x] Screen Capture tab (`src/components/device/ScreenCapture.tsx`) - screenshot & recording UI
- [x] Backend commands (`src-tauri/src/commands/screen_capture.rs`)
- [x] App navigation with selectedDevice state
- [x] Device card click to open Detail View with hover animations
- [x] Modal animations unified with `modalBackdrop/modalContent` variants
- [x] DeviceList animations with `listContainer/listItem` stagger effect

---

### Phase 6 — Advanced Device Integration (Android Agent)

**Goal:** Implement a custom Android Agent (Server) to bypass ADB limitations and unlock advanced features.

**Core Concept:**
- Push a lightweight Android app/jar (Agent) to the device via ADB.
- The Agent runs as a local server on the phone, communicating with ADB Compass via socket.
- **Fallback Strategy:** If Agent installation fails or is rejected, fallback to standard ADB commands (Smart Mapping for names/icons).

**Key Features:**
- [ ] **Real App Icons & Labels:** Agent extracts original icons and labels from `PackageManager` and sends them to desktop.
- [ ] **Real-time Performance Stats:** High-frequency CPU/RAM/FPS monitoring (overlay potential).
- [ ] **File System indexing:** Faster file listing and searching than raw `ls` commands.
- [ ] **Clipboard Sync:** Bi-directional clipboard sharing.
- [ ] **Input Control:** Lower latency touch/keyboard injection compared to `adb shell input`.

- [ ] To be planned

---

### Phase 7 — (Reserved)

**Goal:** TBD

- [ ] To be planned

---

### Phase 8 — (Reserved)

**Goal:** TBD

- [ ] To be planned

---

### Phase 9 — (Reserved)

**Goal:** TBD

- [ ] To be planned

---

### Phase 10 — (Reserved)

**Goal:** TBD

- [ ] To be planned

---

## Future Considerations

Potential features not included in the initial scope:

- [x] Screenshot and screen recording tools (Phase 5)
- [x] Touch event forwarding for screen mirroring
- [ ] Automation and scripting support
- [ ] Cross-platform build validation (Windows / macOS / Linux)
- [ ] Plugin/extension system
- [ ] Cloud sync for settings and preferences

---

## Notes

This roadmap represents the current development intent and is subject to change based on technical constraints and user feedback.
