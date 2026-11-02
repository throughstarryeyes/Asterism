// what the Collaborate window asks of the desktop app: start and stop the relay on this computer, and (if the writer has it
// installed) run their own cloudflared in front of it so people outside the home network can reach it. nothing is started until the
// writer presses the button, and everything stops when the app closes.

use crate::relay::{lan_address, new_host_key, Relay};
use serde::Serialize;
#[cfg(desktop)]
use std::io::{BufRead, BufReader};
#[cfg(desktop)]
use std::process::{Child, Command, Stdio};
#[cfg(desktop)]
use std::sync::mpsc;
#[cfg(desktop)]
use std::sync::Mutex as StdMutex;
#[cfg(desktop)]
use std::time::Duration;
use tauri::State;
use tokio::sync::Mutex;

const DEFAULT_PORT: u16 = 8788;

#[derive(Default)]
pub struct Hosting {
    relay: Mutex<Option<Relay>>,
    // phones cannot start cloudflared, so on mobile there is no tunnel
    #[cfg(desktop)]
    tunnel: StdMutex<Option<(Child, String)>>,
}

#[derive(Serialize, Clone)]
pub struct RelayInfo {
    port: u16,
    host_key: String,
    // the address other computers on this network would type
    lan: Option<String>,
    // the address from the writer's own tunnel, when it is running
    tunnel: Option<String>,
}

impl Hosting {
    #[cfg(desktop)]
    fn tunnel_url(&self) -> Option<String> {
        self.tunnel.lock().unwrap().as_ref().map(|(_, url)| url.clone())
    }

    #[cfg(not(desktop))]
    fn tunnel_url(&self) -> Option<String> {
        None
    }

    async fn info(&self) -> Option<RelayInfo> {
        let guard = self.relay.lock().await;
        let r = guard.as_ref()?;
        Some(RelayInfo { port: r.port, host_key: r.host_key.clone(), lan: lan_address().map(|ip| format!("{ip}:{}", r.port)), tunnel: self.tunnel_url() })
    }

    pub fn shut_down(&self) {
        #[cfg(desktop)]
        if let Some((mut child, _)) = self.tunnel.lock().unwrap().take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        if let Ok(guard) = self.relay.try_lock() {
            if let Some(r) = guard.as_ref() {
                r.stop();
            }
        }
    }
}

#[tauri::command]
pub async fn relay_status(hosting: State<'_, Hosting>) -> Result<Option<RelayInfo>, String> {
    Ok(hosting.info().await)
}

#[tauri::command]
pub async fn relay_start(hosting: State<'_, Hosting>) -> Result<RelayInfo, String> {
    {
        let mut guard = hosting.relay.lock().await;
        if guard.is_none() {
            let key = new_host_key();
            // the usual port if it is free, otherwise any free one
            let relay = match Relay::start(DEFAULT_PORT, key.clone()).await {
                Ok(r) => r,
                Err(_) => Relay::start(0, key).await.map_err(|e| format!("Could not start the relay: {e}"))?,
            };
            *guard = Some(relay);
        }
    }
    hosting.info().await.ok_or_else(|| "The relay did not start.".to_string())
}

#[tauri::command]
pub async fn relay_stop(hosting: State<'_, Hosting>) -> Result<(), String> {
    #[cfg(desktop)]
    if let Some((mut child, _)) = hosting.tunnel.lock().unwrap().take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    if let Some(r) = hosting.relay.lock().await.take() {
        r.stop();
    }
    Ok(())
}

#[cfg(desktop)]
fn cloudflared_path() -> Option<std::path::PathBuf> {
    // for tests: a stand-in program can be named here
    if let Some(stand_in) = std::env::var_os("ASTERISM_CLOUDFLARED") {
        return Some(stand_in.into());
    }
    let name = if cfg!(windows) { "cloudflared.exe" } else { "cloudflared" };
    if let Some(path) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path) {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    // where its installer puts it on Windows
    if cfg!(windows) {
        for base in ["ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"] {
            if let Some(root) = std::env::var_os(base) {
                let candidate = std::path::PathBuf::from(root).join("cloudflared").join(name);
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }
    }
    None
}

// the first https address in a line of cloudflared's output that ends in trycloudflare.com
#[cfg(any(desktop, test))]
fn tunnel_address(line: &str) -> Option<String> {
    const END: &str = ".trycloudflare.com";
    let start = line.find("https://")?;
    let rest = &line[start..];
    let end = rest.find(END)? + END.len();
    Some(rest[..end].to_string())
}

#[cfg(desktop)]
#[tauri::command]
pub async fn tunnel_start(hosting: State<'_, Hosting>) -> Result<String, String> {
    if let Some(url) = hosting.tunnel_url() {
        return Ok(url);
    }
    let port = hosting.relay.lock().await.as_ref().map(|r| r.port).ok_or("Start the relay first.")?;
    let exe = cloudflared_path().ok_or("cloudflared is not installed on this computer. Install it from cloudflare.com, then try again.")?;

    let mut command = Command::new(exe);
    command.args(["tunnel", "--no-autoupdate", "--url", &format!("http://127.0.0.1:{port}")]).stdout(Stdio::null()).stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000); // no console window
    }
    let mut child = command.spawn().map_err(|e| format!("Could not start cloudflared: {e}"))?;
    let stderr = child.stderr.take().ok_or("Could not read cloudflared.")?;

    // cloudflared prints the address it was given among its log lines
    let (found, wait) = mpsc::channel::<String>();
    std::thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            if let Some(url) = tunnel_address(&line) {
                let _ = found.send(url);
            }
        }
    });
    let url = tokio::task::spawn_blocking(move || wait.recv_timeout(Duration::from_secs(40))).await.map_err(|e| e.to_string())?;
    match url {
        Ok(url) => {
            *hosting.tunnel.lock().unwrap() = Some((child, url.clone()));
            Ok(url)
        }
        Err(_) => {
            let _ = child.kill();
            let _ = child.wait();
            Err("cloudflared did not give an address. Check your internet connection and try again.".to_string())
        }
    }
}

#[cfg(desktop)]
#[tauri::command]
pub async fn tunnel_stop(hosting: State<'_, Hosting>) -> Result<(), String> {
    if let Some((mut child, _)) = hosting.tunnel.lock().unwrap().take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_the_address_in_cloudflareds_output() {
        let line = "2026-10-30T10:00:00Z INF |  https://soft-moon-1234.trycloudflare.com                                  |";
        assert_eq!(tunnel_address(line).as_deref(), Some("https://soft-moon-1234.trycloudflare.com"));
        assert_eq!(tunnel_address("INF Requesting new quick Tunnel on trycloudflare.com..."), None);
        assert_eq!(tunnel_address("see https://developers.cloudflare.com/docs"), None);
    }
}

#[cfg(not(desktop))]
#[tauri::command]
pub async fn tunnel_start() -> Result<String, String> {
    Err("Sharing over the internet is not available on this device. Guests on the same Wi-Fi or hotspot can still join.".to_string())
}

#[cfg(not(desktop))]
#[tauri::command]
pub async fn tunnel_stop() -> Result<(), String> {
    Ok(())
}
