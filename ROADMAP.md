# Project Roadmap

This document outlines the planned development phases and feature milestones for the project.
The roadmap is intended to be flexible and may evolve as implementation progresses.

---

## Phase 0 — Foundation

**Goal:** Establish a stable technical base and development workflow.

- [ ] Project initialization (Tauri + Rust + React)
- [ ] Repository structure and build setup
- [ ] Cross-platform build validation (Windows / macOS / Linux)
- [ ] Android platform-tools integration strategy
- [ ] Basic logging and error handling framework

---

## Phase 1 — Device Detection

**Goal:** Reliably detect Android devices and track their connection state in real time.

- [ ] Integrate adb as an external process
- [ ] Implement real-time device tracking using adb track-devices
- [ ] Device model definition (id, status, metadata)
- [ ] Device state machine (offline, unauthorized, authorized, ready)
- [ ] Emit device connection / disconnection events to frontend

---

## Phase 2 — Requirement & Settings Validation

**Goal:** Identify missing developer settings and guide the user to resolve them.

- [ ] Define standardized requirement checklist
- [ ] Detect Developer Mode status
- [ ] Detect USB Debugging authorization state
- [ ] Detect installation-related restrictions
- [ ] Map detection results into structured requirement status
- [ ] Provide actionable hints for each failed requirement

---

## Phase 3 — APK Installation Flow

**Goal:** Enable safe and transparent APK installation onto selected devices.

- [ ] APK file selection handling
- [ ] APK validation (file existence, basic integrity)
- [ ] Pre-install compatibility checks (SDK level, device readiness)
- [ ] APK installation via adb
- [ ] Parse adb install output and map errors to user-friendly messages
- [ ] Installation progress and result reporting

---

## Phase 4 — Frontend UX & Feedback

**Goal:** Deliver a clear, responsive, and user-friendly experience.

- [ ] Device list and selection UI
- [ ] Requirement checklist UI with pass/fail indicators
- [ ] Guided flow from device detection to installation
- [ ] Installation progress feedback
- [ ] Error display with clear explanations and suggested actions

---

## Phase 5 — Stability & Edge Cases

**Goal:** Improve robustness and handle real-world usage scenarios.

- [ ] Multi-device support improvements
- [ ] adb version compatibility checks
- [ ] Timeout and retry strategy for adb commands
- [ ] Graceful handling of disconnected devices during operations
- [ ] Defensive parsing of adb output

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
