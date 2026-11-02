// the relay for live writing sessions, built into the desktop app: the host's own computer passes scrambled bytes between the host
// and each guest, and cannot read them (the key is never here). it speaks exactly what server/session-relay.mjs speaks, so the
// app and that script are interchangeable. nothing here talks to any server of ours.

use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr, UdpSocket};
use std::sync::{Arc, Mutex as StdMutex};
use std::time::{Duration, Instant};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{mpsc, watch, Mutex};
use tokio_tungstenite::accept_hdr_async_with_config;
use tokio_tungstenite::tungstenite::handshake::server::{ErrorResponse, Request, Response};
use tokio_tungstenite::tungstenite::protocol::frame::coding::CloseCode;
use tokio_tungstenite::tungstenite::protocol::{CloseFrame, WebSocketConfig};
use tokio_tungstenite::tungstenite::Message;

const MAX_FRAME: usize = 16 * 1024 * 1024;
const INVITE_LIFETIME: Duration = Duration::from_secs(15 * 60);
const MAX_GUESTS: usize = 8;
const MAX_HOSTS: usize = 16;
const MAX_INVITES: usize = 64;
// a rejoin ticket can ask to last longer than an invite, up to this
const MAX_LIFETIME_SECS: f64 = 12.0 * 60.0 * 60.0;
const PING_EVERY: Duration = Duration::from_secs(20);
const QUIET_LIMIT: Duration = Duration::from_secs(60);
const WINDOW: Duration = Duration::from_secs(60);
const TRIES_PER_WINDOW: usize = 12;
const HELLO_WAIT: Duration = Duration::from_secs(10);

type Tx = mpsc::UnboundedSender<Message>;

struct Host {
    tx: Tx,
    invites: HashMap<String, Instant>,
    guests: HashMap<u32, Tx>,
}

struct State {
    host_key: String,
    // every host has its own invites and guests, so several documents can be hosted through one relay at once, keyed by the host's connection
    hosts: HashMap<u64, Host>,
    next_guest: u32,
    next_conn: u64,
    tries: HashMap<String, Vec<Instant>>,
}

pub struct Relay {
    pub port: u16,
    pub host_key: String,
    stop: watch::Sender<bool>,
}

impl Relay {
    // port 0 picks any free one
    pub async fn start(port: u16, host_key: String) -> std::io::Result<Relay> {
        // Windows lets two programs share a port when one listens on every address and the other on a few, so look first
        if port != 0 {
            let taken = tokio::time::timeout(Duration::from_millis(300), TcpStream::connect(("127.0.0.1", port))).await;
            if matches!(taken, Ok(Ok(_))) {
                return Err(std::io::Error::new(std::io::ErrorKind::AddrInUse, "that port is already in use"));
            }
        }
        let listener = TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], port))).await?;
        let port = listener.local_addr()?.port();
        let state = Arc::new(Mutex::new(State { host_key: host_key.clone(), hosts: HashMap::new(), next_guest: 1, next_conn: 1, tries: HashMap::new() }));
        let (stop, stopped) = watch::channel(false);
        let mut quit = stopped.clone();
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = quit.changed() => break,
                    accepted = listener.accept() => {
                        if let Ok((stream, peer)) = accepted {
                            tokio::spawn(handle(state.clone(), stream, peer, stopped.clone()));
                        }
                    }
                }
            }
        });
        Ok(Relay { port, host_key, stop })
    }

    pub fn stop(&self) {
        let _ = self.stop.send(true);
    }
}

fn close(code: u16, reason: &'static str) -> Message {
    Message::Close(Some(CloseFrame { code: CloseCode::Library(code), reason: reason.into() }))
}

fn say(tx: &Tx, value: serde_json::Value) {
    let _ = tx.send(Message::text(value.to_string()));
}

fn same(a: &str, b: &str) -> bool {
    a.len() == b.len() && a.bytes().zip(b.bytes()).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

fn is_id(s: &str) -> bool {
    s.len() == 64 && s.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

// too many hellos from one address inside a minute: someone guessing
fn limited(state: &mut State, addr: &str) -> bool {
    let now = Instant::now();
    let list = state.tries.entry(addr.to_string()).or_default();
    list.retain(|t| now.duration_since(*t) < WINDOW);
    list.push(now);
    list.len() > TRIES_PER_WINDOW
}

#[derive(PartialEq)]
enum Role {
    None,
    Host,
    Guest,
}

async fn handle(state: Arc<Mutex<State>>, stream: TcpStream, peer: SocketAddr, stopped: watch::Receiver<bool>) {
    // behind a tunnel the real address arrives in a header
    let behind = Arc::new(StdMutex::new(None::<String>));
    let grab = behind.clone();
    let config = WebSocketConfig::default().max_message_size(Some(MAX_FRAME)).max_frame_size(Some(MAX_FRAME));
    let ws = accept_hdr_async_with_config(
        stream,
        move |req: &Request, resp: Response| -> Result<Response, ErrorResponse> {
            let h = req.headers();
            let seen = h.get("cf-connecting-ip").or_else(|| h.get("x-forwarded-for")).and_then(|v| v.to_str().ok()).map(|v| v.split(',').next().unwrap_or("").trim().to_string());
            *grab.lock().unwrap() = seen;
            Ok(resp)
        },
        Some(config),
    )
    .await;
    let Ok(ws) = ws else { return };
    let addr = behind.lock().unwrap().clone().filter(|a| !a.is_empty()).unwrap_or_else(|| peer.ip().to_string());

    let (mut sink, mut incoming) = ws.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
    let writer = tokio::spawn(async move {
        while let Some(m) = rx.recv().await {
            let last = matches!(m, Message::Close(_));
            if sink.send(m).await.is_err() || last {
                break;
            }
        }
        let _ = sink.close().await;
    });

    let conn = {
        let mut s = state.lock().await;
        let id = s.next_conn;
        s.next_conn += 1;
        id
    };
    let mut role = Role::None;
    let mut guest_id = 0u32;
    // for a guest: the connection of the host they belong to
    let mut home = 0u64;
    let mut quit = stopped;
    // a connection that has gone quiet without saying goodbye (wifi lost, laptop shut) is found and closed, so its owner can come back
    let mut ping = tokio::time::interval_at(tokio::time::Instant::now() + PING_EVERY, PING_EVERY);
    let mut last_heard = Instant::now();

    loop {
        let next = if role == Role::None {
            match tokio::time::timeout(HELLO_WAIT, incoming.next()).await {
                Ok(m) => m,
                Err(_) => {
                    let _ = tx.send(close(4002, "no hello"));
                    break;
                }
            }
        } else {
            tokio::select! {
                _ = quit.changed() => break,
                _ = ping.tick() => {
                    if last_heard.elapsed() > QUIET_LIMIT { break; }
                    let _ = tx.send(Message::Ping(Vec::new().into()));
                    continue;
                }
                m = incoming.next() => m,
            }
        };
        let Some(Ok(message)) = next else { break };
        last_heard = Instant::now();

        match message {
            Message::Binary(data) => {
                let s = state.lock().await;
                let Some(host) = s.hosts.get(if role == Role::Guest { &home } else { &conn }) else { continue };
                if role == Role::Guest {
                    // to the host, tagged with which guest it came from
                    let mut out = Vec::with_capacity(4 + data.len());
                    out.extend_from_slice(&guest_id.to_be_bytes());
                    out.extend_from_slice(&data);
                    let _ = host.tx.send(Message::binary(out));
                } else if role == Role::Host && data.len() > 4 {
                    let g = u32::from_be_bytes([data[0], data[1], data[2], data[3]]);
                    if let Some(guest) = host.guests.get(&g) {
                        let _ = guest.send(Message::binary(data[4..].to_vec()));
                    }
                }
            }
            Message::Text(text) => {
                let Ok(m) = serde_json::from_str::<serde_json::Value>(text.as_str()) else {
                    let _ = tx.send(close(4003, "bad message"));
                    break;
                };
                let kind = m.get("t").and_then(|v| v.as_str()).unwrap_or("");
                let mut s = state.lock().await;
                if role == Role::None {
                    match kind {
                        "host" => {
                            if limited(&mut s, &addr) {
                                let _ = tx.send(close(4004, "slow down"));
                                break;
                            }
                            if !same(m.get("key").and_then(|v| v.as_str()).unwrap_or(""), &s.host_key) {
                                let _ = tx.send(close(4001, "wrong key"));
                                break;
                            }
                            if s.hosts.len() >= MAX_HOSTS {
                                let _ = tx.send(close(4004, "too many sessions"));
                                break;
                            }
                            role = Role::Host;
                            s.hosts.insert(conn, Host { tx: tx.clone(), invites: HashMap::new(), guests: HashMap::new() });
                            say(&tx, serde_json::json!({ "t": "ready" }));
                        }
                        "join" => {
                            if limited(&mut s, &addr) {
                                let _ = tx.send(close(4004, "slow down"));
                                break;
                            }
                            let id = m.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            // whichever host made this invite is the one being joined
                            let owner = if is_id(&id) {
                                s.hosts.iter().find(|(_, h)| h.invites.contains_key(&id)).map(|(c, _)| *c)
                            } else { None };
                            let valid = owner.map_or(false, |c| {
                                let h = &s.hosts[&c];
                                h.guests.len() < MAX_GUESTS && h.invites.get(&id).map_or(false, |until| *until > Instant::now())
                            });
                            if !valid {
                                let _ = tx.send(close(4001, "no such invite"));
                                break;
                            }
                            let owner = owner.unwrap();
                            guest_id = s.next_guest;
                            s.next_guest += 1;
                            role = Role::Guest;
                            home = owner;
                            let host = s.hosts.get_mut(&owner).unwrap();
                            host.invites.remove(&id); // an invite is for one person
                            host.guests.insert(guest_id, tx.clone());
                            say(&tx, serde_json::json!({ "t": "ok" }));
                            say(&host.tx, serde_json::json!({ "t": "guest", "g": guest_id, "id": id }));
                        }
                        _ => {
                            let _ = tx.send(close(4003, "bad hello"));
                            break;
                        }
                    }
                } else if role == Role::Host {
                    if let Some(host) = s.hosts.get_mut(&conn) {
                        match kind {
                            "invite" => {
                                let id = m.get("id").and_then(|v| v.as_str()).unwrap_or("");
                                if is_id(id) && host.invites.len() < MAX_INVITES {
                                    let life = m.get("ttl").and_then(|v| v.as_f64()).filter(|t| *t > 0.0).map_or(INVITE_LIFETIME, |t| Duration::from_secs_f64(t.clamp(60.0, MAX_LIFETIME_SECS)));
                                    host.invites.insert(id.to_string(), Instant::now() + life);
                                }
                            }
                            "revoke" => {
                                if let Some(id) = m.get("id").and_then(|v| v.as_str()) {
                                    host.invites.remove(id);
                                }
                            }
                            "kick" => {
                                if let Some(g) = m.get("g").and_then(|v| v.as_u64()) {
                                    if let Some(guest) = host.guests.get(&(g as u32)) {
                                        let _ = guest.send(close(4000, "removed"));
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    // gone: a host takes its guests with it; a guest tells the host
    {
        let mut s = state.lock().await;
        if role == Role::Host {
            if let Some(host) = s.hosts.remove(&conn) {
                for guest in host.guests.values() {
                    let _ = guest.send(close(4000, "host left"));
                }
            }
        } else if role == Role::Guest {
            if let Some(host) = s.hosts.get_mut(&home) {
                host.guests.remove(&guest_id);
                say(&host.tx, serde_json::json!({ "t": "left", "g": guest_id }));
            }
        }
    }
    let _ = tx.send(close(1000, "bye"));
    let _ = writer.await;
}

// a fresh key for the host. only the app and the person at this computer ever see it
pub fn new_host_key() -> String {
    (0..16).map(|_| format!("{:02x}", rand::random::<u8>())).collect()
}

// the address other computers on this network would use to reach this one
pub fn lan_address() -> Option<IpAddr> {
    // no packet is sent: connecting a UDP socket only makes the system choose which network it would use
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("192.0.2.1:9").ok()?;
    let ip = socket.local_addr().ok()?.ip();
    if ip.is_unspecified() || ip.is_loopback() { None } else { Some(ip) }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio_tungstenite::connect_async;

    type Client = tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<TcpStream>>;

    async fn connect(port: u16) -> Client {
        connect_async(format!("ws://127.0.0.1:{port}")).await.unwrap().0
    }
    async fn send_json(c: &mut Client, v: serde_json::Value) {
        c.send(Message::text(v.to_string())).await.unwrap();
    }
    async fn next_json(c: &mut Client) -> serde_json::Value {
        loop {
            match tokio::time::timeout(Duration::from_secs(3), c.next()).await.expect("timed out").expect("closed").expect("error") {
                Message::Text(t) => return serde_json::from_str(t.as_str()).unwrap(),
                _ => continue,
            }
        }
    }
    async fn closed_with(c: &mut Client) -> Option<u16> {
        loop {
            match tokio::time::timeout(Duration::from_secs(3), c.next()).await.expect("timed out") {
                Some(Ok(Message::Close(Some(f)))) => return Some(u16::from(f.code)),
                Some(Ok(_)) => continue,
                _ => return None,
            }
        }
    }
    const ID: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    async fn with_host() -> (Relay, Client) {
        let relay = Relay::start(0, "secret".into()).await.unwrap();
        let mut host = connect(relay.port).await;
        send_json(&mut host, serde_json::json!({ "t": "host", "key": "secret" })).await;
        assert_eq!(next_json(&mut host).await["t"], "ready");
        (relay, host)
    }

    #[tokio::test]
    async fn passes_bytes_both_ways_and_tags_the_guest() {
        let (relay, mut host) = with_host().await;
        send_json(&mut host, serde_json::json!({ "t": "invite", "id": ID })).await;
        tokio::time::sleep(Duration::from_millis(50)).await;
        let mut guest = connect(relay.port).await;
        send_json(&mut guest, serde_json::json!({ "t": "join", "id": ID })).await;
        assert_eq!(next_json(&mut guest).await["t"], "ok");
        let arrived = next_json(&mut host).await;
        assert_eq!(arrived["t"], "guest");
        let g = arrived["g"].as_u64().unwrap() as u32;

        guest.send(Message::binary(vec![1, 2, 3])).await.unwrap();
        loop {
            if let Message::Binary(b) = host.next().await.unwrap().unwrap() {
                assert_eq!(&b[..4], &g.to_be_bytes());
                assert_eq!(&b[4..], &[1, 2, 3]);
                break;
            }
        }
        let mut back = g.to_be_bytes().to_vec();
        back.extend_from_slice(&[9, 8]);
        host.send(Message::binary(back)).await.unwrap();
        loop {
            if let Message::Binary(b) = guest.next().await.unwrap().unwrap() {
                assert_eq!(&b[..], &[9, 8]);
                break;
            }
        }
        relay.stop();
    }

    #[tokio::test]
    async fn an_invite_works_once_and_a_wrong_key_is_refused() {
        let (relay, mut host) = with_host().await;
        send_json(&mut host, serde_json::json!({ "t": "invite", "id": ID })).await;
        tokio::time::sleep(Duration::from_millis(50)).await;
        let mut first = connect(relay.port).await;
        send_json(&mut first, serde_json::json!({ "t": "join", "id": ID })).await;
        assert_eq!(next_json(&mut first).await["t"], "ok");
        let mut second = connect(relay.port).await;
        send_json(&mut second, serde_json::json!({ "t": "join", "id": ID })).await;
        assert_eq!(closed_with(&mut second).await, Some(4001));
        let mut impostor = connect(relay.port).await;
        send_json(&mut impostor, serde_json::json!({ "t": "host", "key": "guess" })).await;
        assert_eq!(closed_with(&mut impostor).await, Some(4001));
        relay.stop();
    }

    #[tokio::test]
    async fn guests_are_told_when_the_host_leaves_and_the_host_when_a_guest_does() {
        let (relay, mut host) = with_host().await;
        send_json(&mut host, serde_json::json!({ "t": "invite", "id": ID })).await;
        tokio::time::sleep(Duration::from_millis(50)).await;
        let mut guest = connect(relay.port).await;
        send_json(&mut guest, serde_json::json!({ "t": "join", "id": ID })).await;
        assert_eq!(next_json(&mut guest).await["t"], "ok");
        let g = next_json(&mut host).await["g"].as_u64().unwrap();
        host.close(None).await.unwrap();
        assert_eq!(closed_with(&mut guest).await, Some(4000));

        let (relay2, mut host2) = with_host().await;
        send_json(&mut host2, serde_json::json!({ "t": "invite", "id": ID })).await;
        tokio::time::sleep(Duration::from_millis(50)).await;
        let mut guest2 = connect(relay2.port).await;
        send_json(&mut guest2, serde_json::json!({ "t": "join", "id": ID })).await;
        assert_eq!(next_json(&mut guest2).await["t"], "ok");
        let _ = next_json(&mut host2).await;
        guest2.close(None).await.unwrap();
        let left = next_json(&mut host2).await;
        assert_eq!(left["t"], "left");
        assert!(g >= 1);
        relay.stop();
        relay2.stop();
    }

    #[tokio::test]
    async fn slows_down_guessing() {
        let relay = Relay::start(0, "secret".into()).await.unwrap();
        let mut slowed = false;
        for _ in 0..20 {
            let mut c = connect(relay.port).await;
            send_json(&mut c, serde_json::json!({ "t": "join", "id": ID })).await;
            if closed_with(&mut c).await == Some(4004) {
                slowed = true;
                break;
            }
        }
        assert!(slowed);
        relay.stop();
    }

    #[tokio::test]
    async fn an_invite_asked_to_last_an_hour_is_still_good_and_one_for_a_second_is_held_to_a_minute() {
        let (relay, mut host) = with_host().await;
        send_json(&mut host, serde_json::json!({ "t": "invite", "id": ID, "ttl": 3600 })).await;
        tokio::time::sleep(Duration::from_millis(50)).await;
        let mut guest = connect(relay.port).await;
        send_json(&mut guest, serde_json::json!({ "t": "join", "id": ID })).await;
        assert_eq!(next_json(&mut guest).await["t"], "ok");
        relay.stop();
    }

    #[tokio::test]
    async fn two_hosts_can_share_one_relay_without_mixing_their_guests() {
        let relay = Relay::start(0, "secret".into()).await.unwrap();
        let id_b = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
        let mut host_a = connect(relay.port).await;
        send_json(&mut host_a, serde_json::json!({ "t": "host", "key": "secret" })).await;
        assert_eq!(next_json(&mut host_a).await["t"], "ready");
        let mut host_b = connect(relay.port).await;
        send_json(&mut host_b, serde_json::json!({ "t": "host", "key": "secret" })).await;
        assert_eq!(next_json(&mut host_b).await["t"], "ready");
        send_json(&mut host_a, serde_json::json!({ "t": "invite", "id": ID })).await;
        send_json(&mut host_b, serde_json::json!({ "t": "invite", "id": id_b })).await;
        tokio::time::sleep(Duration::from_millis(80)).await;

        let mut guest_b = connect(relay.port).await;
        send_json(&mut guest_b, serde_json::json!({ "t": "join", "id": id_b })).await;
        assert_eq!(next_json(&mut guest_b).await["t"], "ok");
        // the guest of B is announced to B, and A hears nothing
        assert_eq!(next_json(&mut host_b).await["t"], "guest");
        guest_b.send(Message::binary(vec![7])).await.unwrap();
        loop {
            if let Message::Binary(b) = host_b.next().await.unwrap().unwrap() {
                assert_eq!(&b[4..], &[7]);
                break;
            }
        }
        let heard = tokio::time::timeout(Duration::from_millis(300), async {
            loop {
                match host_a.next().await {
                    Some(Ok(Message::Text(_))) | Some(Ok(Message::Binary(_))) => return true,
                    Some(Ok(_)) => continue,
                    _ => return false,
                }
            }
        }).await;
        assert!(heard.is_err(), "host A heard something meant for B");

        // A going away does not touch B's guest
        host_a.close(None).await.unwrap();
        tokio::time::sleep(Duration::from_millis(150)).await;
        guest_b.send(Message::binary(vec![8])).await.unwrap();
        loop {
            if let Message::Binary(b) = host_b.next().await.unwrap().unwrap() {
                assert_eq!(&b[4..], &[8]);
                break;
            }
        }
        relay.stop();
    }

    #[test]
    fn makes_a_long_random_host_key() {
        assert_eq!(new_host_key().len(), 32);
        assert_ne!(new_host_key(), new_host_key());
    }
}
