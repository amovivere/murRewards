//! Авторизованный чат Twitch: чтение сообщений, команды и отправка ответов.
//!
//! Это отдельный от музыки сервис. Он подключается к IRC уже с токеном
//! (`PASS oauth:…`, `NICK login`), поэтому видит сообщения канала и может
//! отвечать в чат от имени стримера. Старый анонимный читатель
//! (`reward_sounds::music::chat`) остаётся как есть: он нужен только для
//! команды `!трек` и оверлея музыки.
//!
//! Если сохранённый токен не даёт прав `chat:read`/`chat:edit` (аккаунт
//! входил в прошлой версии приложения), Twitch отклоняет вход. В этом случае
//! сервис переподключается анонимно (`justinfan…`) и работает в режиме
//! **только чтения**: сообщения видны, отправка возвращает понятную ошибку.
//!
//! Работает на стандартных потоках, как `twitch::Service`: TCP-сокет,
//! блокирующее чтение с коротким таймаутом, команды через канал mpsc.
//!
//! Формат IRCv3 (теги к сообщению):
//! `@badges=…;color=…;display-name=…;id=…;mod=… :user!user@user.tmi.twitch.tv PRIVMSG #channel :текст`

use std::collections::{HashMap, VecDeque};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, Sender, TryRecvError};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use reward_sounds::config::AppPaths;
use reward_sounds::music::overlay::{self, ChatOverlayMessage, ChatOverlayState};
use serde::{Deserialize, Serialize};

/// Адрес IRC-чата Twitch.
const IRC_HOST: &str = "irc.chat.twitch.tv";
const IRC_PORT: u16 = 6667;
/// Сколько последних сообщений хранит снимок и оверлей.
const MAX_MESSAGES: usize = 100;
/// Ограничение Twitch на длину одного сообщения.
const MAX_MESSAGE_CHARS: usize = 500;
/// Пауза перед переподключением: 5, 10, 20, 30 секунд (дальше всегда 30).
const BACKOFF_MIN_SECS: u64 = 5;
const BACKOFF_MAX_SECS: u64 = 30;
/// Таймаут чтения сокета: по нему же проверяем команды сервиса.
const READ_TIMEOUT: Duration = Duration::from_millis(200);
/// Сколько ждём ответа Twitch на приветствие/вход.
const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(10);
/// Кулдаун на пару «пользователь + команда».
const REPLY_COOLDOWN: Duration = Duration::from_secs(10);
/// Не чаще одного ответа в чат за это время (общий лимит).
const REPLY_GAP: Duration = Duration::from_secs(2);
/// Имя файла настроек чата в папке приложения (`%APPDATA%\RewardSounds`).
pub const SETTINGS_FILE: &str = "chat.json";
/// Счётчик для синтезированных id, если Twitch не прислал тег `id`.
static MESSAGE_SEQ: AtomicU64 = AtomicU64::new(0);

/* ------------------------------------------------------------------ */
/* Настройки                                                           */
/* ------------------------------------------------------------------ */

/// Какие команды чата обрабатывать.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct ChatCommands {
    pub queue: bool,
    pub song: bool,
    pub skip: bool,
    pub sound: bool,
}

impl Default for ChatCommands {
    fn default() -> Self {
        Self {
            queue: true,
            song: true,
            skip: true,
            sound: true,
        }
    }
}

/// Настройки вкладки «Чат». Хранятся в отдельном файле `chat.json`,
/// чтобы не менять формат основного `config.toml`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct ChatSettings {
    /// Чат включён: подключаемся и обрабатываем команды.
    pub enabled: bool,
    /// Показывать сообщения в оверлее для OBS.
    pub overlay_enabled: bool,
    /// Скрывать оверлей через N секунд без сообщений (0 — не скрывать).
    pub overlay_seconds: u64,
    /// Размер шрифта оверлея в пикселях.
    pub overlay_font: u32,
    /// Оформление оверлея: `dark` или `light`.
    pub overlay_theme: String,
    /// Прозрачность фона оверлея в процентах (0–100).
    pub overlay_opacity: u32,
    /// Обрабатываемые команды.
    pub commands: ChatCommands,
}

impl Default for ChatSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            overlay_enabled: true,
            overlay_seconds: 0,
            overlay_font: 16,
            overlay_theme: "dark".to_string(),
            overlay_opacity: 60,
            commands: ChatCommands::default(),
        }
    }
}

impl ChatSettings {
    /// Путь к файлу настроек чата.
    pub fn path(paths: &AppPaths) -> PathBuf {
        paths.data_dir.join(SETTINGS_FILE)
    }

    /// Читает настройки. Битый или отсутствующий файл не роняет приложение:
    /// берутся значения по умолчанию.
    pub fn load(path: &Path) -> Self {
        let text = match std::fs::read_to_string(path) {
            Ok(text) => text,
            Err(_) => return Self::default(),
        };
        match serde_json::from_str::<Self>(&text) {
            Ok(mut settings) => {
                settings.normalize();
                settings
            }
            Err(err) => {
                log::warn!(
                    "Чат: файл настроек {} повреждён ({err}), взяты значения по умолчанию",
                    path.display()
                );
                Self::default()
            }
        }
    }

    /// Сохраняет настройки атомарно: временный файл, затем замена.
    pub fn save(&self, path: &Path) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|err| format!("не удалось создать папку настроек: {err}"))?;
        }
        let text = serde_json::to_string_pretty(self)
            .map_err(|err| format!("не удалось сериализовать настройки: {err}"))?;
        let tmp = path.with_extension("json.tmp");
        std::fs::write(&tmp, text.as_bytes())
            .map_err(|err| format!("не удалось записать {}: {err}", tmp.display()))?;
        std::fs::rename(&tmp, path)
            .map_err(|err| format!("не удалось заменить {}: {err}", path.display()))?;
        Ok(())
    }

    /// Приводит значения к допустимым диапазонам.
    pub fn normalize(&mut self) {
        self.overlay_seconds = self.overlay_seconds.min(3600);
        self.overlay_font = self.overlay_font.clamp(10, 48);
        self.overlay_opacity = self.overlay_opacity.min(100);
        self.overlay_theme = if self.overlay_theme.trim().eq_ignore_ascii_case("light") {
            "light".to_string()
        } else {
            "dark".to_string()
        };
    }

    /// Применяет частичный патч из интерфейса.
    pub fn apply_patch(&mut self, patch: &ChatSettingsPatch) {
        if let Some(value) = patch.enabled {
            self.enabled = value;
        }
        if let Some(value) = patch.overlay_enabled {
            self.overlay_enabled = value;
        }
        if let Some(value) = patch.overlay_seconds {
            self.overlay_seconds = value.min(3600);
        }
        if let Some(value) = patch.overlay_font {
            self.overlay_font = value.clamp(10, 48);
        }
        if let Some(value) = &patch.overlay_theme {
            self.overlay_theme = value.clone();
        }
        if let Some(value) = patch.overlay_opacity {
            self.overlay_opacity = value.min(100);
        }
        if let Some(commands) = &patch.commands {
            if let Some(value) = commands.queue {
                self.commands.queue = value;
            }
            if let Some(value) = commands.song {
                self.commands.song = value;
            }
            if let Some(value) = commands.skip {
                self.commands.skip = value;
            }
            if let Some(value) = commands.sound {
                self.commands.sound = value;
            }
        }
        self.normalize();
    }
}

/// Патч настроек чата из интерфейса: меняем только переданные поля.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ChatSettingsPatch {
    pub enabled: Option<bool>,
    pub overlay_enabled: Option<bool>,
    pub overlay_seconds: Option<u64>,
    pub overlay_font: Option<u32>,
    pub overlay_theme: Option<String>,
    pub overlay_opacity: Option<u32>,
    pub commands: Option<ChatCommandsPatch>,
}

/// Частичный патч списка команд.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ChatCommandsPatch {
    pub queue: Option<bool>,
    pub song: Option<bool>,
    pub skip: Option<bool>,
    pub sound: Option<bool>,
}

/* ------------------------------------------------------------------ */
/* Сообщения и события                                                 */
/* ------------------------------------------------------------------ */

/// Одно сообщение чата.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChatMessage {
    /// Идентификатор сообщения Twitch (или синтезированный, если тегов нет).
    pub id: String,
    /// Время сообщения в миллисекундах Unix.
    pub at_ms: u64,
    /// Логин автора (строчными буквами).
    pub user: String,
    /// Отображаемое имя автора.
    pub display_name: String,
    /// Цвет имени из тега `color` (`#RRGGBB`), если задан.
    pub color: Option<String>,
    /// Текст сообщения.
    pub text: String,
    /// Автор — модератор канала.
    pub is_moderator: bool,
    /// Автор — сам стример.
    pub is_broadcaster: bool,
}

impl ChatMessage {
    /// Копия для чат-оверлея (общий тип из `music::overlay`).
    fn to_overlay(&self) -> ChatOverlayMessage {
        ChatOverlayMessage {
            id: self.id.clone(),
            at_ms: self.at_ms,
            user: self.user.clone(),
            display_name: self.display_name.clone(),
            color: self.color.clone(),
            text: self.text.clone(),
            is_moderator: self.is_moderator,
            is_broadcaster: self.is_broadcaster,
        }
    }
}

/// Снимок состояния чата для интерфейса и внутренних проверок.
#[derive(Debug, Clone)]
pub struct ChatSnapshot {
    pub enabled: bool,
    pub connected: bool,
    /// Подключены анонимно: сообщения видим, отправлять не можем.
    pub read_only: bool,
    /// Канал, к которому подключены (логин стримера).
    pub login: String,
    /// Последняя ошибка/причина переподключения.
    pub error: Option<String>,
    /// Последние сообщения, старые в начале.
    pub messages: VecDeque<ChatMessage>,
}

impl Default for ChatSnapshot {
    fn default() -> Self {
        Self {
            enabled: true,
            connected: false,
            read_only: false,
            login: String::new(),
            error: None,
            messages: VecDeque::new(),
        }
    }
}

/// Что сервис сообщает наружу (Tauri-ядру).
#[derive(Debug, Clone)]
pub enum ChatEvent {
    /// Подключились к каналу. `read_only` — анонимный режим без отправки.
    Connected { read_only: bool },
    /// Соединение закрыто. Пустая строка — отключение по команде пользователя.
    Disconnected(String),
    /// Пришло сообщение из чата.
    Message(ChatMessage),
    /// Некритичная ошибка (например, не удалось отправить сообщение).
    Error(String),
}

/* ------------------------------------------------------------------ */
/* Разбор IRC                                                          */
/* ------------------------------------------------------------------ */

/// Разбирает строку IRC с `PRIVMSG` в сообщение чата.
///
/// Понимает IRCv3-теги (`@badges=…;color=…;display-name=…;id=…`), префикс
/// автора и экранирование в тегах (`\s`, `\:`, `\\`, `\r`, `\n`).
/// Возвращает `None`, если строка не является сообщением.
pub fn parse_privmsg(line: &str) -> Option<ChatMessage> {
    let line = line.trim_end_matches(|c| c == '\r' || c == '\n');
    let privmsg_at = line.find(" PRIVMSG ")?;
    let after_command = &line[privmsg_at + " PRIVMSG ".len()..];
    // `#channel :текст` — канал отделён от текста сочетанием « :».
    let (_, text) = after_command.split_once(" :")?;

    // Теги и префикс: `@tags :user!user@host PRIVMSG …`
    let (tags, rest) = match line.strip_prefix('@') {
        Some(stripped) => match stripped.split_once(' ') {
            Some((tags, rest)) => (tags, rest),
            None => ("", stripped),
        },
        None => ("", line),
    };
    let user = rest
        .strip_prefix(':')
        .and_then(|prefix| prefix.split('!').next())
        .unwrap_or("")
        .trim()
        .to_lowercase();
    if user.is_empty() {
        return None;
    }

    let mut color: Option<String> = None;
    let mut display_name: Option<String> = None;
    let mut id: Option<String> = None;
    let mut at_ms: Option<u64> = None;
    let mut is_moderator = false;
    let mut is_broadcaster = false;

    for tag in tags.split(';') {
        let Some((key, value)) = tag.split_once('=') else {
            continue;
        };
        let value = unescape_tag(value);
        match key {
            "color" if is_valid_color(&value) => color = Some(value),
            "display-name" if !value.trim().is_empty() => display_name = Some(value),
            "id" if !value.trim().is_empty() => id = Some(value),
            "tmi-sent-ts" => at_ms = value.parse::<u64>().ok(),
            "mod" => is_moderator = value == "1",
            "badges" => {
                for badge in value.split(',') {
                    if badge.starts_with("broadcaster/") {
                        is_broadcaster = true;
                    }
                    if badge.starts_with("moderator/") {
                        is_moderator = true;
                    }
                }
            }
            _ => {}
        }
    }
    if is_broadcaster {
        is_moderator = true;
    }

    let at_ms = at_ms.unwrap_or_else(now_ms);
    let display_name = display_name.unwrap_or_else(|| user.clone());
    let id = id.unwrap_or_else(|| {
        format!(
            "{at_ms}-{}-{user}",
            MESSAGE_SEQ.fetch_add(1, Ordering::Relaxed)
        )
    });

    Some(ChatMessage {
        id,
        at_ms,
        user,
        display_name,
        color,
        text: text.to_string(),
        is_moderator,
        is_broadcaster,
    })
}

/// Снимает IRCv3-экранирование значения тега.
fn unescape_tag(value: &str) -> String {
    let mut result = String::with_capacity(value.len());
    let mut chars = value.chars();
    while let Some(ch) = chars.next() {
        if ch != '\\' {
            result.push(ch);
            continue;
        }
        match chars.next() {
            Some('s') => result.push(' '),
            Some(':') => result.push(';'),
            Some('\\') => result.push('\\'),
            Some('r') => result.push('\r'),
            Some('n') => result.push('\n'),
            Some(other) => {
                // Неизвестное экранирование оставляем как есть.
                result.push('\\');
                result.push(other);
            }
            None => result.push('\\'),
        }
    }
    result
}

/// Проверяет цвет Twitch: `#RRGGBB`.
fn is_valid_color(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 7 && bytes[0] == b'#' && bytes[1..].iter().all(u8::is_ascii_hexdigit)
}

/// Готовит исходящее сообщение: убирает переводы строк (защита от инъекции
/// IRC-команд), ограничивает длину и не даёт отправить пустую строку.
pub fn prepare_outgoing(text: &str) -> Result<String, String> {
    let cleaned: String = text
        .chars()
        .filter(|ch| *ch != '\r' && *ch != '\n')
        .collect();
    let cleaned = cleaned.trim().to_string();
    if cleaned.is_empty() {
        return Err("Сообщение пустое.".to_string());
    }
    if cleaned.chars().count() > MAX_MESSAGE_CHARS {
        return Err(format!(
            "Сообщение длиннее {MAX_MESSAGE_CHARS} символов — Twitch его не примет."
        ));
    }
    Ok(cleaned)
}

/* ------------------------------------------------------------------ */
/* Команды чата (без сети: только разбор и готовый ответ)              */
/* ------------------------------------------------------------------ */

/// Разобранная команда из сообщения чата.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ChatCommand {
    Queue,
    Song,
    Skip,
    /// `!звук <часть названия>`; пустая строка — название не указано.
    Sound(String),
    /// Не наша команда (в том числе `!трек` — его обрабатывает старый читатель).
    Unknown,
}

impl ChatCommand {
    /// Короткий ключ для журнала и кулдауна.
    pub fn key(&self) -> &'static str {
        match self {
            ChatCommand::Queue => "queue",
            ChatCommand::Song => "song",
            ChatCommand::Skip => "skip",
            ChatCommand::Sound(_) => "sound",
            ChatCommand::Unknown => "unknown",
        }
    }

    /// Разрешена ли команда в настройках.
    pub fn allowed(&self, settings: &ChatSettings) -> bool {
        match self {
            ChatCommand::Queue => settings.commands.queue,
            ChatCommand::Song => settings.commands.song,
            ChatCommand::Skip => settings.commands.skip,
            ChatCommand::Sound(_) => settings.commands.sound,
            ChatCommand::Unknown => false,
        }
    }
}

/// Строка из чата → команда. Регистр команды не важен.
pub fn parse_command(text: &str) -> ChatCommand {
    let text = text.trim_start();
    let (head, rest) = match text.split_once(char::is_whitespace) {
        Some((head, rest)) => (head, rest),
        None => (text, ""),
    };
    match head.to_lowercase().as_str() {
        "!queue" => ChatCommand::Queue,
        "!song" => ChatCommand::Song,
        "!skip" => ChatCommand::Skip,
        "!звук" => ChatCommand::Sound(rest.trim().to_string()),
        _ => ChatCommand::Unknown,
    }
}

/// Кандидат для команды `!звук`: награда с привязанным локальным файлом.
#[derive(Debug, Clone, PartialEq)]
pub struct SoundCandidate {
    pub id: String,
    pub title: String,
    pub path: String,
    pub volume: f32,
}

/// Всё, что нужно, чтобы ответить на команду. Собирается ядром из текущего
/// состояния музыки и настроек, поэтому функция ответа тестируется без сети.
#[derive(Debug, Clone, Default)]
pub struct ChatCommandContext {
    /// Ждут очереди (без текущего трека), в порядке очереди.
    pub queue: Vec<String>,
    /// Текущий трек: (название, позиция, длительность) в секундах.
    pub current: Option<(String, u64, u64)>,
    /// Звуки, доступные для `!звук`.
    pub sounds: Vec<SoundCandidate>,
    /// Автор сообщения — модератор или стример.
    pub can_skip: bool,
}

/// Что сделать после ответа.
#[derive(Debug, Clone, PartialEq)]
pub enum ChatAction {
    /// Только ответить.
    None,
    /// Пропустить текущий трек.
    Skip,
    /// Проиграть звук награды.
    Play(SoundCandidate),
}

/// Готовит ответ на команду. `None` — отвечать не нужно (обычное сообщение).
pub fn command_reply(
    command: &ChatCommand,
    context: &ChatCommandContext,
) -> Option<(String, ChatAction)> {
    match command {
        ChatCommand::Unknown => None,
        ChatCommand::Queue => {
            let count = context.queue.len();
            if count == 0 {
                return Some(("Очередь пуста".to_string(), ChatAction::None));
            }
            let shown: Vec<String> = context
                .queue
                .iter()
                .take(3)
                .enumerate()
                .map(|(index, title)| format!("{}) {title}", index + 1))
                .collect();
            let mut text = format!("В очереди {count}: {}", shown.join(" "));
            if count > 3 {
                text.push_str(&format!(" и ещё {}", count - 3));
            }
            Some((text, ChatAction::None))
        }
        ChatCommand::Song => match &context.current {
            Some((title, position, duration)) => Some((
                format!(
                    "Сейчас играет: {title} ({} / {})",
                    format_time(*position),
                    format_time(*duration)
                ),
                ChatAction::None,
            )),
            None => Some(("Сейчас ничего не играет".to_string(), ChatAction::None)),
        },
        ChatCommand::Skip => {
            if !context.can_skip {
                return Some((
                    "Пропускать треки может только модератор".to_string(),
                    ChatAction::None,
                ));
            }
            if context.current.is_none() {
                return Some(("Сейчас ничего не играет".to_string(), ChatAction::None));
            }
            Some(("Трек пропущен".to_string(), ChatAction::Skip))
        }
        ChatCommand::Sound(query) => {
            let query = query.trim().to_lowercase();
            if query.is_empty() {
                return Some(("Не нашёл такой звук".to_string(), ChatAction::None));
            }
            match context
                .sounds
                .iter()
                .find(|sound| sound.title.to_lowercase().contains(&query))
            {
                Some(sound) => Some((
                    format!("Играю «{}»", sound.title),
                    ChatAction::Play(sound.clone()),
                )),
                None => Some(("Не нашёл такой звук".to_string(), ChatAction::None)),
            }
        }
    }
}

/// Секунды → `м:сс` для ответа `!song`.
fn format_time(seconds: u64) -> String {
    format!("{}:{:02}", seconds / 60, seconds % 60)
}

/// Ограничитель ответов: кулдаун на пару «пользователь + команда» и общий
/// лимит, чтобы не словить rate limit Twitch.
#[derive(Debug, Default)]
pub struct ReplyLimiter {
    cooldowns: HashMap<(String, String), Instant>,
    last_reply: Option<Instant>,
}

impl ReplyLimiter {
    /// Можно ли сейчас ответить этому пользователю на эту команду.
    pub fn ready(&self, user: &str, command: &str, now: Instant) -> bool {
        if let Some(last) = self.last_reply {
            if now.saturating_duration_since(last) < REPLY_GAP {
                return false;
            }
        }
        let key = (user.to_lowercase(), command.to_string());
        match self.cooldowns.get(&key) {
            Some(at) => now.saturating_duration_since(*at) >= REPLY_COOLDOWN,
            None => true,
        }
    }

    /// Запоминает отправленный ответ.
    pub fn record(&mut self, user: &str, command: &str, now: Instant) {
        self.cooldowns
            .insert((user.to_lowercase(), command.to_string()), now);
        self.last_reply = Some(now);
        // Старые записи не нужны: карта не должна расти бесконечно.
        self.cooldowns
            .retain(|_, at| now.saturating_duration_since(*at) < Duration::from_secs(600));
    }
}

/* ------------------------------------------------------------------ */
/* Фоновый сервис                                                      */
/* ------------------------------------------------------------------ */

/// Команды сервису чата.
enum Cmd {
    Connect { login: String, token: String },
    Disconnect,
    Send(String),
}

/// Куда хотим подключиться.
struct Target {
    login: String,
    /// Пустая строка — подключаемся анонимно (только чтение).
    token: String,
}

/// Чем закончилось текущее соединение.
enum SessionEnd {
    UserDisconnect,
    Retarget { login: String, token: String },
    Lost(String),
}

/// Чем закончилась попытка соединения.
enum ConnectFailure {
    /// Twitch не принял токен — нужно пробовать анонимный режим.
    AuthRejected,
    Network(String),
}

/// Итог попытки подключения с учётом fallback в режим чтения.
enum ConnectionEnd {
    Disconnected,
    Retarget { login: String, token: String },
    Lost(String),
}

/// Потокобезопасный сокет с построчным чтением.
struct Link {
    stream: TcpStream,
    pending: Vec<u8>,
}

impl Link {
    /// Читает очередную строку. `Ok(None)` — за таймаут данных не пришло.
    fn read_line(&mut self) -> Result<Option<String>, String> {
        loop {
            if let Some(position) = self.pending.iter().position(|&byte| byte == b'\n') {
                let line: Vec<u8> = self.pending.drain(..=position).collect();
                let text = String::from_utf8_lossy(&line);
                return Ok(Some(
                    text.trim_end_matches(|c| c == '\r' || c == '\n')
                        .to_string(),
                ));
            }
            let mut buffer = [0u8; 4096];
            match self.stream.read(&mut buffer) {
                Ok(0) => return Err("Twitch закрыл соединение".to_string()),
                Ok(read) => self.pending.extend_from_slice(&buffer[..read]),
                Err(err)
                    if matches!(
                        err.kind(),
                        std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                    ) =>
                {
                    return Ok(None);
                }
                Err(err) if err.kind() == std::io::ErrorKind::Interrupted => continue,
                Err(err) => return Err(err.to_string()),
            }
        }
    }
}

/// Фоновый сервис чата.
pub struct Service {
    tx: Sender<Cmd>,
    events: Receiver<ChatEvent>,
    state: Arc<Mutex<ChatSnapshot>>,
    settings: Arc<Mutex<ChatSettings>>,
    overlay: Arc<Mutex<ChatOverlayState>>,
}

impl Service {
    /// Запускает фоновый поток чата и подключает состояние к оверлею.
    pub fn spawn() -> Self {
        let state = Arc::new(Mutex::new(ChatSnapshot::default()));
        let settings = Arc::new(Mutex::new(ChatSettings::default()));
        let overlay_state = Arc::new(Mutex::new(ChatOverlayState::default()));
        // Оверлей для OBS читает то же состояние, что обновляет этот сервис.
        overlay::set_chat_state(Arc::clone(&overlay_state));

        let (tx, rx) = mpsc::channel();
        let (event_tx, event_rx) = mpsc::channel();

        let thread_state = Arc::clone(&state);
        let thread_settings = Arc::clone(&settings);
        let thread_overlay = Arc::clone(&overlay_state);
        let spawned = thread::Builder::new()
            .name("reward-sounds-chat".to_string())
            .spawn(move || run(rx, event_tx, thread_state, thread_settings, thread_overlay));

        if let Err(err) = spawned {
            log::error!("Чат: не удалось запустить сервис: {err}");
            if let Ok(mut state) = state.lock() {
                state.error = Some("Не удалось запустить сервис чата".to_string());
            }
        }

        Self {
            tx,
            events: event_rx,
            state,
            settings,
            overlay: overlay_state,
        }
    }

    /// Текущие настройки чата.
    pub fn settings(&self) -> ChatSettings {
        self.settings
            .lock()
            .map(|settings| settings.clone())
            .unwrap_or_default()
    }

    /// Обновляет настройки: состояние оверлея и флаг «включён».
    pub fn set_settings(&self, settings: ChatSettings) {
        {
            let mut guard = self
                .settings
                .lock()
                .unwrap_or_else(|err| err.into_inner());
            *guard = settings.clone();
        }
        if let Ok(mut state) = self.state.lock() {
            state.enabled = settings.enabled;
        }
        if let Ok(mut overlay) = self.overlay.lock() {
            overlay.seconds = settings.overlay_seconds;
            if !settings.overlay_enabled {
                overlay.messages.clear();
            }
        }
    }

    /// Подключается к каналу. Пустой токен — анонимное чтение без отправки.
    pub fn connect(&self, login: &str, token: &str) {
        let login = normalize_login(login);
        if login.is_empty() {
            if let Ok(mut state) = self.state.lock() {
                state.connected = false;
                state.error = Some("Не указан канал Twitch. Войдите в Twitch.".to_string());
            }
            return;
        }
        let _ = self.tx.send(Cmd::Connect {
            login,
            token: token.trim().to_string(),
        });
    }

    /// Отключается от чата (сервис продолжит ждать команды).
    pub fn disconnect(&self) {
        let _ = self.tx.send(Cmd::Disconnect);
    }

    /// Отправляет сообщение в чат. Ошибки — понятным текстом для интерфейса.
    pub fn send(&self, text: &str) -> Result<(), String> {
        let text = prepare_outgoing(text)?;
        {
            let snapshot = self
                .state
                .lock()
                .map_err(|_| "Состояние чата недоступно.".to_string())?;
            if !snapshot.connected {
                return Err(
                    "Чат не подключён. Подключите его на вкладке «Чат».".to_string(),
                );
            }
            if snapshot.read_only {
                return Err("Чат работает только на чтение: у токена нет прав chat:edit. Войдите в Twitch заново, чтобы отправлять сообщения.".to_string());
            }
        }
        self.tx
            .send(Cmd::Send(text))
            .map_err(|_| "Сервис чата не отвечает. Перезапустите приложение.".to_string())
    }

    /// Снимок состояния (подключение и последние сообщения).
    pub fn snapshot(&self) -> ChatSnapshot {
        self.state
            .lock()
            .map(|state| state.clone())
            .unwrap_or_default()
    }

    /// Забирает накопившиеся события (не блокируясь).
    pub fn try_recv(&self) -> Vec<ChatEvent> {
        self.events.try_iter().collect()
    }

    /// Очищает историю сообщений (в интерфейсе и в оверлее).
    pub fn clear_messages(&self) {
        if let Ok(mut state) = self.state.lock() {
            state.messages.clear();
        }
        if let Ok(mut overlay) = self.overlay.lock() {
            overlay.messages.clear();
        }
    }
}

impl Drop for Service {
    fn drop(&mut self) {
        // Закрываем канал: фоновый поток завершится.
        let (tx, _rx) = mpsc::channel();
        let _ = std::mem::replace(&mut self.tx, tx);
    }
}

fn normalize_login(login: &str) -> String {
    login
        .trim()
        .trim_start_matches('#')
        .to_lowercase()
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || *ch == '_')
        .collect()
}

/// Основной цикл: держит соединение, переподключается с backoff.
fn run(
    rx: Receiver<Cmd>,
    events: Sender<ChatEvent>,
    state: Arc<Mutex<ChatSnapshot>>,
    settings: Arc<Mutex<ChatSettings>>,
    overlay: Arc<Mutex<ChatOverlayState>>,
) {
    let mut target: Option<Target> = None;
    let mut backoff = BACKOFF_MIN_SECS;
    let mut retry_at: Option<Instant> = None;

    loop {
        // Пока не подключены — ждём команду.
        if target.is_none() {
            let Ok(command) = rx.recv() else {
                return;
            };
            match command {
                Cmd::Connect { login, token } => {
                    target = Some(Target { login, token });
                    backoff = BACKOFF_MIN_SECS;
                    retry_at = None;
                }
                Cmd::Disconnect => {
                    mark_disconnected(&state, &events, "");
                }
                Cmd::Send(_) => {
                    let _ = events.send(ChatEvent::Error(
                        "Чат не подключён — сообщение не отправлено.".to_string(),
                    ));
                }
            }
            continue;
        }

        // Пауза перед повторным подключением: ждём и слушаем команды.
        if let Some(at) = retry_at {
            if Instant::now() < at {
                match rx.try_recv() {
                    Ok(Cmd::Connect { login, token }) => {
                        target = Some(Target { login, token });
                        backoff = BACKOFF_MIN_SECS;
                        retry_at = None;
                    }
                    Ok(Cmd::Disconnect) => {
                        target = None;
                        retry_at = None;
                        mark_disconnected(&state, &events, "");
                    }
                    Ok(Cmd::Send(_)) => {
                        let _ = events.send(ChatEvent::Error(
                            "Чат не подключён — сообщение не отправлено.".to_string(),
                        ));
                    }
                    Err(TryRecvError::Empty) => thread::sleep(Duration::from_millis(100)),
                    Err(TryRecvError::Disconnected) => return,
                }
                continue;
            }
            retry_at = None;
        }

        let Some(current) = target.as_ref().map(|target| Target {
            login: target.login.clone(),
            token: target.token.clone(),
        }) else {
            continue;
        };
        match run_connection(&current, &rx, &events, &state, &settings, &overlay) {
            ConnectionEnd::Disconnected => {
                mark_disconnected(&state, &events, "");
                target = None;
                retry_at = None;
            }
            ConnectionEnd::Retarget { login, token } => {
                target = Some(Target { login, token });
                backoff = BACKOFF_MIN_SECS;
                retry_at = None;
            }
            ConnectionEnd::Lost(reason) => {
                mark_disconnected(&state, &events, &reason);
                log::warn!("Чат: {reason}; переподключение через {backoff} с");
                retry_at = Some(Instant::now() + Duration::from_secs(backoff));
                backoff = (backoff * 2).min(BACKOFF_MAX_SECS);
            }
        }
    }
}

/// Пытается подключиться с токеном, а при отказе входа — анонимно (только чтение).
fn run_connection(
    target: &Target,
    rx: &Receiver<Cmd>,
    events: &Sender<ChatEvent>,
    state: &Arc<Mutex<ChatSnapshot>>,
    settings: &Arc<Mutex<ChatSettings>>,
    overlay: &Arc<Mutex<ChatOverlayState>>,
) -> ConnectionEnd {
    if !target.token.is_empty() {
        match connect_and_run(
            target,
            Some(&target.token),
            rx,
            events,
            state,
            settings,
            overlay,
        ) {
            Ok(SessionEnd::UserDisconnect) => return ConnectionEnd::Disconnected,
            Ok(SessionEnd::Retarget { login, token }) => {
                return ConnectionEnd::Retarget { login, token }
            }
            Ok(SessionEnd::Lost(reason)) => return ConnectionEnd::Lost(reason),
            Err(ConnectFailure::AuthRejected) => {
                log::warn!(
                    "Чат: Twitch не принял токен (нет прав chat:read?) — подключаемся анонимно, только чтение"
                );
            }
            Err(ConnectFailure::Network(reason)) => return ConnectionEnd::Lost(reason),
        }
    }

    // Анонимное чтение: сообщения видны, отправка недоступна.
    match connect_and_run(target, None, rx, events, state, settings, overlay) {
        Ok(SessionEnd::UserDisconnect) => ConnectionEnd::Disconnected,
        Ok(SessionEnd::Retarget { login, token }) => ConnectionEnd::Retarget { login, token },
        Ok(SessionEnd::Lost(reason)) => ConnectionEnd::Lost(reason),
        Err(ConnectFailure::Network(reason)) => ConnectionEnd::Lost(reason),
        Err(ConnectFailure::AuthRejected) => {
            ConnectionEnd::Lost("Twitch отклонил подключение к чату.".to_string())
        }
    }
}

/// Одно подключение: приветствие, вход, чтение сообщений.
fn connect_and_run(
    target: &Target,
    token: Option<&str>,
    rx: &Receiver<Cmd>,
    events: &Sender<ChatEvent>,
    state: &Arc<Mutex<ChatSnapshot>>,
    settings: &Arc<Mutex<ChatSettings>>,
    overlay: &Arc<Mutex<ChatOverlayState>>,
) -> Result<SessionEnd, ConnectFailure> {
    let read_only = token.is_none();
    let stream = TcpStream::connect((IRC_HOST, IRC_PORT)).map_err(|err| {
        ConnectFailure::Network(format!("Не удалось подключиться к чату Twitch: {err}"))
    })?;
    let _ = stream.set_read_timeout(Some(READ_TIMEOUT));
    let mut writer = stream.try_clone().map_err(|err| {
        ConnectFailure::Network(format!("Чат: не удалось подготовить соединение: {err}"))
    })?;
    let mut link = Link {
        stream,
        pending: Vec::new(),
    };

    let nick = if read_only {
        anonymous_nick()
    } else {
        target.login.clone()
    };
    let mut hello = String::from("CAP REQ :twitch.tv/tags\r\n");
    match token {
        Some(token) => hello.push_str(&format!("PASS oauth:{token}\r\n")),
        None => hello.push_str("PASS SCHMOOPIIE\r\n"),
    }
    hello.push_str(&format!("NICK {nick}\r\nJOIN #{}\r\n", target.login));
    writer.write_all(hello.as_bytes()).map_err(|err| {
        ConnectFailure::Network(format!("Чат: не удалось отправить приветствие: {err}"))
    })?;

    // Рукопожатие: ждём подтверждение входа или отказ.
    let started = Instant::now();
    loop {
        match rx.try_recv() {
            Ok(Cmd::Disconnect) => return Ok(SessionEnd::UserDisconnect),
            Ok(Cmd::Connect { login, token }) => {
                return Ok(SessionEnd::Retarget { login, token })
            }
            Ok(Cmd::Send(_)) => {
                let _ = events.send(ChatEvent::Error(
                    "Чат ещё подключается — сообщение не отправлено.".to_string(),
                ));
            }
            Err(TryRecvError::Empty) => {}
            Err(TryRecvError::Disconnected) => return Ok(SessionEnd::UserDisconnect),
        }
        if started.elapsed() > HANDSHAKE_TIMEOUT {
            return Err(if read_only {
                ConnectFailure::Network("Чат Twitch не ответил на подключение.".to_string())
            } else {
                ConnectFailure::AuthRejected
            });
        }
        let line = match link.read_line() {
            Ok(Some(line)) => line,
            Ok(None) => continue,
            Err(err) => {
                return Err(ConnectFailure::Network(format!(
                    "Соединение с чатом прервано: {err}"
                )))
            }
        };
        if is_auth_failure(&line) {
            return Err(ConnectFailure::AuthRejected);
        }
        if is_login_success(&line) {
            break;
        }
    }

    mark_connected(state, events, &target.login, read_only);
    log::info!(
        "Чат: подключён к каналу #{}{}",
        target.login,
        if read_only {
            " (только чтение)"
        } else {
            ""
        }
    );

    // Основной цикл: читаем строки и попутно проверяем команды сервиса.
    loop {
        loop {
            let command = match rx.try_recv() {
                Ok(command) => command,
                Err(TryRecvError::Empty) => break,
                Err(TryRecvError::Disconnected) => return Ok(SessionEnd::UserDisconnect),
            };
            match command {
                Cmd::Send(text) => {
                    if read_only {
                        let _ = events.send(ChatEvent::Error(
                            "Чат работает только на чтение — сообщение не отправлено."
                                .to_string(),
                        ));
                        continue;
                    }
                    let outgoing = format!("PRIVMSG #{} :{text}\r\n", target.login);
                    if let Err(err) = writer.write_all(outgoing.as_bytes()) {
                        return Ok(SessionEnd::Lost(format!(
                            "Не удалось отправить сообщение в чат: {err}"
                        )));
                    }
                }
                Cmd::Disconnect => return Ok(SessionEnd::UserDisconnect),
                Cmd::Connect { login, token } => {
                    return Ok(SessionEnd::Retarget { login, token })
                }
            }
        }

        let line = match link.read_line() {
            Ok(Some(line)) => line,
            Ok(None) => continue,
            Err(err) => {
                return Ok(SessionEnd::Lost(format!(
                    "Соединение с чатом прервано: {err}"
                )))
            }
        };
        if line.starts_with("PING") {
            let payload = line["PING".len()..].trim().trim_start_matches(':').trim();
            let pong = format!(
                "PONG :{}\r\n",
                if payload.is_empty() {
                    "tmi.twitch.tv"
                } else {
                    payload
                }
            );
            let _ = writer.write_all(pong.as_bytes());
            continue;
        }
        if is_auth_failure(&line) {
            return Ok(SessionEnd::Lost(
                "Twitch отклонил токен чата. Войдите в Twitch заново.".to_string(),
            ));
        }
        let Some(message) = parse_privmsg(&line) else {
            continue;
        };
        publish_message(message, state, settings, overlay, events);
    }
}

/// Обновляет снимок и оверлей, отправляет событие ядру.
fn publish_message(
    message: ChatMessage,
    state: &Arc<Mutex<ChatSnapshot>>,
    settings: &Arc<Mutex<ChatSettings>>,
    overlay: &Arc<Mutex<ChatOverlayState>>,
    events: &Sender<ChatEvent>,
) {
    if let Ok(mut snapshot) = state.lock() {
        snapshot.messages.push_back(message.clone());
        while snapshot.messages.len() > MAX_MESSAGES {
            snapshot.messages.pop_front();
        }
    }
    let overlay_enabled = settings
        .lock()
        .map(|settings| settings.overlay_enabled)
        .unwrap_or(false);
    if overlay_enabled {
        if let Ok(mut overlay) = overlay.lock() {
            overlay.messages.push(message.to_overlay());
            while overlay.messages.len() > MAX_MESSAGES {
                overlay.messages.remove(0);
            }
        }
    }
    let _ = events.send(ChatEvent::Message(message));
}

fn mark_connected(
    state: &Arc<Mutex<ChatSnapshot>>,
    events: &Sender<ChatEvent>,
    login: &str,
    read_only: bool,
) {
    if let Ok(mut state) = state.lock() {
        state.connected = true;
        state.read_only = read_only;
        state.login = login.to_string();
        state.error = None;
    }
    let _ = events.send(ChatEvent::Connected { read_only });
}

fn mark_disconnected(state: &Arc<Mutex<ChatSnapshot>>, events: &Sender<ChatEvent>, reason: &str) {
    if let Ok(mut state) = state.lock() {
        state.connected = false;
        state.read_only = false;
        state.error = if reason.is_empty() {
            None
        } else {
            Some(reason.to_string())
        };
    }
    let _ = events.send(ChatEvent::Disconnected(reason.to_string()));
}

fn is_auth_failure(line: &str) -> bool {
    line.contains("Login authentication failed") || line.contains("Improperly formatted auth")
}

fn is_login_success(line: &str) -> bool {
    line.contains(" 001 ")
        || line.contains(" 376 ")
        || line.contains(" 366 ")
        || line.contains(" JOIN #")
}

fn anonymous_nick() -> String {
    format!("justinfan{}", 10000 + now_ms() % 80000)
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

/* ------------------------------------------------------------------ */
/* Тесты                                                               */
/* ------------------------------------------------------------------ */

#[cfg(test)]
mod tests {
    use super::*;

    fn tag_line(tags: &str, user: &str, text: &str) -> String {
        format!("@{tags} :{user}!{user}@{user}.tmi.twitch.tv PRIVMSG #channel :{text}")
    }

    #[test]
    fn parses_message_with_tags() {
        let line = tag_line(
            "badges=broadcaster/1,subscriber/12;color=#FF0000;display-name=MurRewards;id=abc-123;mod=1;tmi-sent-ts=1730000000000",
            "mur",
            "!queue привет",
        );
        let message = parse_privmsg(&line).expect("сообщение должно разобраться");
        assert_eq!(message.id, "abc-123");
        assert_eq!(message.at_ms, 1_730_000_000_000);
        assert_eq!(message.user, "mur");
        assert_eq!(message.display_name, "MurRewards");
        assert_eq!(message.color.as_deref(), Some("#FF0000"));
        assert_eq!(message.text, "!queue привет");
        assert!(message.is_broadcaster);
        assert!(message.is_moderator);
    }

    #[test]
    fn parses_moderator_badge() {
        let line = tag_line(
            "badges=moderator/1;color=#00FF00;display-name=Mod;id=2;mod=1;tmi-sent-ts=5",
            "mod",
            "hi",
        );
        let message = parse_privmsg(&line).unwrap();
        assert!(message.is_moderator);
        assert!(!message.is_broadcaster);
        assert_eq!(message.text, "hi");
    }

    #[test]
    fn parses_message_without_tags() {
        let line = ":viewer!viewer@viewer.tmi.twitch.tv PRIVMSG #channel :hello : world";
        let message = parse_privmsg(line).expect("сообщение без тегов тоже разбирается");
        assert_eq!(message.user, "viewer");
        assert_eq!(message.display_name, "viewer");
        assert_eq!(message.color, None);
        assert_eq!(message.text, "hello : world");
        assert!(!message.id.is_empty());
        assert!(message.at_ms > 0);
        assert!(!message.is_moderator);
        assert!(!message.is_broadcaster);
    }

    #[test]
    fn unescapes_tag_values() {
        let line = tag_line(
            "display-name=Mur\\sRewards;color=#ABCDEF;id=x;tmi-sent-ts=7",
            "mur",
            "text",
        );
        let message = parse_privmsg(&line).unwrap();
        assert_eq!(message.display_name, "Mur Rewards");
        // Цвет из тега не должен ломать разбор.
        assert_eq!(message.color.as_deref(), Some("#ABCDEF"));
    }

    #[test]
    fn ignores_bad_color_and_unknown_lines() {
        let line = tag_line("color=Red;id=x", "user", "hi");
        let message = parse_privmsg(&line).unwrap();
        assert_eq!(message.color, None);

        assert_eq!(parse_privmsg("PING :tmi.twitch.tv"), None);
        assert_eq!(parse_privmsg(""), None);
        assert_eq!(
            parse_privmsg(":user!user@user.tmi.twitch.tv PRIVMSG #channel"),
            None
        );
        assert_eq!(parse_privmsg("обычный текст"), None);
    }

    #[test]
    fn sanitizes_outgoing_text() {
        assert_eq!(prepare_outgoing("  привет  ").unwrap(), "привет");
        assert_eq!(prepare_outgoing("при\nвет\r").unwrap(), "привет");
        assert!(prepare_outgoing("   ").is_err());
        assert!(prepare_outgoing(&"а".repeat(MAX_MESSAGE_CHARS)).is_ok());
        assert!(prepare_outgoing(&"а".repeat(MAX_MESSAGE_CHARS + 1)).is_err());
    }

    #[test]
    fn parses_commands_case_insensitive() {
        assert_eq!(parse_command("!queue"), ChatCommand::Queue);
        assert_eq!(parse_command("  !QUEUE  "), ChatCommand::Queue);
        assert_eq!(parse_command("!song"), ChatCommand::Song);
        assert_eq!(parse_command("!skip"), ChatCommand::Skip);
        assert_eq!(
            parse_command("!звук торт"),
            ChatCommand::Sound("торт".to_string())
        );
        assert_eq!(parse_command("!звук"), ChatCommand::Sound(String::new()));
        assert_eq!(parse_command("!трек"), ChatCommand::Unknown);
        assert_eq!(parse_command("привет"), ChatCommand::Unknown);
        assert_eq!(parse_command("!queuex"), ChatCommand::Unknown);
        assert_eq!(parse_command(""), ChatCommand::Unknown);
    }

    #[test]
    fn queue_reply_lists_three_and_rest() {
        let context = ChatCommandContext {
            queue: vec![
                "Первый".to_string(),
                "Второй".to_string(),
                "Третий".to_string(),
                "Четвёртый".to_string(),
                "Пятый".to_string(),
            ],
            ..ChatCommandContext::default()
        };
        let (text, action) = command_reply(&ChatCommand::Queue, &context).unwrap();
        assert_eq!(text, "В очереди 5: 1) Первый 2) Второй 3) Третий и ещё 2");
        assert_eq!(action, ChatAction::None);

        let empty = command_reply(&ChatCommand::Queue, &ChatCommandContext::default()).unwrap();
        assert_eq!(empty.0, "Очередь пуста");
    }

    #[test]
    fn song_and_skip_replies() {
        let context = ChatCommandContext {
            current: Some(("Трек".to_string(), 65, 200)),
            can_skip: true,
            ..ChatCommandContext::default()
        };
        assert_eq!(
            command_reply(&ChatCommand::Song, &context).unwrap().0,
            "Сейчас играет: Трек (1:05 / 3:20)"
        );

        let (text, action) = command_reply(&ChatCommand::Skip, &context).unwrap();
        assert_eq!(text, "Трек пропущен");
        assert_eq!(action, ChatAction::Skip);

        let viewer = ChatCommandContext {
            current: Some(("Трек".to_string(), 1, 2)),
            can_skip: false,
            ..ChatCommandContext::default()
        };
        let (text, action) = command_reply(&ChatCommand::Skip, &viewer).unwrap();
        assert_eq!(text, "Пропускать треки может только модератор");
        assert_eq!(action, ChatAction::None);

        let idle = command_reply(&ChatCommand::Song, &ChatCommandContext::default()).unwrap();
        assert_eq!(idle.0, "Сейчас ничего не играет");
    }

    #[test]
    fn sound_command_matches_title_case_insensitive() {
        let sound = SoundCandidate {
            id: "reward-1".to_string(),
            title: "Испугать стримера".to_string(),
            path: "C:\\sounds\\boo.mp3".to_string(),
            volume: 0.8,
        };
        let context = ChatCommandContext {
            sounds: vec![sound.clone()],
            ..ChatCommandContext::default()
        };
        let command = parse_command("!ЗВУК ИСПУГАТЬ");
        let (text, action) = command_reply(&command, &context).unwrap();
        assert_eq!(text, "Играю «Испугать стримера»");
        assert_eq!(action, ChatAction::Play(sound));

        let (text, action) = command_reply(&ChatCommand::Sound("нет такого".into()), &context)
            .unwrap();
        assert_eq!(text, "Не нашёл такой звук");
        assert_eq!(action, ChatAction::None);
    }

    #[test]
    fn limiter_enforces_cooldown_and_global_gap() {
        let start = Instant::now();
        let mut limiter = ReplyLimiter::default();

        assert!(limiter.ready("User", "queue", start));
        limiter.record("User", "queue", start);

        // Кулдаун на пользователя/команду: 10 секунд.
        assert!(!limiter.ready("user", "queue", start + Duration::from_secs(5)));
        assert!(limiter.ready("user", "queue", start + Duration::from_secs(10)));

        // Общий лимит: не чаще одного ответа в 2 секунды.
        assert!(!limiter.ready("Другой", "song", start + Duration::from_secs(1)));
        assert!(limiter.ready("Другой", "song", start + Duration::from_secs(2)));

        // Другая команда того же пользователя не заблокирована кулдауном.
        assert!(limiter.ready("User", "song", start + Duration::from_secs(2)));
    }

    #[test]
    fn settings_round_trip_and_broken_file() {
        let path = std::env::temp_dir().join(format!(
            "reward-sounds-chat-settings-{}.json",
            std::process::id()
        ));
        let mut settings = ChatSettings::default();
        settings.enabled = false;
        settings.overlay_enabled = false;
        settings.overlay_seconds = 15;
        settings.overlay_font = 22;
        settings.overlay_theme = "light".to_string();
        settings.overlay_opacity = 40;
        settings.commands.skip = false;
        settings.save(&path).unwrap();

        let loaded = ChatSettings::load(&path);
        assert_eq!(loaded, settings);
        std::fs::remove_file(&path).ok();

        // Битый файл не роняет приложение: значения по умолчанию.
        std::fs::write(&path, "{ это не json").unwrap();
        assert_eq!(ChatSettings::load(&path), ChatSettings::default());
        std::fs::remove_file(&path).ok();

        // Нет файла — тоже значения по умолчанию.
        assert_eq!(ChatSettings::load(&path), ChatSettings::default());
    }

    #[test]
    fn patch_clamps_overlay_values() {
        let mut settings = ChatSettings::default();
        settings.apply_patch(&ChatSettingsPatch {
            overlay_seconds: Some(10_000),
            overlay_font: Some(2),
            overlay_theme: Some("СВЕТЛАЯ".to_string()),
            overlay_opacity: Some(500),
            ..ChatSettingsPatch::default()
        });
        assert_eq!(settings.overlay_seconds, 3600);
        assert_eq!(settings.overlay_font, 10);
        assert_eq!(settings.overlay_theme, "dark");
        assert_eq!(settings.overlay_opacity, 100);

        settings.apply_patch(&ChatSettingsPatch {
            overlay_theme: Some("light".to_string()),
            overlay_font: Some(30),
            commands: Some(ChatCommandsPatch {
                sound: Some(false),
                ..ChatCommandsPatch::default()
            }),
            ..ChatSettingsPatch::default()
        });
        assert_eq!(settings.overlay_theme, "light");
        assert_eq!(settings.overlay_font, 30);
        assert!(!settings.commands.sound);
        assert!(settings.commands.queue);
    }

    #[test]
    fn command_allowed_reflects_settings() {
        let mut settings = ChatSettings::default();
        assert!(ChatCommand::Queue.allowed(&settings));
        settings.commands.queue = false;
        assert!(!ChatCommand::Queue.allowed(&settings));
        assert!(!ChatCommand::Unknown.allowed(&settings));
    }
}
