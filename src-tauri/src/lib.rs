use std::io::{Read, Write};
use std::net::{IpAddr, TcpListener, TcpStream, UdpSocket};
use std::sync::Mutex;
use std::thread;

use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use tauri::{AppHandle, Emitter, Manager, State};

const SERVICE_TYPE: &str = "_mylab._tcp.local.";
const INSTANCE_NAME: &str = "MyLabHost";

struct Connection(Mutex<Option<TcpStream>>);


fn get_local_ip() -> Result<IpAddr, String> {
    let socket = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    socket
        .connect("8.8.8.8:80")
        .map_err(|e| e.to_string())?;
    let addr = socket.local_addr().map_err(|e| e.to_string())?;
    Ok(addr.ip())
}


fn read_exact_or_eof(stream: &mut TcpStream, buf: &mut [u8]) -> std::io::Result<usize> {
    let mut total = 0usize;
    while total < buf.len() {
        match stream.read(&mut buf[total..])? {
            0 => return Ok(total),
            n => total += n,
        }
    }
    Ok(total)
}


#[tauri::command]
fn start_host(port: u16, app: AppHandle, state: State<Connection>) -> Result<String, String> {
    let listener = TcpListener::bind(format!("0.0.0.0:{}", port))
        .map_err(|e| format!("Не удалось открыть порт {}: {}", port, e))?;


    let local_ip = get_local_ip()?;
    let mdns = ServiceDaemon::new().map_err(|e| e.to_string())?;

    let service_info = ServiceInfo::new(
        SERVICE_TYPE,
        INSTANCE_NAME,
        &format!("{}.local.", INSTANCE_NAME),
        local_ip.to_string().as_str(),
        port,
        None,
    )
    .map_err(|e| e.to_string())?;

    mdns.register(service_info).map_err(|e| e.to_string())?;
    println!("mDNS зарегистрирован: {}:{}", local_ip, port);

    let app_handle = app.clone();
    thread::spawn(move || {
        match listener.accept() {
            Ok((stream, addr)) => {
                println!("Клиент подключился: {}", addr);

                {
                    let state = app_handle.state::<Connection>();
                    let mut conn = state.0.lock().unwrap();
                    *conn = Some(stream.try_clone().unwrap());
                }

                let _ = app_handle.emit("connected", ());
            }
            Err(e) => {
                eprintln!("Ошибка при подключении клиента: {}", e);
                let _ = app_handle.emit("connection_error", e.to_string());
            }
        }
    });

    Ok(format!("Хост запущен на {}:{}", local_ip, port))
}


#[tauri::command]
fn discover_host(app: AppHandle) -> Result<String, String> {
    let mdns = ServiceDaemon::new().map_err(|e| e.to_string())?;
    let receiver = mdns.browse(SERVICE_TYPE).map_err(|e| e.to_string())?;

    let app_handle = app.clone();
    thread::spawn(move || {
        while let Ok(event) = receiver.recv() {
            if let ServiceEvent::ServiceResolved(info) = event {
                let port = info.get_port();
                if let Some(ip) = info.get_addresses().iter().next() {
                    println!("Найден хост: {}:{}", ip, port);
                    let _ = app_handle.emit(
                        "host_found",
                        serde_json::json!({
                            "ip": ip.to_string(),
                            "port": port
                        }),
                    );
                }
            }
        }
    });

    Ok("Поиск начат".to_string())
}


#[tauri::command]
fn connect_to_host(
    ip: String,
    port: u16,
    app: AppHandle,
    state: State<Connection>,
) -> Result<String, String> {
    let stream = TcpStream::connect(format!("{}:{}", ip, port))
        .map_err(|e| format!("Не удалось подключиться к {}:{} — {}", ip, port, e))?;

    println!("Подключились к {}:{}", ip, port);

    {
        let mut conn = state.0.lock().unwrap();
        *conn = Some(stream.try_clone().unwrap());
    }

    let app_handle = app.clone();
    let mut stream_reader = stream;
    thread::spawn(move || {
        loop {
            let mut len_buf = [0u8; 4];
            match read_exact_or_eof(&mut stream_reader, &mut len_buf) {
                Ok(0) => {
                    println!("Соединение закрыто хостом");
                    break;
                }
                Ok(n) if n < 4 => {
                    eprintln!("Недополучено байт длины: {}", n);
                    break;
                }
                Ok(_) => {}
                Err(e) => {
                    eprintln!("Ошибка чтения длины: {}", e);
                    break;
                }
            }
            let len = u32::from_be_bytes(len_buf) as usize;

            let mut data = vec![0u8; len];
            match read_exact_or_eof(&mut stream_reader, &mut data) {
                Ok(n) if n < len => {
                    eprintln!("Недополучено байт данных: {}/{}", n, len);
                    break;
                }
                Ok(_) => {}
                Err(e) => {
                    eprintln!("Ошибка чтения данных: {}", e);
                    break;
                }
            }


            let _ = app_handle.emit("image_received", data);
        }
    });

    Ok("ok".to_string())
}

#[tauri::command]
fn send_image(image_bytes: Vec<u8>, state: State<Connection>) -> Result<(), String> {
    let mut conn = state.0.lock().unwrap();
    let stream = conn.as_mut().ok_or("Нет активного соединения")?;

    let len = (image_bytes.len() as u32).to_be_bytes();
    stream
        .write_all(&len)
        .map_err(|e| format!("Ошибка отправки длины: {}", e))?;
    stream
        .write_all(&image_bytes)
        .map_err(|e| format!("Ошибка отправки данных: {}", e))?;

    Ok(())
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Connection(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            start_host,
            discover_host,
            connect_to_host,
            send_image
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

