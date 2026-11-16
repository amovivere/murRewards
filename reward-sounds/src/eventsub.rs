//! EventSub WebSocket: события активации наград Twitch.
//!
//! Работает через официальный WebSocket Twitch (`wss://eventsub.wss.twitch.tv/ws`):
//! после подключения создаётся подписка на
//! `channel.channel_points_custom_reward_redemption.add`, а затем приходят
//! уведомления о наградах. Сервис сам переподключается при обрыве связи,
//! обрабатывает `reconnect_url`, не создаёт дубликаты подписок и отбрасывает
//! повторно доставленные события.

use std::collections::{HashSet, VecDeque};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use crate::http::{self, WsMessage};
use crate::json::{self, JsonExt};
use crate::playback::Playback;

const WS_URL: &str = "wss://eventsub.wss.twitch.tv/ws";
const SUBSCRIPTIONS_URL: &str = "https://api.twitch.tv/helix/eventsub/subscriptions";

/// Тип события: активация пользовательской награды Channel Points.
pub const SUBSCRIPTION_TYPE: &str = "channel.channel_points_custom_reward_redemption.add";

/// Активация награды.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Redemption {
    pub redemption_id: String,
    pub reward_id: String,
    pub reward_title: String,
    pub user_login: String,
    /// Текст, который зритель ввёл в поле награды (для «Трек по заявке» — ссылка).
    pub user_input: String,
    /// Время активации по данным Twitch: по нему выстраивается очередь.
    pub redeemed_at: String,
}

/// События сервиса для интерфейса.
#[derive(Debug, Clone)]
pub enum Event {
    /// Соединение установлено и подписка активна.
    Connected,
    /// Зритель активировал награду.
    Redemption(Redemption),
    /// Соединение потеряно; сервис переподключается сам.
    Disconnected(String),
    /// Twitch отозвал подписку.
    Revoked(String),
    /// Токен не принят: нужно обновить вход.
    Unauthorized,
    /// Дальше слушать нельзя (ошибка доступа).
    Failed(String),
}

enum Command {
    Start {
        client_id: String,
        access_token: String,
        broadcaster_id: String,
    },
    Stop,
}

/// Фоновый сервис EventSub.
pub struct Service {
    commands: Sender<Command>,
    events: Receiver<Event>,
    stop: Arc<AtomicBool>,
}

impl Service {
    /// Запускает сервис без окна egui — для Tauri/фонового режима.
    /// Контекст нужен только для `request_repaint`, здесь он пустой.
    pub fn spawn_headless(playback: Playback) -> Self {
        Self::spawn(playback, eframe::egui::Context::default())
    }

    pub fn spawn(playback: Playback, ctx: eframe::egui::Context) -> Self {
        let (command_tx, command_rx) = mpsc::channel();
        let (event_tx, event_rx) = mpsc::channel();
        let stop = Arc::new(AtomicBool::new(false));

        let thread_stop = Arc::clone(&stop);
        if let Err(err) = thread::Builder::new()
            .name("reward-sounds-eventsub".to_string())
            .spawn(move || worker(command_rx, event_tx, thread_stop, playback, ctx))
        {
            log::error!("Не удалось запустить поток EventSub: {err}");
        }

        Self {
            commands: command_tx,
            events: event_rx,
            stop,
        }
    }

    /// Начинает слушать события канала.
    pub fn start(&self, client_id: &str, access_token: &str, broadcaster_id: &str) {
        self.stop.store(false, Ordering::SeqCst);
        let _ = self.commands.send(Command::Start {
            client_id: client_id.to_string(),
            access_token: access_token.to_string(),
            broadcaster_id: broadcaster_id.to_string(),
        });
    }

    /// Останавливает прослушивание.
    pub fn stop(&self) {
        self.stop.store(true, Ordering::SeqCst);
        let _ = self.commands.send(Command::Stop);
    }

    pub fn poll(&self) -> Vec<Event> {
        self.events.try_iter().collect()
    }
}

impl Drop for Service {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
    }
}

fn worker(
    commands: Receiver<Command>,
    events: Sender<Event>,
    stop: Arc<AtomicBool>,
    playback: Playback,
    ctx: eframe::egui::Context,
) {
    while let Ok(command) = commands.recv() {
        match command {
            Command::Start {
                client_id,
                access_token,
                broadcaster_id,
            } => {
                run(
                    &client_id,
                    &access_token,
                    &broadcaster_id,
                    &events,
                    &stop,
                    &playback,
                    &ctx,
                );
            }
            Command::Stop => {
                stop.store(true, Ordering::SeqCst);
            }
        }
    }
}

/// Отправляет событие интерфейсу и будит его: без этого при простое окна
/// смена статуса прослушивания замечалась бы только после движения мыши.
fn emit(events: &Sender<Event>, ctx: &eframe::egui::Context, event: Event) {
    let _ = events.send(event);
    ctx.request_repaint();
}

fn run(
    client_id: &str,
    access_token: &str,
    broadcaster_id: &str,
    events: &Sender<Event>,
    stop: &AtomicBool,
    playback: &Playback,
    ctx: &eframe::egui::Context,
) {
    let mut url = WS_URL.to_string();
    let mut session_id: Option<String> = None;
    let mut backoff = 2u64;
    let mut dedupe = Dedupe::new();

    loop {
        if stop.load(Ordering::SeqCst) {
            return;
        }

        match listen_once(
            &url,
            client_id,
            access_token,
            broadcaster_id,
            events,
            stop,
            &mut session_id,
            &mut dedupe,
            playback,
            ctx,
        ) {
            Ok(Flow::Stop) => return,
            Ok(Flow::Switch(new_url)) => {
                url = new_url;
                backoff = 2;
            }
            Err(SessionError::Auth) => {
                emit(events, ctx, Event::Unauthorized);
                return;
            }
            Err(SessionError::Fatal(message)) => {
                emit(events, ctx, Event::Failed(message));
                return;
            }
            Err(SessionError::Network(message)) => {
                log::warn!("EventSub: соединение потеряно ({message}), переподключаемся");
                session_id = None;
                emit(events, ctx, Event::Disconnected(message));
                if !sleep_cancellable(Duration::from_secs(backoff), stop) {
                    return;
                }
                backoff = (backoff * 2).min(30);
                url = WS_URL.to_string();
            }
        }
    }
}

enum Flow {
    Stop,
    Switch(String),
}

enum SessionError {
    Auth,
    Fatal(String),
    Network(String),
}

enum SubError {
    Unauthorized,
    Failed(String),
    Network(String),
}

#[allow(clippy::too_many_arguments)]
fn listen_once(
    url: &str,
    client_id: &str,
    access_token: &str,
    broadcaster_id: &str,
    events: &Sender<Event>,
    stop: &AtomicBool,
    session_id: &mut Option<String>,
    dedupe: &mut Dedupe,
    playback: &Playback,
    ctx: &eframe::egui::Context,
) -> Result<Flow, SessionError> {
    let mut socket = http::WebSocket::connect(url, &[]).map_err(SessionError::Network)?;

    // Ждём session_welcome (или сразу reconnect).
    let mut welcome: Option<(String, u64)> = None;
    let started = Instant::now();

    while started.elapsed() < Duration::from_secs(15) {
        if stop.load(Ordering::SeqCst) {
            socket.close();
            return Ok(Flow::Stop);
        }

        match socket.receive() {
            Ok(WsMessage::Text(text)) => {
                let value = json::parse(&text).map_err(|err| {
                    SessionError::Network(format!("Некорректный ответ Twitch: {err}"))
                })?;
                match message_type(&value) {
                    "session_welcome" => {
                        welcome = parse_welcome(&value);
                        break;
                    }
                    "session_reconnect" => {
                        if let Some(new_url) = parse_reconnect_url(&value) {
                            socket.close();
                            return Ok(Flow::Switch(new_url));
                        }
                    }
                    _ => {}
                }
            }
            Ok(WsMessage::Timeout) => {}
            Ok(WsMessage::Closed) => {
                return Err(SessionError::Network(
                    "Twitch закрыл соединение при подключении".to_string(),
                ))
            }
            Err(err) => return Err(SessionError::Network(err)),
        }
    }

    let (session, keepalive_seconds) =
        welcome.ok_or_else(|| SessionError::Network("Twitch не прислал идентификатор сессии".to_string()))?;

    let is_new_session = session_id.as_deref() != Some(session.as_str());
    if is_new_session {
        subscribe(client_id, access_token, broadcaster_id, &session).map_err(|err| match err {
            SubError::Unauthorized => SessionError::Auth,
            SubError::Failed(message) => SessionError::Fatal(message),
            SubError::Network(message) => SessionError::Network(message),
        })?;
        *session_id = Some(session.clone());
        log::info!("EventSub: подписка на награды активна (сессия {session})");
    }
    emit(events, ctx, Event::Connected);

    let max_idle = Duration::from_secs((keepalive_seconds.saturating_mul(3)).max(30));
    let mut last_message = Instant::now();

    loop {
        if stop.load(Ordering::SeqCst) {
            socket.close();
            return Ok(Flow::Stop);
        }

        match socket.receive() {
            Ok(WsMessage::Text(text)) => {
                last_message = Instant::now();
                let value = match json::parse(&text) {
                    Ok(value) => value,
                    Err(err) => {
                        log::warn!("EventSub: пропущено некорректное сообщение ({err})");
                        continue;
                    }
                };

                match message_type(&value) {
                    "notification" => {
                        if let Some(redemption) = parse_redemption(&value) {
                            if dedupe.insert(&redemption.redemption_id) {
                                playback.play(&redemption);
                                emit(events, ctx, Event::Redemption(redemption));
                            } else {
                                log::debug!("EventSub: повторное событие пропущено");
                            }
                        }
                    }
                    "session_reconnect" => {
                        if let Some(new_url) = parse_reconnect_url(&value) {
                            log::info!("EventSub: Twitch просит переподключиться");
                            socket.close();
                            return Ok(Flow::Switch(new_url));
                        }
                    }
                    "revocation" => {
                        let status = value
                            .get("payload")
                            .and_then(|payload| payload.get("subscription"))
                            .and_then(|subscription| subscription.str_field("status"))
                            .unwrap_or("revoked");
                        emit(
                            events,
                            ctx,
                            Event::Revoked(format!(
                                "Twitch отозвал подписку на награды ({status})."
                            )),
                        );
                        socket.close();
                        return Ok(Flow::Switch(WS_URL.to_string()));
                    }
                    _ => {}
                }
            }
            Ok(WsMessage::Timeout) => {
                if last_message.elapsed() > max_idle {
                    return Err(SessionError::Network(
                        "нет данных от Twitch слишком долго".to_string(),
                    ));
                }
            }
            Ok(WsMessage::Closed) => {
                return Err(SessionError::Network("Twitch закрыл соединение".to_string()))
            }
            Err(err) => {
                if last_message.elapsed() > max_idle {
                    return Err(SessionError::Network(
                        "нет данных от Twitch слишком долго".to_string(),
                    ));
                }
                return Err(SessionError::Network(err));
            }
        }
    }
}

/// Создаёт подписку, предварительно убрав устаревшие подписки этой сессии.
/// Создаёт подписку на активации наград.
///
/// Предварительный запрос списка подписок не нужен: если подписка уже есть,
/// Twitch ответит 409, и мы аккуратно заменим её.
fn subscribe(
    client_id: &str,
    access_token: &str,
    broadcaster_id: &str,
    session_id: &str,
) -> Result<(), SubError> {
    let headers = || {
        vec![
            ("Client-Id".to_string(), client_id.to_string()),
            (
                "Authorization".to_string(),
                format!("Bearer {access_token}"),
            ),
        ]
    };

    let request_body = json::json!({
        "type": SUBSCRIPTION_TYPE,
        "version": "1",
        "condition": { "broadcaster_user_id": broadcaster_id },
        "transport": { "method": "websocket", "session_id": session_id }
    })
    .to_string();

    let first_attempt = http::post_json(SUBSCRIPTIONS_URL, &headers(), &request_body)
        .map_err(SubError::Network)?;

    match first_attempt.status {
        200 | 202 => {
            log::info!("EventSub: подписка на активации наград создана");
            return Ok(());
        }
        401 => return Err(SubError::Unauthorized),
        403 => {
            return Err(SubError::Failed(format!(
                "Нет доступа к событиям наград. {}",
                api_message(&first_attempt)
            )))
        }
        409 => {
            // Подписка уже существует (например, от предыдущей сессии).
            // Удаляем её и создаём заново уже для текущей сессии.
            log::info!("EventSub: подписка уже существует, обновляем её");
            if let Some(existing_id) = first_data_id(&first_attempt.body) {
                let delete_url =
                    format!("{SUBSCRIPTIONS_URL}?id={}", http::form_encode(&existing_id));
                match http::delete(&delete_url, &headers()) {
                    Ok(response) if response.is_success() => {
                        log::info!("EventSub: старая подписка {existing_id} удалена");
                    }
                    Ok(response) => log::warn!(
                        "EventSub: не удалось удалить старую подписку {existing_id} (HTTP {})",
                        response.status
                    ),
                    Err(err) => {
                        log::warn!("EventSub: не удалось удалить старую подписку {existing_id} ({err})")
                    }
                }

                let retry = http::post_json(SUBSCRIPTIONS_URL, &headers(), &request_body)
                    .map_err(SubError::Network)?;
                match retry.status {
                    200 | 202 => {
                        log::info!("EventSub: подписка на активации наград создана");
                        return Ok(());
                    }
                    409 => {
                        log::warn!("EventSub: подписка уже существует, продолжаем с ней");
                        return Ok(());
                    }
                    401 => return Err(SubError::Unauthorized),
                    status => {
                        return Err(SubError::Failed(format!(
                            "Twitch не создал подписку на награды (HTTP {status}). {}",
                            api_message(&retry)
                        )))
                    }
                }
            }

            log::warn!("EventSub: подписка уже существует, продолжаем с ней");
            return Ok(());
        }
        status => {
            return Err(SubError::Failed(format!(
                "Twitch не создал подписку на награды (HTTP {status}). {}",
                api_message(&first_attempt)
            )))
        }
    }
}

/// Текст ошибки от Twitch (без токенов).
fn api_message(response: &http::Response) -> String {
    json::parse(&response.body)
        .ok()
        .and_then(|value| value.str_field("message").map(str::to_string))
        .filter(|message| !message.is_empty())
        .unwrap_or_else(|| "Twitch не уточнил причину.".to_string())
}

/// ID первой подписки из тела ответа (для обработки 409).
fn first_data_id(body: &str) -> Option<String> {
    let value = json::parse(body).ok()?;
    value
        .get("data")
        .and_then(json::Value::as_array)
        .and_then(|data| data.first())
        .and_then(|subscription| subscription.str_field("id"))
        .map(str::to_string)
}


fn message_type(value: &json::Value) -> &str {
    value
        .get("metadata")
        .and_then(|metadata| metadata.str_field("message_type"))
        .unwrap_or_default()
}

fn parse_welcome(value: &json::Value) -> Option<(String, u64)> {
    let session = value.get("payload")?.get("session")?;
    let id = session.str_field("id")?.to_string();
    let keepalive = session
        .i64_field("keepalive_timeout_seconds")
        .unwrap_or(10)
        .clamp(1, 600) as u64;
    Some((id, keepalive))
}

fn parse_reconnect_url(value: &json::Value) -> Option<String> {
    value
        .get("payload")?
        .get("session")?
        .str_field("reconnect_url")
        .map(str::to_string)
}

fn parse_redemption(value: &json::Value) -> Option<Redemption> {
    let payload = value.get("payload")?;
    let subscription = payload.get("subscription")?;
    if subscription.str_field("type") != Some(SUBSCRIPTION_TYPE) {
        return None;
    }

    let event = payload.get("event")?;
    let reward = event.get("reward")?;

    Some(Redemption {
        redemption_id: event.str_field("id").unwrap_or_default().to_string(),
        reward_id: reward.str_field("id").unwrap_or_default().to_string(),
        reward_title: reward.str_field("title").unwrap_or_default().to_string(),
        user_login: event
            .str_field("user_login")
            .unwrap_or("зритель")
            .to_string(),
        user_input: event.str_field("user_input").unwrap_or_default().to_string(),
        redeemed_at: event.str_field("redeemed_at").unwrap_or_default().to_string(),
    })
}

fn sleep_cancellable(duration: Duration, stop: &AtomicBool) -> bool {
    let started = Instant::now();
    while started.elapsed() < duration {
        if stop.load(Ordering::SeqCst) {
            return false;
        }
        thread::sleep(Duration::from_millis(100));
    }
    !stop.load(Ordering::SeqCst)
}

/// Защита от повторной доставки одного и того же события.
struct Dedupe {
    seen: HashSet<String>,
    order: VecDeque<String>,
}

impl Dedupe {
    fn new() -> Self {
        Self {
            seen: HashSet::new(),
            order: VecDeque::new(),
        }
    }

    /// true, если событие новое.
    fn insert(&mut self, id: &str) -> bool {
        if id.is_empty() {
            return true;
        }
        if self.seen.contains(id) {
            return false;
        }
        self.seen.insert(id.to_string());
        self.order.push_back(id.to_string());
        while self.order.len() > 500 {
            if let Some(old) = self.order.pop_front() {
                self.seen.remove(&old);
            }
        }
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn notification_json() -> &'static str {
        r#"{
          "metadata": {"message_id":"m1","message_type":"notification","message_timestamp":"2026-11-09T00:00:00Z"},
          "payload": {
            "subscription": {"id":"sub1","status":"enabled","type":"channel.channel_points_custom_reward_redemption.add","version":"1"},
            "event": {
              "id":"redemption-1",
              "broadcaster_user_id":"42",
              "user_login":"viewer",
              "user_input":"вот трек https://youtu.be/dQw4w9WgXcQ",
              "reward": {"id":"reward-7","title":"Тревога","cost":500},
              "redeemed_at":"2026-11-09T00:00:00Z"
            }
          }
        }"#
    }

    #[test]
    fn parses_redemption_event() {
        let value = json::parse(notification_json()).unwrap();
        assert_eq!(message_type(&value), "notification");
        let redemption = parse_redemption(&value).unwrap();
        assert_eq!(redemption.reward_id, "reward-7");
        assert_eq!(redemption.reward_title, "Тревога");
        assert_eq!(redemption.user_login, "viewer");
        assert_eq!(redemption.redemption_id, "redemption-1");
        assert_eq!(
            redemption.user_input,
            "вот трек https://youtu.be/dQw4w9WgXcQ"
        );
        assert_eq!(redemption.redeemed_at, "2026-11-09T00:00:00Z");
    }

    #[test]
    fn ignores_other_event_types() {
        let text = notification_json().replace(SUBSCRIPTION_TYPE, "channel.follow");
        let value = json::parse(&text).unwrap();
        assert!(parse_redemption(&value).is_none());
    }

    #[test]
    fn parses_welcome_and_keepalive() {
        let text = r#"{"metadata":{"message_type":"session_welcome"},"payload":{"session":{"id":"sess-1","keepalive_timeout_seconds":10}}}"#;
        let value = json::parse(text).unwrap();
        assert_eq!(parse_welcome(&value), Some(("sess-1".to_string(), 10)));
    }

    #[test]
    fn parses_reconnect_url() {
        let text = r#"{"metadata":{"message_type":"session_reconnect"},"payload":{"session":{"id":"sess-2","reconnect_url":"wss://eventsub.wss.twitch.tv/ws?alt=1"}}}"#;
        let value = json::parse(text).unwrap();
        assert_eq!(
            parse_reconnect_url(&value).as_deref(),
            Some("wss://eventsub.wss.twitch.tv/ws?alt=1")
        );
    }

    #[test]
    fn dedupe_skips_repeats_and_keeps_memory_bounded() {
        let mut dedupe = Dedupe::new();
        assert!(dedupe.insert("a"));
        assert!(!dedupe.insert("a"));
        assert!(dedupe.insert("b"));
        assert!(dedupe.insert(""));

        for index in 0..600 {
            dedupe.insert(&format!("id-{index}"));
        }
        assert!(dedupe.order.len() <= 500);
    }

    #[test]
    fn parses_conflict_subscription_id() {
        let body = r#"{"data":[{"id":"sub-9","status":"enabled","type":"x"}],"total":1}"#;
        assert_eq!(first_data_id(body).as_deref(), Some("sub-9"));
        assert!(first_data_id("{}").is_none());
        assert!(first_data_id("не json").is_none());
    }

    #[test]
    fn extracts_api_error_message() {
        let response = http::Response {
            status: 400,
            body: r#"{"error":"Bad Request","status":400,"message":"Invalid transport"}"#.to_string(),
        };
        assert_eq!(api_message(&response), "Invalid transport");

        let empty = http::Response {
            status: 400,
            body: "{}".to_string(),
        };
        assert_eq!(api_message(&empty), "Twitch не уточнил причину.");
    }
}
