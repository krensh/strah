use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream, UdpSocket};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use serde::{Serialize, Deserialize};
use tauri::{AppHandle, Emitter, State, Manager};

// ================= СТРУКТУРЫ ДАННЫХ =================

#[derive(Serialize, Deserialize, Clone)]
pub enum ItemType {
    Potato,
    Bomb,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GameItem {
    pub id: String,
    pub item_type: ItemType,
    pub x_pos: f32,
    pub time_left: i32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PlayerState {
    pub hp: i32,
    pub score: i32,
    pub items: Vec<GameItem>,
    pub marionette: i32,
    pub is_blocked: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GameState {
    pub p1: PlayerState, // Хост
    pub p2: PlayerState, // Клиент
}

pub struct AppState(pub Arc<Mutex<GameState>>);
pub struct ConnectionState(pub Arc<Mutex<Option<TcpStream>>>);

impl Default for GameState {
    fn default() -> Self {
        Self {
            p1: PlayerState { hp: 100, score: 0, items: vec![], marionette: 15, is_blocked: false },
            p2: PlayerState { hp: 100, score: 0, items: vec![], marionette: 15, is_blocked: false },
        }
    }
}

// ================= ЛОГИКА ИГРЫ =================

fn process_player_tick(player: &mut PlayerState) {
    let mut new_hp = player.hp;
    let mut new_items = Vec::new();

    for mut item in player.items.drain(..) {
        item.time_left -= 1;
        match item.item_type {
            ItemType::Bomb => {
                if item.time_left <= 0 {
                    new_hp -= 30;
                } else {
                    new_items.push(item);
                }
            }
            ItemType::Potato => {
                if item.time_left <= 0 {
                    new_hp -= 1;
                    item.time_left = 2;
                }
                new_items.push(item);
            }
        }
    }

    player.hp = new_hp;
    player.items = new_items;
}

impl GameState {
    pub fn tick(&mut self) {
        process_player_tick(&mut self.p1);
        process_player_tick(&mut self.p2);

        if self.p1.items.len() < 7 && rand::random::<f32>() < 0.4 {
            self.p1.items.push(spawn_item());
        }
        if self.p2.items.len() < 7 && rand::random::<f32>() < 0.4 {
            self.p2.items.push(spawn_item());
        }

        if self.p1.hp <= 0 {
            self.p2.score += 1;
            self.p1.hp = 100; self.p2.hp = 100;
            self.p1.items.clear(); self.p2.items.clear();
        }
        if self.p2.hp <= 0 {
            self.p1.score += 1;
            self.p1.hp = 100; self.p2.hp = 100;
            self.p1.items.clear(); self.p2.items.clear();
        }
    }
}

fn spawn_item() -> GameItem {
    let is_bomb = rand::random::<f32>() < 0.7;
    GameItem {
        id: rand::random::<u32>().to_string(),
        item_type: if is_bomb { ItemType::Bomb } else { ItemType::Potato },
        x_pos: rand::random::<f32>() * 80.0 + 10.0,
        time_left: if is_bomb { 10 } else { 2 },
    }
}

// ================= ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ РАССЫЛКИ =================

fn broadcast_state(app: &AppHandle, game: &GameState, conn: &Arc<Mutex<Option<TcpStream>>>) {
    let json = format!("{}\n", serde_json::to_string(game).unwrap());
    let _ = app.emit("game_state", json.trim());
    if let Some(stream) = conn.lock().unwrap().as_mut() {
        let _ = stream.write_all(json.as_bytes());
    }
}

// ================= TAURI КОМАНДЫ =================

#[tauri::command]
fn get_local_ip() -> Result<String, String> {
    let socket = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    socket.connect("8.8.8.8:80").map_err(|e| e.to_string())?;
    let addr = socket.local_addr().map_err(|e| e.to_string())?;
    Ok(addr.ip().to_string())
}

#[tauri::command]
fn start_host(port: u16, app: AppHandle, state: State<AppState>, conn: State<ConnectionState>) -> Result<String, String> {
    let listener = TcpListener::bind(format!("0.0.0.0:{}", port)).map_err(|e| e.to_string())?;

    let arc_state = state.0.clone();
    let arc_conn_for_tick = conn.0.clone();
    let app_clone = app.clone();

    // Тик игры
    thread::spawn(move || {
        loop {
            thread::sleep(Duration::from_secs(1));
            let mut game = arc_state.lock().unwrap();
            game.tick();
            broadcast_state(&app_clone, &game, &arc_conn_for_tick);
        }
    });

    // Ожидание клиента и чтение его команд
    let arc_conn_for_accept = conn.0.clone();
    let app_handle = app.clone();
    let arc_state_for_accept = state.0.clone(); // клонируем стейт для чтения

    thread::spawn(move || {
        if let Ok((stream, _)) = listener.accept() {
            let _ = app_handle.emit("connected", ());
            *arc_conn_for_accept.lock().unwrap() = Some(stream.try_clone().unwrap());

            let mut reader = stream;
            let mut buf = [0; 1024];
            let mut buffer = String::new();

            while let Ok(n) = reader.read(&mut buf) {
                if n == 0 { break; }
                buffer.push_str(&String::from_utf8_lossy(&buf[..n]));

                while let Some(pos) = buffer.find('\n') {
                    let line = buffer[..pos].to_string();
                    buffer.drain(..=pos);

                    if line.starts_with("PASS:") {
                        let item_id = line.replace("PASS:", "").trim().to_string();
                        let mut game = arc_state_for_accept.lock().unwrap();

                        // Клиент шлет предмет ХОСТУ (в p1)
                        if let Some(pos) = game.p2.items.iter().position(|i| i.id == item_id) {
                            let mut item = game.p2.items.remove(pos);
                            item.time_left = if let ItemType::Bomb = item.item_type { 10 } else { 2 };
                            item.x_pos = rand::random::<f32>() * 80.0 + 10.0;
                            game.p1.items.push(item);

                            // Сразу рассылаем всем, чтобы предмет мгновенно появился у обоих
                            broadcast_state(&app_handle, &game, &arc_conn_for_accept);
                        }
                    }
                }
            }
        }
    });

    Ok("Сервер запущен".to_string())
}

#[tauri::command]
fn connect_to_host(ip: String, port: u16, app: AppHandle, conn: State<ConnectionState>) -> Result<String, String> {
    let stream = TcpStream::connect(format!("{}:{}", ip, port)).map_err(|e| e.to_string())?;
    *conn.0.lock().unwrap() = Some(stream.try_clone().unwrap());

    let app_handle = app.clone();
    let mut reader = stream;

    thread::spawn(move || {
        let mut buf = [0; 8192];
        let mut buffer = String::new();

        while let Ok(n) = reader.read(&mut buf) {
            if n == 0 { break; }
            buffer.push_str(&String::from_utf8_lossy(&buf[..n]));

            while let Some(pos) = buffer.find('\n') {
                let json_line = buffer[..pos].to_string();
                buffer.drain(..=pos);
                let _ = app_handle.emit("game_state", json_line);
            }
        }
    });

    Ok("ok".to_string())
}

#[tauri::command]
fn pass_item(item_id: String, is_host: bool, app: AppHandle, state: State<AppState>, conn: State<ConnectionState>) -> Result<(), String> {
    let mut game = state.0.lock().unwrap();

    if is_host {
        if let Some(pos) = game.p1.items.iter().position(|i| i.id == item_id) {
            let mut item = game.p1.items.remove(pos);
            item.time_left = if let ItemType::Bomb = item.item_type { 10 } else { 2 };
            item.x_pos = rand::random::<f32>() * 80.0 + 10.0;
            game.p2.items.push(item);

            // Мгновенно рассылаем
            broadcast_state(&app, &game, &conn.0);
        }
    } else {
        if let Some(stream) = conn.0.lock().unwrap().as_mut() {
            let msg = format!("PASS:{}\n", item_id);
            let _ = stream.write_all(msg.as_bytes());
        }
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState(Arc::new(Mutex::new(GameState::default()))))
        .manage(ConnectionState(Arc::new(Mutex::new(None))))
        .invoke_handler(tauri::generate_handler![
            start_host,
            connect_to_host,
            pass_item,
            get_local_ip
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
