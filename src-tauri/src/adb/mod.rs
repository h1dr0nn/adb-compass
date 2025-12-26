// ADB Module - Handles all ADB interactions
// This module provides a safe wrapper around the adb command-line tool

pub mod executor;

pub use executor::AdbExecutor;
