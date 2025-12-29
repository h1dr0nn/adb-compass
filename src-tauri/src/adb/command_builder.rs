// ADB Command Builder - Typed builder for ADB commands
// Provides a fluent API to construct ADB commands with type safety.

/// Represents a variety of ADB commands
#[derive(Debug, Clone)]
pub enum AdbCommand {
    Version,
    Devices { long: bool },
    Shell(Vec<String>),
    Install { path: String, reinstall: bool },
    Uninstall { package: String, keep_data: bool },
    Push { local: String, remote: String },
    Pull { remote: String, local: String },
    Reboot { mode: Option<String> },
    StartServer,
    KillServer,
    GetProp(String),
}

impl AdbCommand {
    /// Convert the command into a vector of arguments for the ADB process
    pub fn to_args(&self) -> Vec<String> {
        match self {
            AdbCommand::Version => vec!["version".into()],
            AdbCommand::Devices { long } => {
                let mut args = vec!["devices".into()];
                if *long {
                    args.push("-l".into());
                }
                args
            }
            AdbCommand::Shell(shell_args) => {
                let mut args = vec!["shell".into()];
                args.extend(shell_args.iter().cloned());
                args
            }
            AdbCommand::Install { path, reinstall } => {
                let mut args = vec!["install".into()];
                if *reinstall {
                    args.push("-r".into());
                }
                args.push(path.clone());
                args
            }
            AdbCommand::Uninstall { package, keep_data } => {
                let mut args = vec!["uninstall".into()];
                if *keep_data {
                    args.push("-k".into());
                }
                args.push(package.clone());
                args
            }
            AdbCommand::Push { local, remote } => {
                vec!["push".into(), local.clone(), remote.clone()]
            }
            AdbCommand::Pull { remote, local } => {
                vec!["pull".into(), remote.clone(), local.clone()]
            }
            AdbCommand::Reboot { mode } => {
                let mut args = vec!["reboot".into()];
                if let Some(m) = mode {
                    args.push(m.clone());
                }
                args
            }
            AdbCommand::StartServer => vec!["start-server".into()],
            AdbCommand::KillServer => vec!["kill-server".into()],
            AdbCommand::GetProp(prop) => vec!["shell".into(), "getprop".into(), prop.clone()],
        }
    }
}

/// Builder for constructing ADB commands targeting specific devices
pub struct AdbCommandBuilder {
    device_id: Option<String>,
}

impl AdbCommandBuilder {
    /// Create a new builder
    pub fn new() -> Self {
        Self { device_id: None }
    }

    /// Target a specific device by its ID
    pub fn target(mut self, device_id: &str) -> Self {
        self.device_id = Some(device_id.to_string());
        self
    }

    /// Construct a full argument list including device targeting strings
    pub fn build(&self, command: AdbCommand) -> Vec<String> {
        let mut args = Vec::new();
        if let Some(ref id) = self.device_id {
            args.push("-s".into());
            args.push(id.clone());
        }

        args.extend(command.to_args());
        args
    }
}

/// Helper to quickly build common shell commands
pub struct ShellCommandBuilder {
    args: Vec<String>,
}

impl ShellCommandBuilder {
    pub fn new(command: &str) -> Self {
        Self {
            args: vec![command.to_string()],
        }
    }

    pub fn arg(mut self, value: &str) -> Self {
        self.args.push(value.to_string());
        self
    }

    pub fn build(self) -> Vec<String> {
        self.args
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_command_to_args() {
        let cmd = AdbCommand::Devices { long: true };
        assert_eq!(cmd.to_args(), vec!["devices", "-l"]);
    }

    #[test]
    fn test_builder_with_device() {
        let builder = AdbCommandBuilder::new().target("12345");
        let args = builder.build(AdbCommand::Shell(vec!["ls".into(), "/sdcard".into()]));
        assert_eq!(args, vec!["-s", "12345", "shell", "ls", "/sdcard"]);
    }

    #[test]
    fn test_shell_builder() {
        let args = ShellCommandBuilder::new("input")
            .arg("tap")
            .arg("100")
            .arg("200")
            .build();
        assert_eq!(args, vec!["input", "tap", "100", "200"]);
    }
}
