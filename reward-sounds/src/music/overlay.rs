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

use crate::config::AppPaths;
use super::service::Snapshot;

/// Порт оверлея.
pub const PORT: u16 = 8770;

/// Готовая страница (вшита в бинарник).
const PAGE: &str = include_str!("../../assets/overlay.html");
/// Страница оверлея «картинка награды».
const IMAGE_PAGE: &str = include_str!("../../assets/image-reward.html");

/// Страница чат-оверлея (перенесена из reference-проекта twitch-chat-overlay).
const CHAT_OVERLAY_PAGE: &str = include_str!("../../assets/chat-overlay.html");

/// Настройки чат-оверлея по умолчанию (файл в AppData может их переопределить).
const CHAT_OVERLAY_SETTINGS_DEFAULT: &str =
    include_str!("../../assets/chat-overlay-settings.js");

/// Страница настроек чат-оверлея (адаптированный config.html reference-проекта).
const CHAT_CONFIG_PAGE: &str = include_str!("../../assets/chat-overlay-config.html");

/// Запускает сервер оверлея в фоне.
pub fn spawn(state: Arc<Mutex<Snapshot>>, port: u16) {
    let spawned = thread::Builder::new()
        .name("music-overlay".to_string())
        .spawn(move || {
            let Ok(listener) = TcpListener::bind(("127.0.0.1", port)) else {
                log::warn!("Оверлей: порт {port} занят, строка «Сейчас играет» недоступна");
                if let Ok(mut snapshot) = state.lock() {
                    snapshot.overlay_ready = false;
                }
                return;
            };
            if let Ok(mut snapshot) = state.lock() {
                snapshot.overlay_ready = true;
            }
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
    let mut buffer = Vec::new();
    let mut chunk = [0u8; 4096];
    loop {
        let read = stream.read(&mut chunk).unwrap_or(0);
        if read == 0 {
            break;
        }
        buffer.extend_from_slice(&chunk[..read]);
        if buffer.len() > 512 * 1024 {
            break;
        }
        if let Some(header_end) = find_header_end(&buffer) {
            if let Some(length) = content_length(&buffer[..header_end]) {
                if buffer.len() >= header_end + 4 + length {
                    break;
                }
            } else {
                break;
            }
        }
    }

    let request = String::from_utf8_lossy(&buffer);
    let mut parts = request.split_whitespace();
    let method = parts.next().unwrap_or("GET");
    let path = parts.next().unwrap_or("/");
    let body_start = find_header_end(&buffer)
        .map(|index| index + 4)
        .unwrap_or(buffer.len());
    let body = &buffer[body_start.min(buffer.len())..];

    if path.starts_with("/image-reward/thumb/") {
        let rest = path
            .trim_start_matches("/image-reward/thumb/")
            .split('?')
            .next()
            .unwrap_or("");
        let mut parts = rest.split('/');
        let reward_id = parts.next().unwrap_or("");
        let index = parts.next().and_then(|value| value.parse::<usize>().ok()).unwrap_or(0);
        let Some(bytes) = crate::image_reward::library_media(reward_id, index) else {
            let body = b"not found";
            let header = format!(
                "HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                body.len()
            );
            let _ = stream.write_all(header.as_bytes());
            let _ = stream.write_all(body);
            return;
        };
        let content_type = crate::image_reward::library_content_type(reward_id, index);
        let header = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: {content_type}\r\nCache-Control: no-cache\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
            bytes.len()
        );
        let _ = stream.write_all(header.as_bytes());
        let _ = stream.write_all(&bytes);
        let _ = stream.flush();
        return;
    }

    if path.starts_with("/image-reward/media") {
        let Some(bytes) = crate::image_reward::media_bytes() else {
            let body = b"not found";
            let header = format!(
                "HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                body.len()
            );
            let _ = stream.write_all(header.as_bytes());
            let _ = stream.write_all(body);
            return;
        };
        let content_type = crate::image_reward::media_content_type();
        let header = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: {content_type}\r\nCache-Control: no-store\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
            bytes.len()
        );
        let _ = stream.write_all(header.as_bytes());
        let _ = stream.write_all(&bytes);
        let _ = stream.flush();
        return;
    }

    let (status, content_type, body) = if method == "POST" && path.starts_with("/chat-overlay/save") {
        save_chat_overlay(body)
    } else {
        let (content_type, body) = response_for(path, state);
        (200, content_type, body)
    };

    let reason = match status {
        200 => "OK",
        400 => "Bad Request",
        500 => "Internal Server Error",
        _ => "OK",
    };
    let header = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: {content_type}\r\nCache-Control: no-store\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );

    let _ = stream.write_all(header.as_bytes());
    let _ = stream.write_all(body.as_bytes());
    let _ = stream.flush();
}

/// Ищет конец заголовков HTTP-запроса.
fn find_header_end(buffer: &[u8]) -> Option<usize> {
    buffer.windows(4).position(|window| window == b"\r\n\r\n")
}

/// Длина тела запроса из `Content-Length`.
fn content_length(headers: &[u8]) -> Option<usize> {
    String::from_utf8_lossy(headers).lines().find_map(|line| {
        let (name, value) = line.split_once(':')?;
        if name.eq_ignore_ascii_case("content-length") {
            value.trim().parse::<usize>().ok()
        } else {
            None
        }
    })
}

/// Сохраняет настройки, присланные страницей настроек.
fn save_chat_overlay(body: &[u8]) -> (u16, &'static str, String) {
    let text = String::from_utf8_lossy(body);
    let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) else {
        return (400, "application/json; charset=utf-8", "{\"ok\":false,\"error\":\"invalid json\"}".to_string());
    };
    let valid = value
        .get("presets")
        .and_then(|presets| presets.as_array())
        .map(|presets| !presets.is_empty())
        .unwrap_or(false);
    if !valid {
        return (400, "application/json; charset=utf-8", "{\"ok\":false,\"error\":\"no presets\"}".to_string());
    }
    let path = AppPaths::resolve()
        .data_dir
        .join("chat_overlay_settings.js");
    let file = format!(
        "// Twitch Chat Overlay — настройки.\n// Файл создаётся приложением Reward Sounds.\nwindow.OVERLAY_SETTINGS = {text};\n"
    );
    match std::fs::write(&path, file) {
        Ok(()) => (
            200,
            "application/json; charset=utf-8",
            "{\"ok\":true}".to_string(),
        ),
        Err(error) => {
            log::warn!("Чат-оверлей: не удалось сохранить настройки: {error}");
            (
                500,
                "application/json; charset=utf-8",
                "{\"ok\":false,\"error\":\"write failed\"}".to_string(),
            )
        }
    }
}

/// Выбирает ответ на путь запроса: страница или JSON состояния.
///
/// `/overlay` и `/state` — оверлей музыки, `/chat-overlay` — оверлей чата
/// (страница, настройки и конфигуратор).
fn response_for(path: &str, state: &Arc<Mutex<Snapshot>>) -> (&'static str, String) {
    if path.starts_with("/image-reward/state") {
        (
            "application/json; charset=utf-8",
            crate::image_reward::state_json(),
        )
    } else if path.starts_with("/image-reward") {
        ("text/html; charset=utf-8", IMAGE_PAGE.to_string())
    } else if path.starts_with("/chat-overlay/settings.js") {
        ("application/javascript; charset=utf-8", chat_overlay_settings())
    } else if path.starts_with("/chat-overlay/config") {
        ("text/html; charset=utf-8", CHAT_CONFIG_PAGE.to_string())
    } else if path.starts_with("/chat-overlay") {
        ("text/html; charset=utf-8", CHAT_OVERLAY_PAGE.to_string())
    } else if path.starts_with("/state") {
        ("application/json; charset=utf-8", state_json(state))
    } else {
        ("text/html; charset=utf-8", PAGE.to_string())
    }
}

/// Отдаёт настройки чат-оверлея из AppData, иначе встроенные по умолчанию.
fn chat_overlay_settings() -> String {
    let path = AppPaths::resolve()
        .data_dir
        .join("chat_overlay_settings.js");
    std::fs::read_to_string(path).unwrap_or_else(|_| CHAT_OVERLAY_SETTINGS_DEFAULT.to_string())
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn routes_chat_overlay_and_keeps_music_routes() {
        let state = Arc::new(Mutex::new(Snapshot::default()));

        let (content_type, body) = response_for("/chat-overlay", &state);
        assert_eq!(content_type, "text/html; charset=utf-8");
        assert!(body.contains("<title>Twitch Chat Overlay</title>"));

        let (content_type, body) = response_for("/chat-overlay/config", &state);
        assert_eq!(content_type, "text/html; charset=utf-8");
        assert!(body.contains("Настройки чата"));

        let (content_type, body) = response_for("/chat-overlay/settings.js", &state);
        assert_eq!(content_type, "application/javascript; charset=utf-8");
        assert!(body.contains("OVERLAY_SETTINGS"));

        // Маршруты музыки не сломались.
        let (content_type, body) = response_for("/overlay", &state);
        assert_eq!(content_type, "text/html; charset=utf-8");
        assert!(body.contains("<title>Сейчас играет</title>"));
        let (content_type, _) = response_for("/state", &state);
        assert_eq!(content_type, "application/json; charset=utf-8");
    }
}
