//! Подключение к Twitch.
//!
//! Используется официальный **Device Code Flow**: приложению не нужен
//! Client Secret (его вообще нельзя безопасно хранить в desktop-приложении).
//! Пользователь видит короткий код, вводит его на `twitch.tv/activate` и
//! подтверждает доступ. Twitch возвращает access token и refresh token;
//! refresh token позволяет обновлять вход без повторного ввода кода —
//! для публичных приложений (Device Code Flow) `client_secret` не требуется.
//!
//! Все сетевые запросы идут в отдельном потоке, интерфейс не блокируется.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use crate::http;
use crate::json::{self, JsonExt};

/// Минимально необходимый доступ: только чтение наград Channel Points.
pub const REQUIRED_SCOPES: &str = "channel:read:redemptions channel:manage:redemptions";

const DEVICE_URL: &str = "https://id.twitch.tv/oauth2/device";
const TOKEN_URL: &str = "https://id.twitch.tv/oauth2/token";
const REVOKE_URL: &str = "https://id.twitch.tv/oauth2/revoke";
const USERS_URL: &str = "https://api.twitch.tv/helix/users";

/// Аккаунт Twitch.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TwitchUser {
    pub id: String,
    pub login: String,
    pub display_name: String,
}

impl TwitchUser {
    fn from_json(value: &json::Value) -> Result<Self, String> {
        let id = value
            .str_field("id")
            .ok_or_else(|| "Twitch не вернул id аккаунта".to_string())?
            .to_string();
        let login = value
            .str_field("login")
            .ok_or_else(|| "Twitch не вернул логин аккаунта".to_string())?
            .to_string();
        let display_name = value
            .str_field("display_name")
            .filter(|name| !name.trim().is_empty())
            .unwrap_or(&login)
            .to_string();
        Ok(Self {
            id,
            login,
            display_name,
        })
    }
}

/// Награда канала, полученная из Twitch Helix API.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RemoteReward {
    pub id: String,
    pub title: String,
    /// Стоимость в баллах канала.
    pub cost: i64,
    pub is_enabled: bool,
    pub is_paused: bool,
    pub is_in_stock: bool,
    /// Цвет фона награды в формате #RRGGBB.
    pub color: String,
    /// Награда требует ввода текста от зрителя.
    pub requires_input: bool,
}

impl RemoteReward {
    fn from_json(value: &json::Value) -> Result<Self, String> {
        let id = value
            .str_field("id")
            .ok_or_else(|| "У награды нет id".to_string())?
            .to_string();
        let title = value
            .str_field("title")
            .unwrap_or("Без названия")
            .to_string();
        Ok(Self {
            id,
            title,
            cost: value.i64_field("cost").unwrap_or(0),
            color: value
                .str_field("background_color")
                .unwrap_or("#A970FF")
                .to_string(),
            is_enabled: value.get("is_enabled").and_then(json::Value::as_bool).unwrap_or(true),
            is_paused: value.get("is_paused").and_then(json::Value::as_bool).unwrap_or(false),
            is_in_stock: value
                .get("is_in_stock")
                .and_then(json::Value::as_bool)
                .unwrap_or(true),
            requires_input: value
                .get("is_user_input_required")
                .and_then(json::Value::as_bool)
                .unwrap_or(false),
        })
    }

    /// Короткое описание состояния для интерфейса.
    pub fn state_label(&self) -> (&'static str, bool) {
        if !self.is_enabled {
            ("выключена", false)
        } else if self.is_paused {
            ("на паузе", false)
        } else if !self.is_in_stock {
            ("нет в наличии", false)
        } else {
            ("активна", true)
        }
    }
}

impl RemoteReward {
    /// Можно ли активировать награду прямо сейчас.
    pub fn is_available(&self) -> bool {
        self.state_label().1
    }
}

/// Порядок показа наград: доступные сверху, выключенные и недоступные — внизу.
///
/// Сортировка устойчивая: внутри каждой группы сохраняется порядок Twitch.
pub fn sort_rewards_for_display(rewards: &mut [RemoteReward]) {
    rewards.sort_by_key(|reward| !reward.is_available());
}

/// Данные для создания или изменения награды.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RewardDraft {
    pub title: String,
    pub cost: i64,
    /// Цвет фона в формате `#RRGGBB`.
    pub color: String,
    /// Требовать от зрителя ввод текста (для награды «Трек по заявке»).
    pub requires_input: bool,
}

impl RewardDraft {
    pub fn new(title: impl Into<String>, cost: i64, color: impl Into<String>) -> Self {
        Self {
            title: title.into(),
            cost,
            color: color.into(),
            requires_input: false,
        }
    }

    /// Помечает награду как требующую ввода текста.
    pub fn with_input(mut self, value: bool) -> Self {
        self.requires_input = value;
        self
    }

    /// Проверяет ограничения Twitch перед отправкой.
    pub fn validate(&self) -> Result<(), String> {
        let title = self.title.trim();
        if title.is_empty() {
            return Err("Название награды не может быть пустым.".to_string());
        }
        if title.chars().count() > 45 {
            return Err("Название награды — не больше 45 символов.".to_string());
        }
        if !(1..=1_000_000).contains(&self.cost) {
            return Err("Стоимость должна быть от 1 до 1 000 000 баллов.".to_string());
        }
        if !is_valid_color(&self.color) {
            return Err("Цвет должен быть в формате #RRGGBB.".to_string());
        }
        Ok(())
    }

    /// Тело запроса на создание награды.
    pub fn create_body(&self) -> String {
        json::json!({
            "title": self.title.trim(),
            "cost": self.cost,
            "background_color": self.color,
            "is_enabled": true,
            "is_user_input_required": self.requires_input,
            "prompt": if self.requires_input { "Вставьте ссылку на трек из YouTube" } else { "" },
        })
        .to_string()
    }

    /// Тело запроса на изменение награды.
    pub fn update_body(&self) -> String {
        json::json!({
            "title": self.title.trim(),
            "cost": self.cost,
            "background_color": self.color,
            "is_user_input_required": self.requires_input,
            "prompt": if self.requires_input { "Вставьте ссылку на трек из YouTube" } else { "" },
        })
        .to_string()
    }
}

/// Проверяет цвет вида `#A970FF`.
pub fn is_valid_color(color: &str) -> bool {
    let bytes = color.as_bytes();
    bytes.len() == 7
        && bytes[0] == b'#'
        && bytes[1..].iter().all(|byte| byte.is_ascii_hexdigit())
}


/// Токены доступа.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Tokens {
    pub access: String,
    pub refresh: String,
    /// Unix-время истечения access token.
    pub expires_at: i64,
}

/// События фонового сервиса для интерфейса.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Event {
    /// Twitch выдал код, который нужно ввести на сайте.
    CodeReady {
        user_code: String,
        verification_uri: String,
        expires_in: u64,
    },
    /// Вход завершён успешно.
    Authorized { user: TwitchUser, tokens: Tokens },
    /// Токен обновлён без участия пользователя.
    Refreshed { user: TwitchUser, tokens: Tokens },
    /// Список наград канала успешно загружен.
    RewardsLoaded { rewards: Vec<RemoteReward> },
    /// Токен не принят при загрузке наград (нужно обновить вход).
    RewardsUnauthorized,
    /// Не удалось загрузить награды.
    RewardsFailed(String),
    /// Награда создана. `id` пустой, если Twitch не вернул идентификатор.
    RewardCreated { id: String, title: String },
    /// Награда изменена.
    RewardUpdated { id: String, title: String },
    /// Награда удалена.
    RewardDeleted(String),
    /// Twitch не дал право управлять наградами (нужен повторный вход).
    RewardManageUnauthorized,
    /// Не удалось создать/изменить/удалить награду.
    RewardManageFailed(String),
    /// Аккаунт отключён.
    LoggedOut,
    /// Twitch больше не принимает refresh token: нужен повторный вход.
    SessionExpired(String),
    /// Промежуточный статус (например, «ждём подтверждения»).
    Progress(String),
    /// Статус активации обновлён: баллы засчитаны или возвращены.
    RedemptionStatusSet {
        redemption_id: String,
        status: String,
    },
    /// Не удалось обновить статус активации.
    RedemptionStatusFailed {
        redemption_id: String,
        message: String,
    },
    /// Ошибка с понятным текстом.
    Failed(String),
}

/// Статус активации награды, который выставляет приложение.
///
/// `FULFILLED` оставляет баллы списанными, `CANCELED` возвращает их зрителю.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RedemptionStatus {
    Fulfilled,
    Canceled,
}

impl RedemptionStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            RedemptionStatus::Fulfilled => "FULFILLED",
            RedemptionStatus::Canceled => "CANCELED",
        }
    }

    /// Подпись для журнала и интерфейса.
    pub fn label(self) -> &'static str {
        match self {
            RedemptionStatus::Fulfilled => "засчитано",
            RedemptionStatus::Canceled => "баллы возвращены",
        }
    }
}

enum Command {
    SignIn { client_id: String },
    Refresh {
        client_id: String,
        refresh_token: String,
    },
    FetchRewards {
        client_id: String,
        access_token: String,
        broadcaster_id: String,
    },
    CreateReward {
        client_id: String,
        access_token: String,
        broadcaster_id: String,
        draft: RewardDraft,
    },
    UpdateReward {
        client_id: String,
        access_token: String,
        broadcaster_id: String,
        reward_id: String,
        draft: RewardDraft,
    },
    DeleteReward {
        client_id: String,
        access_token: String,
        broadcaster_id: String,
        reward_id: String,
        title: String,
    },
    SignOut {
        client_id: String,
        access_token: String,
    },
    UpdateRedemptionStatus {
        client_id: String,
        access_token: String,
        broadcaster_id: String,
        reward_id: String,
        redemption_id: String,
        status: RedemptionStatus,
    },
}

/// Фоновый сервис Twitch.
pub struct Service {
    commands: Sender<Command>,
    events: Receiver<Event>,
    cancel: Arc<AtomicBool>,
}

impl Service {
    pub fn spawn() -> Self {
        let (command_tx, command_rx) = mpsc::channel();
        let (event_tx, event_rx) = mpsc::channel();
        let cancel = Arc::new(AtomicBool::new(false));

        let thread_cancel = Arc::clone(&cancel);
        let spawn_result = thread::Builder::new()
            .name("reward-sounds-twitch".to_string())
            .spawn(move || worker(command_rx, event_tx, thread_cancel));

        if let Err(err) = spawn_result {
            log::error!("Не удалось запустить поток Twitch: {err}");
        }

        Self {
            commands: command_tx,
            events: event_rx,
            cancel,
        }
    }

    /// Начинает вход: запрашивает код и ждёт подтверждения.
    pub fn sign_in(&self, client_id: &str) {
        self.cancel.store(false, Ordering::SeqCst);
        let _ = self.commands.send(Command::SignIn {
            client_id: client_id.to_string(),
        });
    }

    /// Отменяет ожидание кода.
    pub fn cancel(&self) {
        self.cancel.store(true, Ordering::SeqCst);
    }

    /// Обновляет access token по refresh token.
    pub fn refresh(&self, client_id: &str, refresh_token: &str) {
        self.cancel.store(false, Ordering::SeqCst);
        let _ = self.commands.send(Command::Refresh {
            client_id: client_id.to_string(),
            refresh_token: refresh_token.to_string(),
        });
    }

    /// Запрашивает список пользовательских наград канала.
    pub fn fetch_rewards(&self, client_id: &str, access_token: &str, broadcaster_id: &str) {
        let _ = self.commands.send(Command::FetchRewards {
            client_id: client_id.to_string(),
            access_token: access_token.to_string(),
            broadcaster_id: broadcaster_id.to_string(),
        });
    }

    /// Создаёт награду канала.
    pub fn create_reward(
        &self,
        client_id: &str,
        access_token: &str,
        broadcaster_id: &str,
        draft: RewardDraft,
    ) {
        let _ = self.commands.send(Command::CreateReward {
            client_id: client_id.to_string(),
            access_token: access_token.to_string(),
            broadcaster_id: broadcaster_id.to_string(),
            draft,
        });
    }

    /// Изменяет название, цену и цвет награды.
    pub fn update_reward(
        &self,
        client_id: &str,
        access_token: &str,
        broadcaster_id: &str,
        reward_id: &str,
        draft: RewardDraft,
    ) {
        let _ = self.commands.send(Command::UpdateReward {
            client_id: client_id.to_string(),
            access_token: access_token.to_string(),
            broadcaster_id: broadcaster_id.to_string(),
            reward_id: reward_id.to_string(),
            draft,
        });
    }

    /// Удаляет награду канала.
    pub fn delete_reward(
        &self,
        client_id: &str,
        access_token: &str,
        broadcaster_id: &str,
        reward_id: &str,
        title: &str,
    ) {
        let _ = self.commands.send(Command::DeleteReward {
            client_id: client_id.to_string(),
            access_token: access_token.to_string(),
            broadcaster_id: broadcaster_id.to_string(),
            reward_id: reward_id.to_string(),
            title: title.to_string(),
        });
    }

    /// Отзывает токен на стороне Twitch и сообщает о выходе.
    pub fn sign_out(&self, client_id: &str, access_token: &str) {
        let _ = self.commands.send(Command::SignOut {
            client_id: client_id.to_string(),
            access_token: access_token.to_string(),
        });
    }

    /// Выставляет статус активации награды: засчитать или вернуть баллы.
    pub fn update_redemption_status(
        &self,
        client_id: &str,
        access_token: &str,
        broadcaster_id: &str,
        reward_id: &str,
        redemption_id: &str,
        status: RedemptionStatus,
    ) {
        let _ = self.commands.send(Command::UpdateRedemptionStatus {
            client_id: client_id.to_string(),
            access_token: access_token.to_string(),
            broadcaster_id: broadcaster_id.to_string(),
            reward_id: reward_id.to_string(),
            redemption_id: redemption_id.to_string(),
            status,
        });
    }

    /// Забирает накопившиеся события (не блокируясь).
    pub fn poll(&self) -> Vec<Event> {
        self.events.try_iter().collect()
    }
}

fn worker(commands: Receiver<Command>, events: Sender<Event>, cancel: Arc<AtomicBool>) {
    while let Ok(command) = commands.recv() {
        match command {
            Command::SignIn { client_id } => {
                if let Err(message) = sign_in(&client_id, &events, &cancel) {
                    log::warn!("Twitch: вход не выполнен: {message}");
                    let _ = events.send(Event::Failed(message));
                }
            }
            Command::Refresh {
                client_id,
                refresh_token,
            } => {
                if let Err(message) = refresh(&client_id, &refresh_token, &events) {
                    log::warn!("Twitch: не удалось обновить токен: {message}");
                    let _ = events.send(Event::Failed(message));
                }
            }
            Command::SignOut {
                client_id,
                access_token,
            } => {
                sign_out(&client_id, &access_token, &events);
            }
            Command::FetchRewards {
                client_id,
                access_token,
                broadcaster_id,
            } => publish_rewards(&client_id, &access_token, &broadcaster_id, &events),
            Command::CreateReward {
                client_id,
                access_token,
                broadcaster_id,
                draft,
            } => match create_reward(&client_id, &access_token, &broadcaster_id, &draft) {
                Ok(id) => {
                    log::info!("Twitch: награда «{}» создана", draft.title);
                    let _ = events.send(Event::RewardCreated {
                        id,
                        title: draft.title.clone(),
                    });
                    publish_rewards(&client_id, &access_token, &broadcaster_id, &events);
                }
                Err(ManageError::Unauthorized) => {
                    let _ = events.send(Event::RewardManageUnauthorized);
                }
                Err(ManageError::Failed(message)) => {
                    log::warn!("Twitch: не удалось создать награду: {message}");
                    let _ = events.send(Event::RewardManageFailed(message));
                }
            },
            Command::UpdateReward {
                client_id,
                access_token,
                broadcaster_id,
                reward_id,
                draft,
            } => match update_reward(
                &client_id,
                &access_token,
                &broadcaster_id,
                &reward_id,
                &draft,
            ) {
                Ok(()) => {
                    log::info!("Twitch: награда «{}» изменена", draft.title);
                    let _ = events.send(Event::RewardUpdated {
                        id: reward_id,
                        title: draft.title.clone(),
                    });
                    publish_rewards(&client_id, &access_token, &broadcaster_id, &events);
                }
                Err(ManageError::Unauthorized) => {
                    let _ = events.send(Event::RewardManageUnauthorized);
                }
                Err(ManageError::Failed(message)) => {
                    log::warn!("Twitch: не удалось изменить награду: {message}");
                    let _ = events.send(Event::RewardManageFailed(message));
                }
            },
            Command::DeleteReward {
                client_id,
                access_token,
                broadcaster_id,
                reward_id,
                title,
            } => match delete_reward(&client_id, &access_token, &broadcaster_id, &reward_id) {
                Ok(()) => {
                    log::info!("Twitch: награда «{title}» удалена");
                    let _ = events.send(Event::RewardDeleted(title));
                    publish_rewards(&client_id, &access_token, &broadcaster_id, &events);
                }
                Err(ManageError::Unauthorized) => {
                    let _ = events.send(Event::RewardManageUnauthorized);
                }
                Err(ManageError::Failed(message)) => {
                    log::warn!("Twitch: не удалось удалить награду: {message}");
                    let _ = events.send(Event::RewardManageFailed(message));
                }
            },
            Command::UpdateRedemptionStatus {
                client_id,
                access_token,
                broadcaster_id,
                reward_id,
                redemption_id,
                status,
            } => match set_redemption_status(
                &client_id,
                &access_token,
                &broadcaster_id,
                &reward_id,
                &redemption_id,
                status,
            ) {
                Ok(()) => {
                    log::info!(
                        "Twitch: активация {redemption_id} — {}",
                        status.label()
                    );
                    let _ = events.send(Event::RedemptionStatusSet {
                        redemption_id,
                        status: status.as_str().to_string(),
                    });
                }
                Err(ManageError::Unauthorized) => {
                    let _ = events.send(Event::RewardManageUnauthorized);
                }
                Err(ManageError::Failed(message)) => {
                    log::warn!(
                        "Twitch: не удалось обновить активацию {redemption_id}: {message}"
                    );
                    let _ = events.send(Event::RedemptionStatusFailed {
                        redemption_id,
                        message,
                    });
                }
            },
        }
    }
}

/// Загружает награды и отправляет результат в интерфейс.
fn publish_rewards(
    client_id: &str,
    access_token: &str,
    broadcaster_id: &str,
    events: &Sender<Event>,
) {
    match fetch_rewards(client_id, access_token, broadcaster_id) {
        Ok(rewards) => {
            log::info!("Twitch: получено наград — {}", rewards.len());
            let _ = events.send(Event::RewardsLoaded { rewards });
        }
        Err(FetchError::Unauthorized) => {
            log::warn!("Twitch: токен не принят при загрузке наград");
            let _ = events.send(Event::RewardsUnauthorized);
        }
        Err(FetchError::Failed(message)) => {
            log::warn!("Twitch: не удалось загрузить награды: {message}");
            let _ = events.send(Event::RewardsFailed(message));
        }
    }
}

fn sign_in(
    client_id: &str,
    events: &Sender<Event>,
    cancel: &AtomicBool,
) -> Result<(), String> {
    let device_url = format!(
        "{DEVICE_URL}?client_id={}&scopes={}",
        http::form_encode(client_id),
        http::form_encode(REQUIRED_SCOPES)
    );

    let response = http::post(&device_url, &[]).map_err(|err| {
        format!("Не удалось связаться с Twitch. Проверьте интернет. ({err})")
    })?;

    if response.status != 200 {
        return Err(http_error(&response, "Twitch не выдал код подтверждения"));
    }

    let body = json::parse(&response.body)
        .map_err(|err| format!("Некорректный ответ Twitch: {err}"))?;

    let device_code = body
        .str_field("device_code")
        .ok_or_else(|| "Twitch не вернул код устройства".to_string())?
        .to_string();
    let user_code = body
        .str_field("user_code")
        .ok_or_else(|| "Twitch не вернул код для ввода".to_string())?
        .to_string();
    let verification_uri = body
        .str_field("verification_uri")
        .unwrap_or("https://www.twitch.tv/activate")
        .to_string();
    let expires_in = body.i64_field("expires_in").unwrap_or(1800).clamp(60, 3600) as u64;
    let mut interval = body.i64_field("interval").unwrap_or(5).clamp(1, 30) as u64;

    log::info!("Twitch: запрошен код подтверждения (действует {expires_in} с)");
    let _ = events.send(Event::CodeReady {
        user_code: user_code.clone(),
        verification_uri: verification_uri.clone(),
        expires_in,
    });

    let deadline = Instant::now() + Duration::from_secs(expires_in);
    let mut network_failures = 0u32;

    loop {
        if cancel.load(Ordering::SeqCst) {
            log::info!("Twitch: вход отменён пользователем");
            return Ok(());
        }

        if !sleep_cancellable(Duration::from_secs(interval), cancel) {
            return Ok(());
        }

        if Instant::now() >= deadline {
            return Err(
                "Код подтверждения истёк. Нажмите «Подключить Twitch» и попробуйте снова."
                    .to_string(),
            );
        }

        let form = [
            ("client_id", client_id),
            (
                "grant_type",
                "urn:ietf:params:oauth:grant-type:device_code",
            ),
            ("device_code", device_code.as_str()),
        ];

        match http::post_form(TOKEN_URL, &[], &form) {
            Ok(response) if response.status == 200 => {
                let tokens = parse_tokens(&response.body)?;
                let user = fetch_user(client_id, &tokens.access)?;
                log::info!(
                    "Twitch: вход выполнен, аккаунт @{} (id {})",
                    user.login,
                    user.id
                );
                let _ = events.send(Event::Authorized { user, tokens });
                return Ok(());
            }
            Ok(response) => {
                let message = server_message(&response);
                match message.as_str() {
                    "authorization_pending" => {
                        let _ = events.send(Event::Progress(
                            "Ждём подтверждения на Twitch…".to_string(),
                        ));
                    }
                    "slow_down" => {
                        interval += 5;
                        let _ = events.send(Event::Progress(
                            "Twitch просит подождать немного дольше…".to_string(),
                        ));
                    }
                    "expired_token" => {
                        return Err(
                            "Код подтверждения истёк. Нажмите «Подключить Twitch» ещё раз."
                                .to_string(),
                        )
                    }
                    "access_denied" => {
                        return Err(
                            "Доступ отклонён на Twitch. Попробуйте подключиться снова."
                                .to_string(),
                        )
                    }
                    "" => return Err(http_error(&response, "Twitch отклонил вход")),
                    other => return Err(format!("Twitch отклонил вход: {other}")),
                }
            }
            Err(err) => {
                network_failures += 1;
                if network_failures > 4 {
                    return Err(format!(
                        "Не удалось связаться с Twitch. Проверьте интернет. ({err})"
                    ));
                }
                let _ = events.send(Event::Progress(
                    "Нет связи с Twitch, пробуем снова…".to_string(),
                ));
                interval = interval.max(3);
            }
        }
    }
}

fn refresh(
    client_id: &str,
    refresh_token: &str,
    events: &Sender<Event>,
) -> Result<(), String> {
    let form = [
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token),
        ("client_id", client_id),
    ];

    let response = http::post_form(TOKEN_URL, &[], &form)
        .map_err(|err| format!("Не удалось связаться с Twitch. ({err})"))?;

    if response.status != 200 {
        log::warn!(
            "Twitch: обновление токена отклонено (HTTP {})",
            response.status
        );
        let _ = events.send(Event::SessionExpired(
            "Сессия Twitch истекла. Подключите аккаунт заново — звуки при этом сохранятся."
                .to_string(),
        ));
        return Ok(());
    }

    let mut tokens = parse_tokens(&response.body)?;
    if tokens.refresh.is_empty() {
        tokens.refresh = refresh_token.to_string();
    }
    let user = fetch_user(client_id, &tokens.access)?;

    log::info!("Twitch: вход обновлён для @{}", user.login);
    let _ = events.send(Event::Refreshed { user, tokens });
    Ok(())
}

fn sign_out(client_id: &str, access_token: &str, events: &Sender<Event>) {
    let revoke_url = format!(
        "{REVOKE_URL}?client_id={}&token={}",
        http::form_encode(client_id),
        http::form_encode(access_token)
    );

    // Внимание: в журнал не попадает ни адрес, ни токен.
    match http::post(&revoke_url, &[]) {
        Ok(response) if response.is_success() => log::info!("Twitch: доступ отозван"),
        Ok(response) => log::warn!("Twitch: не подтвердил отзыв доступа (HTTP {})", response.status),
        Err(err) => log::warn!("Twitch: не удалось отозвать доступ ({err})"),
    }

    let _ = events.send(Event::LoggedOut);
}

/// Ошибка загрузки наград.
enum FetchError {
    Unauthorized,
    Failed(String),
}

const REWARDS_URL: &str = "https://api.twitch.tv/helix/channel_points/custom_rewards";
/// Статусы активаций наград: `CANCELED` возвращает баллы зрителю.
const REDEMPTIONS_URL: &str = "https://api.twitch.tv/helix/channel_points/custom_rewards/redemptions";

/// Загружает пользовательские награды канала (с постраничной выдачей).
/// Ошибка управления наградами.
enum ManageError {
    Unauthorized,
    Failed(String),
}

fn api_headers(client_id: &str, access_token: &str) -> Vec<(String, String)> {
    vec![
        ("Client-Id".to_string(), client_id.to_string()),
        (
            "Authorization".to_string(),
            format!("Bearer {access_token}"),
        ),
    ]
}

/// Проверяет ответ Twitch на изменение награды.
fn check_manage(response: &http::Response, action: &str) -> Result<(), ManageError> {
    match response.status {
        200 | 204 => Ok(()),
        401 | 403 => Err(ManageError::Unauthorized),
        status => Err(ManageError::Failed(format!(
            "Twitch не {action} (HTTP {status}). {}",
            http_error(response, "Проверьте права приложения.")
        ))),
    }
}

/// Выставляет статус активации награды.
///
/// `CANCELED` возвращает баллы зрителю, `FULFILLED` оставляет их списанными.
fn set_redemption_status(
    client_id: &str,
    access_token: &str,
    broadcaster_id: &str,
    reward_id: &str,
    redemption_id: &str,
    status: RedemptionStatus,
) -> Result<(), ManageError> {
    let url = format!(
        "{REDEMPTIONS_URL}?broadcaster_id={}&reward_id={}&id={}",
        http::form_encode(broadcaster_id),
        http::form_encode(reward_id),
        http::form_encode(redemption_id)
    );
    let body = format!("{{\"status\":\"{}\"}}", status.as_str());
    let response = http::patch_json(&url, &api_headers(client_id, access_token), &body)
        .map_err(ManageError::Failed)?;

    match response.status {
        200 | 204 => Ok(()),
        401 | 403 => Err(ManageError::Unauthorized),
        404 => Err(ManageError::Failed(
            "Активация не найдена: возможно, награда уже удалена".to_string(),
        )),
        code => Err(ManageError::Failed(format!(
            "Twitch не обновил активацию (HTTP {code}). {}",
            http_error(&response, "Проверьте права приложения.")
        ))),
    }
}

/// Создаёт награду канала и возвращает её идентификатор.
///
/// Twitch отвечает на создание объектом награды — ID нужен, чтобы сразу
/// привязать к новой награде выбранный звук.
fn create_reward(
    client_id: &str,
    access_token: &str,
    broadcaster_id: &str,
    draft: &RewardDraft,
) -> Result<String, ManageError> {
    let url = format!(
        "{REWARDS_URL}?broadcaster_id={}",
        http::form_encode(broadcaster_id)
    );
    let response =
        http::post_json(&url, &api_headers(client_id, access_token), &draft.create_body())
            .map_err(ManageError::Failed)?;
    match response.status {
        200 | 204 => {}
        401 | 403 => return Err(ManageError::Unauthorized),
        status => {
            return Err(ManageError::Failed(format!(
                "Twitch не создал награду (HTTP {status}). {}",
                http_error(&response, "Проверьте права приложения.")
            )))
        }
    }
    if response.body.trim().is_empty() {
        return Ok(String::new());
    }
    let body = json::parse(&response.body).map_err(|err| {
        log::warn!("Twitch: ответ на создание награды не разобран: {err}");
        ManageError::Failed("Twitch вернул неожиданный ответ при создании награды.".to_string())
    })?;
    Ok(body
        .get("data")
        .and_then(json::Value::as_array)
        .and_then(|items| items.first())
        .and_then(|item| item.str_field("id"))
        .unwrap_or_default()
        .to_string())
}

/// Изменяет название, цену и цвет награды.
fn update_reward(
    client_id: &str,
    access_token: &str,
    broadcaster_id: &str,
    reward_id: &str,
    draft: &RewardDraft,
) -> Result<(), ManageError> {
    let url = format!(
        "{REWARDS_URL}?broadcaster_id={}&id={}",
        http::form_encode(broadcaster_id),
        http::form_encode(reward_id)
    );
    let response =
        http::patch_json(&url, &api_headers(client_id, access_token), &draft.update_body())
            .map_err(ManageError::Failed)?;
    check_manage(&response, "изменил награду")
}

/// Удаляет награду канала.
fn delete_reward(
    client_id: &str,
    access_token: &str,
    broadcaster_id: &str,
    reward_id: &str,
) -> Result<(), ManageError> {
    let url = format!(
        "{REWARDS_URL}?broadcaster_id={}&id={}",
        http::form_encode(broadcaster_id),
        http::form_encode(reward_id)
    );
    let response = http::delete(&url, &api_headers(client_id, access_token))
        .map_err(ManageError::Failed)?;
    check_manage(&response, "удалил награду")
}

fn fetch_rewards(
    client_id: &str,
    access_token: &str,
    broadcaster_id: &str,
) -> Result<Vec<RemoteReward>, FetchError> {
    let headers = vec![
        ("Client-Id".to_string(), client_id.to_string()),
        (
            "Authorization".to_string(),
            format!("Bearer {access_token}"),
        ),
    ];

    let mut rewards = Vec::new();
    let mut after: Option<String> = None;

    for _ in 0..10 {
        let mut url = format!(
            "{REWARDS_URL}?broadcaster_id={}&first=50",
            http::form_encode(broadcaster_id)
        );
        if let Some(cursor) = &after {
            url.push_str(&format!("&after={}", http::form_encode(cursor)));
        }

        let response = http::get(&url, &headers).map_err(|err| {
            FetchError::Failed(format!(
                "Не удалось получить награды. Проверьте интернет. ({err})"
            ))
        })?;

        match response.status {
            200 => {}
            401 => return Err(FetchError::Unauthorized),
            403 => {
                return Err(FetchError::Failed(
                    "Twitch не разрешил читать награды. Отключите и подключите аккаунт заново."
                        .to_string(),
                ))
            }
            _ => return Err(FetchError::Failed(http_error(&response, "Twitch не вернул награды"))),
        }

        let body = json::parse(&response.body)
            .map_err(|err| FetchError::Failed(format!("Некорректный ответ Twitch: {err}")))?;
        let data = body
            .get("data")
            .and_then(json::Value::as_array)
            .ok_or_else(|| FetchError::Failed("Twitch вернул неожиданный ответ".to_string()))?;

        for item in data {
            match RemoteReward::from_json(item) {
                Ok(reward) => rewards.push(reward),
                Err(err) => log::warn!("Twitch: награда пропущена ({err})"),
            }
        }

        let cursor = body
            .get("pagination")
            .and_then(|pagination| pagination.str_field("cursor"))
            .filter(|cursor| !cursor.is_empty())
            .map(str::to_string);

        match cursor {
            Some(cursor) => after = Some(cursor),
            None => break,
        }
    }

    Ok(rewards)
}

fn fetch_user(client_id: &str, access_token: &str) -> Result<TwitchUser, String> {
    let headers = vec![
        ("Client-Id".to_string(), client_id.to_string()),
        (
            "Authorization".to_string(),
            format!("Bearer {access_token}"),
        ),
    ];

    let response = http::get(USERS_URL, &headers)
        .map_err(|err| format!("Не удалось получить данные аккаунта Twitch. ({err})"))?;

    if response.status == 401 {
        return Err("Twitch отклонил токен. Подключите аккаунт заново.".to_string());
    }
    if response.status != 200 {
        return Err(http_error(&response, "Twitch не вернул данные аккаунта"));
    }

    let body = json::parse(&response.body)
        .map_err(|err| format!("Некорректный ответ Twitch: {err}"))?;
    let data = body
        .get("data")
        .and_then(json::Value::as_array)
        .ok_or_else(|| "Twitch вернул неожиданный ответ".to_string())?;
    let first = data
        .first()
        .ok_or_else(|| "Twitch не вернул аккаунт".to_string())?;

    TwitchUser::from_json(first)
}

fn parse_tokens(body: &str) -> Result<Tokens, String> {
    let value = json::parse(body)
        .map_err(|err| format!("Некорректный ответ Twitch: {err}"))?;
    let access = value
        .str_field("access_token")
        .ok_or_else(|| "Twitch не вернул access token".to_string())?
        .to_string();
    let refresh = value
        .str_field("refresh_token")
        .unwrap_or_default()
        .to_string();
    let expires_in = value.i64_field("expires_in").unwrap_or(3600).clamp(60, 86_400);

    Ok(Tokens {
        access,
        refresh,
        expires_at: now_unix() + expires_in,
    })
}

fn server_message(response: &http::Response) -> String {
    json::parse(&response.body)
        .ok()
        .and_then(|value| value.str_field("message").map(str::to_string))
        .unwrap_or_default()
}

fn http_error(response: &http::Response, context: &str) -> String {
    let message = server_message(response);
    if message.is_empty() {
        format!("{context} (HTTP {})", response.status)
    } else {
        format!("{context}: {message}")
    }
}

/// Сон, который прерывается кнопкой «Отмена». Возвращает false, если отменили.
fn sleep_cancellable(duration: Duration, cancel: &AtomicBool) -> bool {
    let started = Instant::now();
    while started.elapsed() < duration {
        if cancel.load(Ordering::SeqCst) {
            return false;
        }
        thread::sleep(Duration::from_millis(100));
    }
    !cancel.load(Ordering::SeqCst)
}

/// Текущее Unix-время в секундах.
pub fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

/// Пора ли обновлять токен (запас 2 минуты).
pub fn token_expired_or_soon(expires_at: i64) -> bool {
    expires_at <= now_unix() + 120
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_tokens() {
        let body = r#"{"access_token":"abc","refresh_token":"def","expires_in":3600,"scope":["channel:read:redemptions"],"token_type":"bearer"}"#;
        let tokens = parse_tokens(body).unwrap();
        assert_eq!(tokens.access, "abc");
        assert_eq!(tokens.refresh, "def");
        assert!(tokens.expires_at > now_unix());
    }

    #[test]
    fn tokens_without_refresh_are_accepted() {
        let tokens = parse_tokens(r#"{"access_token":"abc","expires_in":60}"#).unwrap();
        assert_eq!(tokens.access, "abc");
        assert!(tokens.refresh.is_empty());
    }

    #[test]
    fn rejects_broken_token_response() {
        assert!(parse_tokens("{}").is_err());
        assert!(parse_tokens("not json").is_err());
    }

    #[test]
    fn parses_user() {
        let text = r#"{"data":[{"id":"42","login":"streamer","display_name":"Стример","type":""}]}"#;
        let value = json::parse(text).unwrap();
        let first = value.get("data").and_then(json::Value::as_array).unwrap()[0].clone();
        let user = TwitchUser::from_json(&first).unwrap();
        assert_eq!(user.id, "42");
        assert_eq!(user.login, "streamer");
        assert_eq!(user.display_name, "Стример");
    }

    #[test]
    fn user_without_display_name_uses_login() {
        let value = json::parse(r#"{"id":"42","login":"streamer"}"#).unwrap();
        let user = TwitchUser::from_json(&value).unwrap();
        assert_eq!(user.display_name, "streamer");
    }

    #[test]
    fn error_message_is_human_readable() {
        let response = http::Response {
            status: 400,
            body: r#"{"error":"Bad Request","status":400,"message":"Invalid client id"}"#.to_string(),
        };
        assert_eq!(server_message(&response), "Invalid client id");
        assert_eq!(
            http_error(&response, "Ошибка"),
            "Ошибка: Invalid client id"
        );
    }

    #[test]
    fn expiry_check_works() {
        assert!(token_expired_or_soon(now_unix()));
        assert!(token_expired_or_soon(now_unix() + 60));
        assert!(!token_expired_or_soon(now_unix() + 3600));
    }

    #[test]
    fn parses_rewards_response() {
        let text = r#"{"data":[
            {"id":"abc","title":"Тревога","cost":1000,"is_enabled":true,"is_paused":false,"is_in_stock":true},
            {"id":"def","title":"Мем","cost":50,"is_enabled":false,"is_paused":true,"is_in_stock":false}
        ],"pagination":{}}"#;
        let value = json::parse(text).unwrap();
        let data = value.get("data").and_then(json::Value::as_array).unwrap();

        let first = RemoteReward::from_json(&data[0]).unwrap();
        assert_eq!(first.id, "abc");
        assert_eq!(first.title, "Тревога");
        assert_eq!(first.cost, 1000);
        assert!(first.is_enabled);
        assert_eq!(first.state_label(), ("активна", true));

        let second = RemoteReward::from_json(&data[1]).unwrap();
        assert_eq!(second.state_label(), ("выключена", false));
    }

    #[test]
    fn parses_requires_input_flag() {
        let value =
            json::parse(r#"{"id":"x","cost":10,"is_user_input_required":true}"#).unwrap();
        let reward = RemoteReward::from_json(&value).unwrap();
        assert!(reward.requires_input);

        let value = json::parse(r#"{"id":"y","cost":10}"#).unwrap();
        let reward = RemoteReward::from_json(&value).unwrap();
        assert!(!reward.requires_input);
    }

    #[test]
    fn reward_without_title_is_still_usable() {
        let value = json::parse(r#"{"id":"x","cost":10}"#).unwrap();
        let reward = RemoteReward::from_json(&value).unwrap();
        assert_eq!(reward.title, "Без названия");
        assert_eq!(reward.state_label(), ("активна", true));
    }

    #[test]
    fn sorts_available_rewards_first() {
        let make = |id: &str, enabled: bool, paused: bool, stock: bool| RemoteReward {
            id: id.to_string(),
            title: id.to_string(),
            cost: 0,
            is_enabled: enabled,
            is_paused: paused,
            is_in_stock: stock,
            color: "#A970FF".to_string(),
            requires_input: false,
        };

        let mut rewards = vec![
            make("off", false, false, true),
            make("paused", true, true, true),
            make("ok1", true, false, true),
            make("nostock", true, false, false),
            make("ok2", true, false, true),
        ];

        sort_rewards_for_display(&mut rewards);
        let ids: Vec<&str> = rewards.iter().map(|reward| reward.id.as_str()).collect();
        assert_eq!(ids, vec!["ok1", "ok2", "off", "paused", "nostock"]);
    }

    #[test]
    fn reward_draft_validates_input() {
        assert!(RewardDraft::new("Награда", 500, "#A970FF").validate().is_ok());
        assert!(RewardDraft::new("", 500, "#A970FF").validate().is_err());
        assert!(RewardDraft::new("Награда", 0, "#A970FF").validate().is_err());
        assert!(RewardDraft::new("Награда", 500, "A970FF").validate().is_err());
        assert!(RewardDraft::new("Награда", 500, "#A97").validate().is_err());

        let long_title = "я".repeat(46);
        assert!(RewardDraft::new(long_title, 500, "#A970FF")
            .validate()
            .is_err());
    }

    #[test]
    fn reward_draft_bodies_contain_fields() {
        let draft = RewardDraft::new("Тест", 777, "#123456");

        let create = json::parse(&draft.create_body()).unwrap();
        assert_eq!(create.str_field("title"), Some("Тест"));
        assert_eq!(create.i64_field("cost"), Some(777));
        assert_eq!(create.str_field("background_color"), Some("#123456"));
        assert_eq!(create.get("is_enabled").and_then(json::Value::as_bool), Some(true));

        let update = json::parse(&draft.update_body()).unwrap();
        assert_eq!(update.i64_field("cost"), Some(777));
        assert_eq!(update.str_field("title"), Some("Тест"));
    }

    #[test]
    fn check_manage_maps_twitch_statuses() {
        let unauthorized = http::Response {
            status: 401,
            body: "{}".to_string(),
        };
        assert!(matches!(
            check_manage(&unauthorized, "создал награду"),
            Err(ManageError::Unauthorized)
        ));

        let bad = http::Response {
            status: 400,
            body: r#"{"message":"invalid cost"}"#.to_string(),
        };
        match check_manage(&bad, "создал награду") {
            Err(ManageError::Failed(message)) => {
                assert!(message.contains("invalid cost"), "{message}")
            }
            _ => panic!("ожидалась ошибка с текстом Twitch"),
        }

        let ok = http::Response {
            status: 204,
            body: String::new(),
        };
        assert!(check_manage(&ok, "удалил награду").is_ok());
    }
}
