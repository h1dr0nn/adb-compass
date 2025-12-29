// ADB Module - Handles all ADB interactions
// This module provides a safe wrapper around the adb command-line tool

pub mod client;
pub mod command_builder;
pub mod discovery;
pub mod executor;
pub mod tracker;

pub use client::AdbClient;
pub use discovery::AdbDiscovery;
pub use executor::AdbExecutor;
pub use tracker::start_device_tracker;
