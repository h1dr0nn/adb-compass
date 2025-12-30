// ADB Module - Handles all ADB interactions
// This module provides a safe wrapper around the adb command-line tool

pub mod client;
pub mod command_builder;
pub mod discovery;
pub mod executor;
pub mod tracker;
pub mod agent_manager;

pub use client::AdbClient;
pub use command_builder::{AdbCommand, AdbCommandBuilder, ShellCommandBuilder};
pub use discovery::AdbDiscovery;
pub use executor::{AdbExecutor, DeviceInfo, DeviceStatus};
pub use tracker::start_device_tracker;
pub use agent_manager::AgentManager;
