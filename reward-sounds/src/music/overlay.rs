//! Оверлей для OBS: строка «Сейчас играет».
//!
//! Приложение поднимает крошечный HTTP-сервер на `127.0.0.1` и отдаёт страницу,
//! которую добавляют в OBS как «Браузер». Страница сама опрашивает состояние
//! (`/state`) и показывает трек: при заказе — всплывающая строка, во время
//! проигрывания — постоянная, с плавным затуханием по краям.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;

use serde::Serialize;

use super::service::Snapshot;

/// Порт оверлея.
pub const PORT: u16 = 8770;

/// Готовая страница (вшита в бинарник).
const PAGE: &str = include_str!("../../assets/overlay.html");

/// Страница чат-оверлея.
const CHAT_PAGE: &str = include_str!("../../assets/chat.html");

/// Сообщение чата для оверлея: только то, что нужно странице.
#[derive(Debug, Clone, Default, Serialize)]
pub struct ChatOverlayMessage {
    /// Идентификатор сообщения: по нему страница понимает, что пришло новое.
    pub id: String,
    /// Время сообщения в миллисекундах Unix.
    pub at_ms: u64,
    pub user: String,
    pub display_name: String,
    /// Цвет имени (`#RRGGBB`), если Twitch его задал.
    pub color: Option<String>,
    pub text: String,
    pub is_moderator: bool,
    pub is_broadcaster: bool,
}

/// Состояние чат-оверлея. Общее для Tauri-модуля чата и HTTP-сервера:
/// модуль кладёт сюда сообщения, страница читает их из `/chat/state`.
#[derive(Debug, Clone, Default, Serialize)]
pub struct ChatOverlayState {
    /// Последние сообщения, старые в начале.
    pub messages: Vec<ChatOverlayMessage>,
    /// Скрывать оверлей через N секунд без сообщений (0 — не скрывать).
    pub seconds: u64,
}

/// Глобальное состояние чат-оверлея: так Tauri-модуль чата подключается
/// к серверу, не меняя его сигнатуры (egui-версия остаётся нетронутой).
static CHAT_STATE: OnceLock<Arc<Mutex<ChatOverlayState>>> = OnceLock::new();

/// Подключает состояние чата к оверлею. Вызывается при запуске чат-сервиса.
pub fn set_chat_state(state: Arc<Mutex<ChatOverlayState>>) {
    if CHAT_STATE.set(state).is_err() {
        log::warn!("Чат-оверлей: состояние уже было подключено, повторная установка пропущена");
    }
}

/// Текущее состояние чат-оверлея (пока чат не запущен — `None`).
pub fn chat_state() -> Option<Arc<Mutex<ChatOverlayState>>> {
    CHAT_STATE.get().cloned()
}

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
    let mut buffer = [0u8; 1024];
    let _ = stream.read(&mut buffer);
    let request = String::from_utf8_lossy(&buffer);
    let path = request.split_whitespace().nth(1).unwrap_or("/");

    let (content_type, body) = response_for(path, state);

    let header = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: {content_type}\r\nCache-Control: no-store\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );

    let _ = stream.write_all(header.as_bytes());
    let _ = stream.write_all(body.as_bytes());
    let _ = stream.flush();
}

/// Выбирает ответ на путь запроса: страница или JSON состояния.
///
/// `/overlay` и `/state` — оверлей музыки (как раньше), `/chat` и
/// `/chat/state` — новый чат-оверлей.
fn response_for(path: &str, state: &Arc<Mutex<Snapshot>>) -> (&'static str, String) {
    if path.starts_with("/chat/state") {
        ("application/json; charset=utf-8", chat_state_json())
    } else if path.starts_with("/chat") {
        ("text/html; charset=utf-8", CHAT_PAGE.to_string())
    } else if path.starts_with("/state") {
        ("application/json; charset=utf-8", state_json(state))
    } else {
        ("text/html; charset=utf-8", PAGE.to_string())
    }
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

/// Состояние для страницы чат-оверлея.
///
/// Если чат-модуль ещё не подключился, отдаём пустой список: страница просто
/// ничего не покажет и продолжит опрос.
fn chat_state_json() -> String {
    let Some(state) = chat_state() else {
        return "{\"messages\":[],\"seconds\":0}".to_string();
    };
    let Ok(state) = state.lock() else {
        return "{\"messages\":[],\"seconds\":0}".to_string();
    };
    serde_json::to_string(&*state)
        .unwrap_or_else(|_| "{\"messages\":[],\"seconds\":0}".to_string())
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

        let (content_type, body) = response_for("/chat", &state);
        assert_eq!(content_type, "text/html; charset=utf-8");
        assert!(body.contains("<title>Чат</title>"));

        let (content_type, body) = response_for("/chat?theme=dark&opacity=60&font=16&max=12", &state);
        assert_eq!(content_type, "text/html; charset=utf-8");
        assert!(body.contains("/chat/state"));

        let (content_type, body) = response_for("/chat/state", &state);
        assert_eq!(content_type, "application/json; charset=utf-8");
        assert_eq!(body, "{\"messages\":[],\"seconds\":0}");

        // Старые маршруты музыки не сломались.
        let (content_type, body) = response_for("/overlay", &state);
        assert_eq!(content_type, "text/html; charset=utf-8");
        assert!(body.contains("<title>Сейчас играет</title>"));
        let (content_type, _) = response_for("/state", &state);
        assert_eq!(content_type, "application/json; charset=utf-8");
    }

    #[test]
    fn chat_state_serializes_for_overlay_page() {
        let state = ChatOverlayState {
            messages: vec![ChatOverlayMessage {
                id: "abc".to_string(),
                at_ms: 1_730_000_000_000,
                user: "viewer".to_string(),
                display_name: "Viewer".to_string(),
                color: Some("#FF0000".to_string()),
                text: "привет".to_string(),
                is_moderator: true,
                is_broadcaster: false,
            }],
            seconds: 0,
        };
        let json = serde_json::to_string(&state).unwrap();
        assert!(json.contains("\"messages\""));
        assert!(json.contains("\"id\":\"abc\""));
        assert!(json.contains("\"display_name\":\"Viewer\""));
        assert!(json.contains("\"is_moderator\":true"));
        assert!(json.contains("\"at_ms\":1730000000000"));
    }
}
