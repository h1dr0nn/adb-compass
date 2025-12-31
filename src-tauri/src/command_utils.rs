// Cross-platform command utilities
// Provides helpers for running shell commands without showing terminal windows on Windows

use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Windows flag to prevent showing console window
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Extension trait for Command to hide console window on Windows
pub trait CommandExt2 {
    /// Configure the command to not show a console window on Windows.
    /// On other platforms, this is a no-op.
    fn hide_window(&mut self) -> &mut Self;
}

impl CommandExt2 for Command {
    #[cfg(target_os = "windows")]
    fn hide_window(&mut self) -> &mut Self {
        self.creation_flags(CREATE_NO_WINDOW)
    }

    #[cfg(not(target_os = "windows"))]
    fn hide_window(&mut self) -> &mut Self {
        self
    }
}

/// Create a new Command with console window hidden on Windows
pub fn hidden_command<S: AsRef<std::ffi::OsStr>>(program: S) -> Command {
    let mut cmd = Command::new(program);
    cmd.hide_window();
    cmd
}

/// Extension trait for Tokio Command to hide console window on Windows
pub trait TokioCommandExt {
    fn hide_window(&mut self) -> &mut Self;
}

impl TokioCommandExt for tokio::process::Command {
    #[cfg(target_os = "windows")]
    fn hide_window(&mut self) -> &mut Self {
        self.creation_flags(CREATE_NO_WINDOW);
        self
    }

    #[cfg(not(target_os = "windows"))]
    fn hide_window(&mut self) -> &mut Self {
        self
    }
}
