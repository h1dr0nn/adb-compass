# Project Roadmap

This document outlines the planned development phases and feature milestones for the project.
The roadmap is intended to be flexible and may evolve as implementation progresses.

---

## Phase 0 — Foundation

**Goal:** Establish a stable technical base and development workflow.

- [x] Project initialization (Tauri + Rust + React)
- [x] Repository structure and build setup
- [ ] Cross-platform build validation (Windows / macOS / Linux)
- [x] Android platform-tools integration strategy
- [x] Basic logging and error handling framework

---

## Phase 1 — Device Detection

**Goal:** Reliably detect Android devices and track their connection state in real time.

- [x] Integrate adb as an external process
- [x] Implement real-time device tracking using adb track-devices
- [x] Device model definition (id, status, metadata)
- [x] Device state machine (offline, unauthorized, authorized, ready)
- [x] Emit device connection / disconnection events to frontend


---

## Phase 2 — Requirement & Settings Validation

**Goal:** Identify missing developer settings and guide the user to resolve them.

- [x] Define standardized requirement checklist
- [x] Detect Developer Mode status
- [x] Detect USB Debugging authorization state
- [x] Detect installation-related restrictions
- [x] Map detection results into structured requirement status
- [x] Provide actionable hints for each failed requirement

---

## Phase 3 — APK Installation Flow

**Goal:** Enable safe and transparent APK installation onto selected devices.

- [x] APK file selection handling
- [x] APK validation (file existence, basic integrity)
- [x] Pre-install compatibility checks (SDK level, device readiness)
- [x] APK installation via adb
- [x] Parse adb install output and map errors to user-friendly messages
- [x] Installation progress and result reporting

---

## Phase 4 — Frontend UX & Feedback

**Goal:** Deliver a clear, responsive, and user-friendly experience.

- [x] Device list and selection UI
- [x] Requirement checklist UI with pass/fail indicators
- [x] Guided flow from device detection to installation
- [x] Installation progress feedback
- [x] Error display with clear explanations and suggested actions

---

## Phase 5 — Stability & Edge Cases

**Goal:** Improve robustness and handle real-world usage scenarios.

- [x] Multi-device support improvements
- [x] adb version compatibility checks
- [x] Timeout and retry strategy for adb commands
- [x] Graceful handling of disconnected devices during operations
- [x] Defensive parsing of adb output

---

## Phase 6 — Polish & Distribution

**Goal:** Prepare the application for broader usage and distribution.

- [ ] UI and interaction polish
- [ ] Application icon and branding
- [ ] Platform-specific packaging and signing
- [ ] Performance optimizations
- [ ] Documentation updates (README, usage guides)

---

## Future Considerations

Potential features not included in the initial scope:

- [ ] Wireless ADB support
- [ ] Device logcat viewer
- [ ] App uninstall / manage installed apps
- [ ] Screenshot and screen recording tools
- [ ] Automation and scripting support

---

## Notes

This roadmap represents the current development intent and is subject to change based on technical constraints and user feedback.
