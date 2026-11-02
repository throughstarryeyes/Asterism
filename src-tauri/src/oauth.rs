// signing in to google from the desktop app: the sign-in page opens in the writer's own browser, and google sends
// them back to a one-time address on this computer (127.0.0.1) that this file listens on. nothing leaves the machine
// except the visit to google itself. the code that comes back is useless without the secret only the app holds.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::time::{Duration, Instant};
use tauri_plugin_opener::OpenerExt;

const WAIT: Duration = Duration::from_secs(300);

const PAGE: &str = "<!doctype html><meta charset=utf-8><title>Asterism</title><body style=\"font-family:Georgia,serif;background:#faf6ee;color:#2b2118;display:flex;align-items:center;justify-content:center;height:100vh;margin:0\"><div style=\"text-align:center\"><h2>You are signed in.</h2><p>You can close this tab and go back to Asterism.</p></div></body>";

#[derive(serde::Serialize)]
pub struct Loopback {
    code: String,
    state: String,
    redirect: String,
}

// what the browser asked for: Some(pairs) when it is the redirect from google, None for anything else (a favicon, say)
fn read_request(stream: &mut TcpStream) -> Option<Vec<(String, String)>> {
    stream.set_nonblocking(false).ok()?;
    stream.set_read_timeout(Some(Duration::from_secs(5))).ok()?;
    let mut buf = [0u8; 8192];
    let n = stream.read(&mut buf).ok()?;
    let text = String::from_utf8_lossy(&buf[..n]);
    let target = text.lines().next()?.split_whitespace().nth(1)?.to_string();
    let url = url::Url::parse(&format!("http://127.0.0.1{target}")).ok()?;
    if url.path() != "/" {
        return None;
    }
    let pairs: Vec<(String, String)> = url.query_pairs().map(|(k, v)| (k.into_owned(), v.into_owned())).collect();
    if pairs.iter().any(|(k, _)| k == "code" || k == "error") {
        Some(pairs)
    } else {
        None
    }
}

fn reply(stream: &mut TcpStream, ok: bool) {
    let (status, body) = if ok { ("200 OK", PAGE) } else { ("404 Not Found", "") };
    let _ = write!(
        stream,
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
}

fn wait_for_redirect(listener: TcpListener, redirect: String) -> Result<Loopback, String> {
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let started = Instant::now();
    loop {
        if started.elapsed() > WAIT {
            return Err("Sign-in took too long. Try again.".into());
        }
        let mut stream = match listener.accept() {
            Ok((s, _)) => s,
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(100));
                continue;
            }
            Err(e) => return Err(e.to_string()),
        };
        let Some(pairs) = read_request(&mut stream) else {
            reply(&mut stream, false);
            continue;
        };
        reply(&mut stream, true);
        let get = |name: &str| pairs.iter().find(|(k, _)| k == name).map(|(_, v)| v.clone());
        if let Some(err) = get("error") {
            return Err(err);
        }
        return Ok(Loopback {
            code: get("code").unwrap_or_default(),
            state: get("state").unwrap_or_default(),
            redirect,
        });
    }
}

// `url_template` is google's sign-in address with `{redirect}` where the return address goes
#[tauri::command]
pub async fn oauth_loopback(app: tauri::AppHandle, url_template: String) -> Result<Loopback, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let redirect = format!("http://127.0.0.1:{port}");
    let encoded: String = url::form_urlencoded::byte_serialize(redirect.as_bytes()).collect();
    let url = url_template.replace("{redirect}", &encoded);
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || wait_for_redirect(listener, redirect))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn visit(port: u16, target: &str) -> String {
        let mut s = TcpStream::connect(("127.0.0.1", port)).unwrap();
        write!(s, "GET {target} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").unwrap();
        let mut out = String::new();
        s.read_to_string(&mut out).unwrap();
        out
    }

    #[test]
    fn takes_the_code_and_ignores_other_visits() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let browser = std::thread::spawn(move || {
            let stray = visit(port, "/favicon.ico");
            let real = visit(port, "/?state=abc%20d&code=4%2Fxyz&scope=drive");
            (stray, real)
        });
        let got = wait_for_redirect(listener, format!("http://127.0.0.1:{port}")).unwrap();
        assert_eq!(got.code, "4/xyz");
        assert_eq!(got.state, "abc d");
        let (stray, real) = browser.join().unwrap();
        assert!(stray.starts_with("HTTP/1.1 404"));
        assert!(real.starts_with("HTTP/1.1 200") && real.contains("You are signed in"));
    }

    #[test]
    fn reports_a_refusal() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let browser = std::thread::spawn(move || visit(port, "/?error=access_denied&state=s"));
        let err = wait_for_redirect(listener, String::new()).err().unwrap();
        assert_eq!(err, "access_denied");
        browser.join().unwrap();
    }
}
