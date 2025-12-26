# ADB Compass

A cross-platform desktop application for detecting Android devices, validating required system settings, and installing APKs through a guided, user-friendly workflow.

The application is built with a **Rust backend**, **Tauri IPC layer**, and a **React frontend**, using **Android platform-tools (adb)** as an external system dependency.

---

## 1. Project Goals

This project aims to:

- Automatically detect connected Android devices via USB
- Identify missing or misconfigured developer settings required for ADB operations
- Provide clear, actionable guidance for resolving device authorization and setup issues
- Install APK files onto selected devices in a safe and transparent manner
- Offer a clean, responsive desktop UI suitable for both developers and non-technical users

---

## 2. Core Features

### Device Detection
- Real-time device connection and disconnection detection
- Support for multiple devices
- Device state tracking (offline, unauthorized, authorized, ready)

### Requirement & Permission Validation
- Developer Mode status detection
- USB Debugging authorization check
- Installation permission validation
- Structured checklist with pass/fail indicators

### APK Installation
- APK file selection and validation
- Pre-install compatibility checks (SDK level, device availability)
- Installation status and error reporting
- Friendly error messages mapped from adb output

---

## 3. Architecture Overview

```
React Frontend
└─ Device UI / Checklist / Install Flow
       ▲
       │ Tauri IPC (invoke / events)
       ▼
Rust Backend
├─ ADB process wrapper
├─ Device state machine
├─ Requirement detector
└─ APK installer
       ▼
Android platform-tools (adb)
       ▼
Android Device(s)
```

---

## 4. Technology Stack

- **Frontend**: React + TypeScript
- **Desktop Framework**: Tauri
- **Backend**: Rust
- **Android Tooling**: Android platform-tools (adb)
- **Target OS**: Windows, macOS, Linux

---

## 5. Design Principles

- Clear separation between UI and system-level logic
- No direct adb calls from the frontend
- Defensive parsing of adb output
- Event-driven device state updates
- Human-readable guidance instead of raw error logs

