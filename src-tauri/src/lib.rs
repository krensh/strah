use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use serde::Serialize;
use std::{
    net::{SocketAddr, TcpListener, TcpStream},
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, State};

const SERVICE_TYPE: &str = "_mylab._tcp.local.";
const DISCOVER_TIMEOUT: Duration = Duration::from_secs(30);

/// Состояние сети: держим демон хоста живым, пока сервер запущен.
#[derive(Default)]
struct NetState {
    host_daemon: Mutex<Option<ServiceDaemon>>,
}

#[derive(Serialize, Clone)]
struct HostFound {
    ip: String,
    port: u16,
}

// ---------- ХОСТ ----------

#[tauri::command]
fn start_host(app: AppHandle, state: State<NetState>, port: u16) -> Result<u16, String> {
    let mut guard = state.host_daemon.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        return Err("Хост уже запущен".into());
    }

    // 1. TCP-сервер (port = 0 -> ОС выберет свободный порт)
    let listener = TcpListener::bind(("0.0.0.0", port)).map_err(|e| e.to_string())?;
    let real_port = listener.local_addr().map_err(|e| e.to_string())?.port();

    // 2. Регистрация mDNS-сервиса
    let daemon = ServiceDaemon::new().map_err(|e| e.to_string())?;
    let info = ServiceInfo::new(
        SERVICE_TYPE,
        "MyLab Host",        // имя экземпляра
        "mylab-host.local.", // hostname, должен заканчиваться на ".local."
        "",                  // IP пустой + enable_addr_auto() = подставит адреса интерфейсов
        real_port,
        None::<std::collections::HashMap<String, String>>,
    )
    .map_err(|e| e.to_string())?
    .enable_addr_auto();

    daemon.register(info).map_err(|e| e.to_string())?;
    *guard = Some(daemon);

    // 3. Принимаем клиентов в отдельном потоке
    //    (сюда подключи свою настоящую обработку соединений)
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            if let Ok(s) = stream {
                let peer = s.peer_addr().map(|a| a.to_string()).unwrap_or_default();
                let _ = app.emit("client_connected", peer);
                // TODO: твоя игровая сетевая логика со stream
            }
        }
    });

    Ok(real_port)
}

#[tauri::command]
fn stop_host(state: State<NetState>) -> Result<(), String> {
    if let Some(d) = state.host_daemon.lock().map_err(|e| e.to_string())?.take() {
        let _ = d.shutdown(); // снимает объявление сервиса из сети
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
                    // Предпочитаем IPv4
                    let ip = info.get_addresses().iter().find(|a| a.is_ipv4()).copied();
                    if let Some(ip) = ip {
                        let _ = app.emit(
                            "host_found",
                            HostFound { ip: ip.to_string(), port: info.get_port() },
                        );
                        break;
                    }
                }
                Ok(_) => {}  // SearchStarted, ServiceFound и т.д. — игнорируем
                Err(_) => {  // таймаут или канал закрыт
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

/// Подключение к найденному хосту (замени на свою логику сокета)
#[tauri::command]
fn connect_to_host(ip: String, port: u16) -> Result<(), String> {
    let addr: SocketAddr = format!("{}:{}", ip, port).parse().map_err(|e| format!("{e}"))?;
    let _stream = TcpStream::connect_timeout(&addr, Duration::from_secs(5))
        .map_err(|e| e.to_string())?;
    // TODO: сохрани stream в состоянии, если он нужен игре
    Ok(())
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
            connect_to_host
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}