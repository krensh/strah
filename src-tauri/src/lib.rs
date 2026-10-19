use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use serde::Serialize;
use std::{
    collections::HashMap,
    io::{BufRead, BufReader, Write},
    net::{SocketAddr, TcpListener, TcpStream},
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager, State};

const SERVICE_TYPE: &str = "_mylab._tcp.local.";
const DISCOVER_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Default)]
struct NetState {
    host_daemon: Mutex<Option<ServiceDaemon>>,
    stream: Mutex<Option<TcpStream>>,
}

#[derive(Serialize, Clone)]
struct HostFound {
    ip: String,
    port: u16,
}

/// Сохраняет соединение и читает входящие предметы (по одному на строку)
fn setup_stream(app: &AppHandle, stream: TcpStream) {
    let _ = stream.set_nodelay(true);
    let Ok(reader) = stream.try_clone() else { return };
    *app.state::<NetState>().stream.lock().unwrap() = Some(stream);

    let app2 = app.clone();
    std::thread::spawn(move || {
        for line in BufReader::new(reader).lines() {
            match line {
                Ok(kind) => {
                    let _ = app2.emit("item_received", kind);
                }
                Err(_) => break,
            }
        }
        let _ = app2.emit("peer_disconnected", ());
    });
}

// ---------- ХОСТ ----------

#[tauri::command]
fn start_host(app: AppHandle, state: State<NetState>, port: u16) -> Result<u16, String> {
    let mut guard = state.host_daemon.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        return Err("Хост уже запущен".into());
    }

    let listener = TcpListener::bind(("0.0.0.0", port)).map_err(|e| e.to_string())?;
    let real_port = listener.local_addr().map_err(|e| e.to_string())?.port();

    let daemon = ServiceDaemon::new().map_err(|e| e.to_string())?;
    let info = ServiceInfo::new(
        SERVICE_TYPE,
        "MyLab Host",
        "mylab-host.local.",
        "",
        real_port,
        None::<HashMap<String, String>>,
    )
    .map_err(|e| e.to_string())?
    .enable_addr_auto();

    daemon.register(info).map_err(|e| e.to_string())?;
    *guard = Some(daemon);

    std::thread::spawn(move || {
        if let Ok((s, addr)) = listener.accept() {
            setup_stream(&app, s);
            let _ = app.emit("client_connected", addr.to_string());
        }
    });

    Ok(real_port)
}

#[tauri::command]
fn stop_host(state: State<NetState>) -> Result<(), String> {
    if let Some(d) = state.host_daemon.lock().map_err(|e| e.to_string())?.take() {
        let _ = d.shutdown();
    }
    Ok(())
}

// ---------- КЛИЕНТ ----------

#[tauri::command]
fn discover_host(app: AppHandle) -> Result<(), String> {
    let daemon = ServiceDaemon::new().map_err(|e| e.to_string())?;
    let receiver = daemon.browse(SERVICE_TYPE).map_err(|e| e.to_string())?;

    std::thread::spawn(move || {
        let started = Instant::now();
        loop {
            let left = DISCOVER_TIMEOUT.saturating_sub(started.elapsed());
            if left.is_zero() {
                let _ = app.emit("host_search_timeout", ());
                break;
            }
            match receiver.recv_timeout(left) {
                Ok(ServiceEvent::ServiceResolved(info)) => {
                    let ip = info.get_addresses().iter().find(|a| a.is_ipv4()).copied();
                    if let Some(ip) = ip {
                        let _ = app.emit(
                            "host_found",
                            HostFound { ip: ip.to_string(), port: info.get_port() },
                        );
                        break;
                    }
                }
                Ok(_) => {}
                Err(_) => {
                    let _ = app.emit("host_search_timeout", ());
                    break;
                }
            }
        }
        let _ = daemon.stop_browse(SERVICE_TYPE);
        let _ = daemon.shutdown();
    });

    Ok(())
}

#[tauri::command]
fn connect_to_host(app: AppHandle, ip: String, port: u16) -> Result<(), String> {
    let addr: SocketAddr = format!("{}:{}", ip, port)
        .parse()
        .map_err(|e| format!("{e}"))?;
    let stream = TcpStream::connect_timeout(&addr, Duration::from_secs(5))
        .map_err(|e| e.to_string())?;
    setup_stream(&app, stream);
    Ok(())
}

// ---------- ИГРА ----------

#[tauri::command]
fn send_item(state: State<NetState>, kind: String) -> Result<(), String> {
    if kind != "potato" && kind != "bomb" {
        return Err("неизвестный предмет".into());
    }
    let mut guard = state.stream.lock().map_err(|e| e.to_string())?;
    let s = guard.as_mut().ok_or("нет соединения")?;
    writeln!(s, "{kind}").map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(NetState::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            start_host,
            stop_host,
            discover_host,
            connect_to_host,
            send_item
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}