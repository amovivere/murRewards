//! Оверлей для OBS: строка «Сейчас играет».
//!
//! Приложение поднимает крошечный HTTP-сервер на `127.0.0.1` и отдаёт страницу,
//! которую добавляют в OBS как «Браузер». Страница сама опрашивает состояние
//! (`/state`) и показывает трек: при заказе — всплывающая строка, во время
//! проигрывания — постоянная, с плавным затуханием по краям.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::thread;

use super::service::Snapshot;

/// Порт оверлея.
pub const PORT: u16 = 8770;

/// Готовая страница (вшита в бинарник).
const PAGE: &str = include_str!("../../assets/overlay.html");

/// Запускает сервер оверлея в фоне.
pub fn spawn(state: Arc<Mutex<Snapshot>>, port: u16) {
    let spawned = thread::Builder::new()
        .name("music-overlay".to_string())
        .spawn(move || {
            let Ok(listener) = TcpListener::bind(("127.0.0.1", port)) else {
                log::warn!("Оверлей: порт {port} занят, строка «Сейчас играет» недоступна");
                return;
            };
            log::info!("Оверлей: http://127.0.0.1:{port}/overlay");

            for stream in listener.incoming().flatten() {
                let state = Arc::clone(&state);
                let _ = thread::Builder::new().spawn(move || handle(stream, &state));
            }
        });

    if let Err(err) = spawned {
        log::error!("Оверлей: не удалось запустить сервер: {err}");
    }
}

/// Обрабатывает один запрос браузера.
fn handle(mut stream: TcpStream, state: &Arc<Mutex<Snapshot>>) {
    let mut buffer = [0u8; 1024];
    let _ = stream.read(&mut buffer);
    let request = String::from_utf8_lossy(&buffer);
    let path = request.split_whitespace().nth(1).unwrap_or("/");

    let (content_type, body) = if path.starts_with("/state") {
        ("application/json; charset=utf-8", state_json(state))
    } else {
        ("text/html; charset=utf-8", PAGE.to_string())
    };

    let header = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: {content_type}\r\nCache-Control: no-store\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );

    let _ = stream.write_all(header.as_bytes());
    let _ = stream.write_all(body.as_bytes());
    let _ = stream.flush();
}

/// Состояние для страницы оверлея.
fn state_json(state: &Arc<Mutex<Snapshot>>) -> String {
    let Ok(snapshot) = state.lock() else {
        return "{}".to_string();
    };

    let playing = snapshot
        .current
        .as_ref()
        .map(|_| !snapshot.player.paused && !snapshot.player.finished)
        .unwrap_or(false);
    // Строку показываем только первые 10 секунд после старта трека
    // и по команде из чата.
    let show = playing && snapshot.overlay_ms > 0;

    let (title, channel, user, duration) = match snapshot.current.as_ref() {
        Some(item) => (
            item.title.clone(),
            item.channel.clone(),
            item.user_login.clone(),
            item.duration_sec,
        ),
        None => (String::new(), String::new(), String::new(), 0),
    };

    let queue = snapshot
        .items
        .iter()
        .filter(|item| !item.state.is_final())
        .map(|item| {
            format!(
                "{{\"id\":{},\"title\":{},\"user\":{}}}",
                json_str(&item.redemption_id),
                json_str(&item.label()),
                json_str(&item.user_login)
            )
        })
        .collect::<Vec<_>>()
        .join(",");

    format!(
        "{{\"show\":{},\"playing\":{},\"title\":{},\"channel\":{},\"user\":{},\"position\":{},\"font\":{},\"position_sec\":{},\"duration\":{},\"queue\":[{}]}}",
        show,
        playing,
        json_str(&title),
        json_str(&channel),
        json_str(&user),
        json_str(&snapshot.overlay_position),
        snapshot.overlay_font,
        snapshot.player.position_sec,
        duration,
        queue
    )
}

/// Экранирует строку для JSON.
fn json_str(value: &str) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "\"\"".to_string())
}
