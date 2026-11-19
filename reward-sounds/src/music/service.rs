//! Служба треков по заявке.
//!
//! Связывает всё вместе: принимает ссылку из активации награды, проверяет её
//! через `yt-dlp`, ставит в очередь, играет по одной, заранее подгружает
//! следующую и сообщает результат (засчитать баллы или вернуть).
//!
//! Работает в отдельном потоке: проверка ссылки и загрузка аудио занимают
//! несколько секунд, и ни интерфейс, ни EventSub ждать не должны.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use super::links;
use super::player::{Player, PlayerState, DEFAULT_VOLUME};
use super::prefetch::{Prefetch, Prefetched};
use super::queue::{ItemState, Queue, QueueItem, QueueReject};
use super::ytdlp::YtDlp;

/// Настройки, которые служба получает из приложения.
#[derive(Debug, Clone)]
pub struct Config {
    pub enabled: bool,
    pub reward_id: String,
    pub max_queue: usize,
    pub max_duration_sec: u64,
    pub volume: f32,
    /// Ставить Яндекс Музыку на паузу на время заявок и возвращать после.
    pub pause_yandex: bool,
    /// Кулдаун между заявками одного зрителя, секунды.
    pub request_cooldown_sec: u64,
    /// ID видео, запрещённые к заказу.
    pub blocked_videos: Vec<String>,
    /// Включён ли AutoDJ.
    pub autodj: bool,
    /// Перемешивать ли плейлист AutoDJ.
    pub autodj_shuffle: bool,
    /// Прерывать AutoDJ заявкой и возвращаться к нему после очереди.
    pub autodj_interrupt: bool,
    /// Ссылки плейлиста AutoDJ.
    pub autodj_playlist: Vec<String>,
    /// Канал Twitch (нужен для чтения команды из чата).
    pub channel: String,
    /// Восстанавливать очередь после перезапуска.
    pub restore_queue: bool,
    /// Сколько секунд показывать строку в оверлее.
    pub overlay_seconds: u64,
    /// `top` или `bottom`.
    pub overlay_position: String,
    pub overlay_font: u32,
    /// cookies.txt для YouTube (возрастные ограничения).
    pub cookies_file: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            enabled: true,
            reward_id: String::new(),
            max_queue: 10,
            max_duration_sec: 480,
            volume: DEFAULT_VOLUME,
            pause_yandex: true,
            channel: String::new(),
            restore_queue: true,
            overlay_seconds: 10,
            overlay_position: "top".to_string(),
            overlay_font: 17,
            cookies_file: String::new(),
            request_cooldown_sec: 0,
            blocked_videos: Vec::new(),
            autodj: false,
            autodj_shuffle: false,
            autodj_interrupt: true,
            autodj_playlist: Vec::new(),
        }
    }
}

/// Состояние службы для интерфейса.
#[derive(Debug, Clone, Default)]
pub struct Snapshot {
    pub enabled: bool,
    /// Очередь целиком, включая историю последних заявок.
    pub items: Vec<QueueItem>,
    pub player: PlayerState,
    /// Заявка, которая играет или готовится прямо сейчас.
    pub current: Option<QueueItem>,
    /// AutoDJ сейчас активен (включён кнопкой Play).
    pub autodj_active: bool,
    /// Какой трек уже лежит в памяти и ждёт очереди.
    pub prefetched: Option<String>,
    pub ytdlp_version: Option<String>,
    /// Где найден `yt-dlp` (для интерфейса и диагностики).
    pub ytdlp_path: Option<String>,
    /// Сколько миллисекунд ещё показывать строку «Сейчас играет».
    pub overlay_ms: u64,
    /// Куда прижимать строку в оверлее.
    pub overlay_position: String,
    /// Размер шрифта оверлея.
    pub overlay_font: u32,
    pub error: Option<String>,
    /// Чат канала подключён: команда `!трек` действительно доступна.
    pub chat_online: bool,
    /// HTTP-оверлей поднялся и слушает порт.
    pub overlay_ready: bool,
}

impl Snapshot {
    /// Сколько заявок ждут своей очереди.
    pub fn pending(&self) -> usize {
        self.items
            .iter()
            .filter(|item| !item.state.is_final())
            .count()
    }

    /// Готова ли служба принимать заявки.
    pub fn ready(&self) -> bool {
        self.enabled && self.ytdlp_version.is_some()
    }
}

/// Что служба сообщает наружу.
#[derive(Debug, Clone)]
pub enum MusicEvent {
    /// Заявка принята и встала в очередь.
    Queued {
        redemption_id: String,
        title: String,
        position: usize,
    },
    /// Трек начал играть.
    Started {
        redemption_id: String,
        title: String,
    },
    /// Трек доиграл до конца — баллы остаются списанными.
    Finished { redemption_id: String },
    /// Заявка не принята — баллы нужно вернуть.
    Rejected { redemption_id: String, reason: String },
    /// Ошибка воспроизведения — баллы нужно вернуть.
    Failed {
        redemption_id: String,
        reason: String,
    },
    /// Стример пропустил трек.
    Skipped {
        redemption_id: String,
        reason: String,
    },
}

pub(super) enum Cmd {
    /// Команда из чата: показать строку «Сейчас играет» ещё раз.
    ChatCommand,
    /// Поставить уже сыгранный трек в очередь снова.
    Replay(String),
    Configure(Box<Config>),
    Request {
        redemption_id: String,
        user_login: String,
        user_input: String,
        redeemed_at: String,
    },
    /// Ручная заявка из интерфейса: без активации на Twitch и без баллов.
    Manual {
        user_input: String,
    },
    Skip(String),
    /// Перейти к следующему треку: текущий считается отработанным (без возврата баллов).
    Next,
    UndoSkip,
    StartAutoDj,
    StopAutoDj,
    AutoDjTrack { url: String },
    Retry(String),
    ClearQueue,
    RemoveItem(String),
    MoveUp(String),
    Seek(u64),
    Recheck,
    SetPaused(bool),
    SetVolume(f32),
    /// Состояние подключения к чату (true — читаем сообщения).
    ChatState(bool),
    Validated(Result<QueueItem, (String, String)>),
    AudioReady {
        video_id: String,
        bytes: Vec<u8>,
    },
    AudioFailed {
        video_id: String,
        message: String,
    },
}

/// Служба треков по заявке.
pub struct MusicService {
    tx: Sender<Cmd>,
    events: Receiver<MusicEvent>,
    state: Arc<Mutex<Snapshot>>,
}

impl MusicService {
    /// Запускает службу. `ytdlp_path` — путь к `yt-dlp.exe` (`auto` — искать самому).
    pub fn spawn(
        config: Config,
        ytdlp_path: String,
        temp_dir: PathBuf,
        data_dir: PathBuf,
    ) -> Self {
        let (tx, rx) = mpsc::channel();
        let (event_tx, event_rx) = mpsc::channel();
        let state = Arc::new(Mutex::new(Snapshot {
            enabled: config.enabled,
            ..Snapshot::default()
        }));

        let inner_tx = tx.clone();
        let thread_state = Arc::clone(&state);
        // Оверлей для OBS читает то же состояние, что и интерфейс.
        super::overlay::spawn(Arc::clone(&state), super::overlay::PORT);
        let spawned = thread::Builder::new()
            .name("reward-sounds-music-service".to_string())
            .spawn(move || run(config, ytdlp_path, temp_dir, data_dir, rx, inner_tx, thread_state, event_tx));

        if let Err(err) = spawned {
            log::error!("Не удалось запустить службу музыки: {err}");
            if let Ok(mut state) = state.lock() {
                state.error = Some("Не удалось запустить службу музыки".to_string());
            }
        }

        Self {
            tx,
            events: event_rx,
            state,
        }
    }

    /// Обновляет настройки: лимиты, громкость, включено/выключено.
    pub fn configure(&self, config: Config) {
        let _ = self.tx.send(Cmd::Configure(Box::new(config)));
    }

    /// Принимает активацию награды: ссылка разбирается и проверяется внутри.
    pub fn request(
        &self,
        redemption_id: &str,
        user_login: &str,
        user_input: &str,
        redeemed_at: &str,
    ) {
        let _ = self.tx.send(Cmd::Request {
            redemption_id: redemption_id.to_string(),
            user_login: user_login.to_string(),
            user_input: user_input.to_string(),
            redeemed_at: redeemed_at.to_string(),
        });
    }

    /// Ручная заявка из интерфейса: проверить ссылку и поставить в очередь
    /// без активации награды (для проверки музыки и тестов).
    pub fn add_manual(&self, url: &str) {
        let _ = self.tx.send(Cmd::Manual {
            user_input: url.to_string(),
        });
    }

    /// Показать строку «Сейчас играет» в оверлее ещё раз.
    pub fn show_overlay(&self) {
        let _ = self.tx.send(Cmd::ChatCommand);
    }

    pub fn skip(&self, reason: impl Into<String>) {
        let _ = self.tx.send(Cmd::Skip(reason.into()));
    }

    /// Закрывает текущий трек как отработанный и включает следующий.
    pub fn next(&self) {
        let _ = self.tx.send(Cmd::Next);
    }

    /// Возвращает последнюю пропущенную заявку в начало очереди.
    pub fn undo_skip(&self) {
        let _ = self.tx.send(Cmd::UndoSkip);
    }

    /// Запускает AutoDJ (плейлист заполняется только после явной команды Play).
    pub fn start_autodj(&self) {
        let _ = self.tx.send(Cmd::StartAutoDj);
    }

    /// Останавливает AutoDJ и убирает его текущий/ожидающий трек.
    pub fn stop_autodj(&self) {
        let _ = self.tx.send(Cmd::StopAutoDj);
    }

    /// Повторяет упавшую заявку.
    pub fn retry(&self, redemption_id: &str) {
        let _ = self.tx.send(Cmd::Retry(redemption_id.to_string()));
    }

    pub fn clear_queue(&self) {
        let _ = self.tx.send(Cmd::ClearQueue);
    }

    pub fn remove_item(&self, redemption_id: &str) {
        let _ = self.tx.send(Cmd::RemoveItem(redemption_id.to_string()));
    }

    /// Ставит уже сыгранный трек в очередь снова.
    pub fn replay(&self, redemption_id: &str) {
        let _ = self.tx.send(Cmd::Replay(redemption_id.to_string()));
    }

    /// Поднимает заявку на позицию выше.
    pub fn move_up(&self, redemption_id: &str) {
        let _ = self.tx.send(Cmd::MoveUp(redemption_id.to_string()));
    }

    /// Перемотка текущего трека на указанную секунду.
    pub fn seek(&self, sec: u64) {
        let _ = self.tx.send(Cmd::Seek(sec));
    }

    /// Повторно ищет `yt-dlp` (например, если его только что положили рядом).
    pub fn recheck(&self) {
        let _ = self.tx.send(Cmd::Recheck);
    }

    pub fn set_paused(&self, paused: bool) {
        let _ = self.tx.send(Cmd::SetPaused(paused));
    }

    pub fn set_volume(&self, volume: f32) {
        let _ = self.tx.send(Cmd::SetVolume(volume));
    }

    /// Забирает накопившиеся события (не блокируясь).
    pub fn poll_events(&self) -> Vec<MusicEvent> {
        self.events.try_iter().collect()
    }

    pub fn snapshot(&self) -> Snapshot {
        self.state
            .lock()
            .map(|state| state.clone())
            .unwrap_or_default()
    }
}

impl Drop for MusicService {
    fn drop(&mut self) {
        let (tx, _rx) = mpsc::channel();
        let _ = std::mem::replace(&mut self.tx, tx);
    }
}

fn is_autodj_item(item: &QueueItem) -> bool {
    item.redemption_id.starts_with("autodj-")
}

fn request_is_waiting(queue: &Queue) -> bool {
    queue
        .items()
        .iter()
        .any(|item| item.state == ItemState::Queued && !is_autodj_item(item))
}

fn run(
    mut config: Config,
    ytdlp_path: String,
    temp_dir: PathBuf,
    data_dir: PathBuf,
    rx: Receiver<Cmd>,
    tx: Sender<Cmd>,
    state: Arc<Mutex<Snapshot>>,
    events: Sender<MusicEvent>,
) {
    let player = Player::spawn(config.volume);
    let mut queue = Queue::new(config.max_queue, config.max_duration_sec);
    let mut prefetch = Prefetch::new();
    let mut current: Option<QueueItem> = None;
    let mut last_skipped: Option<QueueItem> = None;
    let mut last_request: HashMap<String, Instant> = HashMap::new();
    let mut loading: HashSet<String> = HashSet::new();
    /// Яндекс Музыка была поставлена на паузу нами — её нужно вернуть.
    let mut yandex_paused = false;
    /// До какого момента показывать строку «Сейчас играет» в оверлее.
    let mut overlay_until: Option<std::time::Instant> = None;
    /// Показывать оверлей всё время, пока играет текущий трек (настройка 0).
    let mut overlay_forever = false;
    /// Какой трек сейчас ждёт свою загрузку (чтобы не спутать с предзагрузкой).
    let mut awaiting_start: Option<String> = None;
    /// Заявки, которые уже проверяются (метаданные ещё грузятся).
    let mut validating: HashSet<String> = HashSet::new();
    /// Когда мы отдали плееру текущий трек.
    let mut track_started_at: Option<std::time::Instant> = None;
    /// Номер трека в плеере на момент запуска: помогает отличить
    /// свежее состояние от «хвоста» предыдущего трека.
    let mut start_generation: u64 = 0;
    /// Видели ли, что текущий трек действительно играет (позиция внутри).
    let mut seen_running = false;
    /// Подключён ли читатель чата (команда `!трек` реально доступна).
    let mut chat_online = false;
    /// AutoDJ включается только после кнопки Play; дальше работает в сервисе.
    let mut autodj_armed = false;
    let mut autodj_index = 0usize;
    let mut last_autodj_index: Option<usize> = None;
    let mut last_autodj_at: Option<Instant> = None;
    let mut autodj_bytes: Option<Vec<u8>> = None;
    /// (заявка AutoDJ, байты, позиция) — пауза перед заявкой зрителя.
    let mut autodj_resume: Option<(QueueItem, Vec<u8>, u64)> = None;

    let data_dir = data_dir;
    let queue_file = data_dir.join("queue.json");
    // Старые версии хранили очередь в системном TEMP. Переносим её один раз.
    let legacy_queue = temp_dir
        .parent()
        .map(|path| path.join("queue.json"))
        .unwrap_or_else(|| temp_dir.join("queue.json"));
    if !queue_file.exists() && legacy_queue.is_file() {
        if std::fs::copy(&legacy_queue, &queue_file).is_ok() {
            log::info!("Музыка: очередь перенесена из TEMP в папку настроек");
        }
    }
    if config.restore_queue {
        let mut restored = Queue::load(&queue_file);
        restored.set_limits(config.max_queue, config.max_duration_sec);
        let pending = restored.pending();
        if pending > 0 {
            log::info!("Музыка: восстановлена очередь заявок ({pending})");
        }
        queue = restored;
    }
    let mut exe = YtDlp::locate(&ytdlp_path, &data_dir);
    let mut version = exe
        .as_ref()
        .and_then(|path| YtDlp::new(path.clone(), temp_dir.clone()).version());
    log_ytdlp(&version, &exe);
    let mut chat_channel = config.channel.clone();
    super::chat::spawn(&chat_channel, tx.clone());
    // Старые распакованные каталоги PyInstaller от yt-dlp копятся в TEMP
    // после таймаутов: чистим их при старте службы.
    super::ytdlp::cleanup_stale_temp_dirs(&temp_dir);

    loop {
        // 1. Команды.
        match rx.recv_timeout(Duration::from_millis(200)) {
            Ok(Cmd::Configure(new_config)) => {
                config = *new_config;
                queue.set_limits(config.max_queue, config.max_duration_sec);
                player.set_volume(config.volume).ok();
                // Twitch могли подключить уже после старта — тогда канал
                // появился только сейчас, и команда !трек должна заработать.
                if config.channel != chat_channel && !config.channel.trim().is_empty() {
                    chat_channel = config.channel.clone();
                    super::chat::spawn(&chat_channel, tx.clone());
                }
            }
            Ok(Cmd::Request {
                redemption_id,
                user_login,
                user_input,
                redeemed_at,
            }) => {
                // Twitch может прислать одно и то же событие повторно
                // (переподключение EventSub). Без этого заявка попадала
                // в очередь дважды и трек обрывался.
                let duplicate = validating.contains(&redemption_id)
                    || current
                        .as_ref()
                        .map(|item| item.redemption_id == redemption_id)
                        .unwrap_or(false)
                    || queue
                        .items()
                        .iter()
                        .any(|item| item.redemption_id == redemption_id);

                if duplicate {
                    log::warn!("Музыка: повторная заявка {redemption_id} проигнорирована");
                } else if !config.enabled {
                    reject(&events, redemption_id, "Вкладка «Музыка» выключена".into());
                } else if version.is_none() {
                    reject(&events, redemption_id, "yt-dlp не найден".into());
                } else if !queue.has_room() {
                    reject(&events, redemption_id, QueueReject::Full.message());
                } else {
                    match links::parse(&user_input) {
                        Ok(link) => {
                            if config.blocked_videos.iter().any(|id| id == &link.video_id) {
                                reject(&events, redemption_id, "Это видео в блок-листе канала".into());
                            } else {
                                let cooldown = config.request_cooldown_sec;
                                let cooling = cooldown > 0
                                    && last_request
                                        .get(&user_login)
                                        .map(|at| at.elapsed().as_secs() < cooldown)
                                        .unwrap_or(false);
                                if cooling {
                                    reject(
                                        &events,
                                        redemption_id,
                                        format!("Кулдаун: следующую заявку можно через {cooldown} с"),
                                    );
                                } else {
                                    if cooldown > 0 {
                                        last_request.insert(user_login.clone(), Instant::now());
                                    }
                                    let item = QueueItem::new(
                                        redemption_id.clone(),
                                        &link.video_id,
                                        &link.url,
                                        user_login,
                                        redeemed_at,
                                    );
                                    if let Some(exe) = exe.clone() {
                                        validating.insert(redemption_id.clone());
                                        spawn_validate(exe, temp_dir.clone(), config.cookies_file.clone(), item, tx.clone());
                                    }
                                }
                            }
                        }
                        Err(err) => reject(&events, redemption_id, err.message()),
                    }
                }
            }
            Ok(Cmd::Manual { user_input }) => {
                if !config.enabled {
                    log::warn!("Музыка: ручная заявка при выключенной вкладке");
                } else if version.is_none() {
                    log::warn!("Музыка: ручная заявка без yt-dlp");
                } else if !queue.has_room() {
                    log::warn!("Музыка: ручная заявка не влезла — очередь заполнена");
                } else {
                    match links::parse(&user_input) {
                        Ok(link) => {
                            if config.blocked_videos.iter().any(|id| id == &link.video_id) {
                                log::warn!("Музыка: ручная ссылка {} в блок-листе", link.video_id);
                            } else {
                                let stamp = std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .map(|d| d.as_millis())
                                    .unwrap_or(0);
                                let item = QueueItem::new(
                                    format!("manual-{stamp}"),
                                    &link.video_id,
                                    &link.url,
                                    "manual",
                                    stamp.to_string(),
                                );
                                if let Some(exe) = exe.clone() {
                                    validating.insert(item.redemption_id.clone());
                                    spawn_validate(exe, temp_dir.clone(), config.cookies_file.clone(), item, tx.clone());
                                }
                            }
                        }
                        Err(err) => log::warn!("Музыка: ручная ссылка не разобрана — {}", err.message()),
                    }
                }
            }
            Ok(Cmd::Validated(Ok(item))) => {
                let redemption_id = item.redemption_id.clone();
                validating.remove(&redemption_id);
                if redemption_id.starts_with("autodj-") && !autodj_armed {
                    continue;
                }
                let title = item.label();
                match queue.push(item) {
                    Ok(()) => {
                        let position = queue.pending();
                        log::info!("Музыка: заявка {redemption_id} «{title}» в очереди, позиция {position}");
                        let _ = events.send(MusicEvent::Queued {
                            redemption_id,
                            title,
                            position,
                        });
                    }
                    Err(reject_reason) => {
                        reject(&events, redemption_id, reject_reason.message());
                    }
                }
            }
            Ok(Cmd::Validated(Err((redemption_id, reason)))) => {
                validating.remove(&redemption_id);
                reject(&events, redemption_id, reason);
            }
            Ok(Cmd::AudioReady { video_id, bytes }) => {
                loading.remove(&video_id);
                // Загрузка могла быть как для стартующего трека, так и для
                // предзагрузки. Одинаковые video_id у двух заявок — обычное дело,
                // поэтому различаем их по флагу, а не по совпадению идентификатора.
                if awaiting_start.as_deref() == Some(video_id.as_str()) {
                    awaiting_start = None;
                    if let Some(item) = current.as_ref().filter(|item| item.video_id == video_id) {
                        track_started_at = Some(std::time::Instant::now());
                        start_generation = player.state().generation;
                        seen_running = false;
                        if is_autodj_item(item) {
                            autodj_bytes = Some(bytes.clone());
                        } else {
                            autodj_bytes = None;
                        }
                        if let Err(err) = player.play(bytes, item.duration_sec) {
                            log::error!("Музыка: плеер не запустился: {err}");
                            queue.fail(&item.redemption_id, err.clone());
                            let _ = events.send(MusicEvent::Failed {
                                redemption_id: item.redemption_id.clone(),
                                reason: err,
                            });
                            current = None;
                        }
                    }
                } else {
                    prefetch.store(Prefetched {
                        video_id,
                        bytes,
                        duration_sec: 0,
                    });
                }
            }
            Ok(Cmd::AudioFailed { video_id, message }) => {
                loading.remove(&video_id);
                if awaiting_start.as_deref() == Some(video_id.as_str()) {
                    awaiting_start = None;
                    if let Some(item) = current.as_ref().filter(|item| item.video_id == video_id) {
                    log::warn!("Музыка: не удалось загрузить {}: {message}", item.video_id);
                    queue.fail(&item.redemption_id, message.clone());
                    let _ = events.send(MusicEvent::Failed {
                        redemption_id: item.redemption_id.clone(),
                        reason: message,
                    });
                    current = None;
                }
                }
            }
            Ok(Cmd::Next) => {
                if current.as_ref().is_some_and(is_autodj_item) {
                    if let Some(item) = current.take() {
                        player.stop().ok();
                        queue.remove(&item.redemption_id);
                        autodj_bytes = None;
                    }
                    continue;
                }
                if let Some(item) = current.take() {
                    awaiting_start = None;
                    player.stop().ok();
                    queue.complete(&item.redemption_id, ItemState::Done);
                    let _ = events.send(MusicEvent::Finished {
                        redemption_id: item.redemption_id,
                    });
                    persist_queue(&queue, &queue_file, config.restore_queue);
                }
            }
            Ok(Cmd::Skip(reason)) => {
                if current.as_ref().is_some_and(is_autodj_item) {
                    if let Some(item) = current.take() {
                        player.stop().ok();
                        queue.remove(&item.redemption_id);
                        autodj_bytes = None;
                    }
                    continue;
                }
                if let Some(item) = current.take() {
                    awaiting_start = None;
                    player.stop().ok();
                    queue.complete(&item.redemption_id, ItemState::Skipped);
                    last_skipped = Some(item.clone());
                    let _ = events.send(MusicEvent::Skipped {
                        redemption_id: item.redemption_id,
                        reason,
                    });
                    persist_queue(&queue, &queue_file, config.restore_queue);
                    if autodj_armed {
                        last_autodj_at = None;
                    }
                }
            }
            Ok(Cmd::UndoSkip) => {
                if let Some(item) = last_skipped.take() {
                    if queue.requeue_front(&item.redemption_id) {
                        log::info!("Музыка: пропуск отменён — «{}» возвращён", item.label());
                        persist_queue(&queue, &queue_file, config.restore_queue);
                    }
                }
            }
            Ok(Cmd::StartAutoDj) => {
                autodj_armed = true;
                last_autodj_at = None;
                log::info!("Музыка: AutoDJ включён кнопкой Play");
            }
            Ok(Cmd::StopAutoDj) => {
                autodj_armed = false;
                last_autodj_at = None;
                autodj_bytes = None;
                autodj_resume = None;
                if let Some(item) = current.take() {
                    if is_autodj_item(&item) {
                        awaiting_start = None;
                        player.stop().ok();
                        queue.remove(&item.redemption_id);
                    } else {
                        current = Some(item);
                    }
                }
                let autodj_items: Vec<String> = queue
                    .items()
                    .iter()
                    .filter(|item| item.redemption_id.starts_with("autodj-"))
                    .map(|item| item.redemption_id.clone())
                    .collect();
                for redemption_id in autodj_items {
                    queue.remove(&redemption_id);
                }
                persist_queue(&queue, &queue_file, config.restore_queue);
                log::info!("Музыка: AutoDJ остановлен");
            }
            Ok(Cmd::AutoDjTrack { url }) => {
                if !autodj_armed {
                    continue;
                }
                if !config.enabled || version.is_none() || !queue.has_room() {
                    continue;
                }
                match links::parse(&url) {
                    Ok(link) => {
                        let stamp = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .map(|value| value.as_millis())
                            .unwrap_or(0);
                        let item = QueueItem::new(
                            format!("autodj-{stamp}"),
                            &link.video_id,
                            &link.url,
                            "AutoDJ",
                            stamp.to_string(),
                        );
                        if let Some(exe) = exe.clone() {
                            validating.insert(item.redemption_id.clone());
                            spawn_validate(exe, temp_dir.clone(), config.cookies_file.clone(), item, tx.clone());
                        }
                    }
                    Err(err) => log::warn!("AutoDJ: ссылка не разобрана — {}", err.message()),
                }
            }
            Ok(Cmd::Retry(redemption_id)) => {
                if queue.retry_failed(&redemption_id) {
                    log::info!("Музыка: заявка {redemption_id} возвращена в очередь");
                    persist_queue(&queue, &queue_file, config.restore_queue);
                }
            }
            Ok(Cmd::ClearQueue) => {
                let removed: Vec<String> = queue
                    .items()
                    .iter()
                    .filter(|item| item.state == ItemState::Queued)
                    .map(|item| item.redemption_id.clone())
                    .collect();
                for redemption_id in removed {
                    queue.remove(&redemption_id);
                    // Баллы за удалённые заявки возвращаем: CANCELED в Twitch.
                    let _ = events.send(MusicEvent::Skipped {
                        redemption_id,
                        reason: "очередь очищена".to_string(),
                    });
                }
                prefetch.clear();
                persist_queue(&queue, &queue_file, config.restore_queue);
            }
            Ok(Cmd::RemoveItem(redemption_id)) => {                if current
                    .as_ref()
                    .map(|item| item.redemption_id == redemption_id)
                    .unwrap_or(false)
                {
                    if let Some(item) = current.take() {
                        awaiting_start = None;
                        player.stop().ok();
                        queue.complete(&item.redemption_id, ItemState::Skipped);
                        let _ = events.send(MusicEvent::Skipped {
                            redemption_id: item.redemption_id,
                            reason: "трек убран из очереди".to_string(),
                        });
                    }
                } else {
                    queue.remove(&redemption_id);
                    // Вернуть баллы и за удалённую из очереди заявку.
                    let _ = events.send(MusicEvent::Skipped {
                        redemption_id,
                        reason: "трек убран из очереди".to_string(),
                    });
                }
                persist_queue(&queue, &queue_file, config.restore_queue);
            }
            Ok(Cmd::MoveUp(redemption_id)) => {
                if queue.move_up(&redemption_id) {
                    persist_queue(&queue, &queue_file, config.restore_queue);
                }
            }
            Ok(Cmd::Seek(sec)) => {
                player.seek(sec).ok();
            }
            Ok(Cmd::Recheck) => {
                exe = YtDlp::locate(&ytdlp_path, &data_dir);
                version = exe
                    .as_ref()
                    .and_then(|path| YtDlp::new(path.clone(), temp_dir.clone()).version());
                log_ytdlp(&version, &exe);
            }
            Ok(Cmd::SetPaused(paused)) => {
                if paused {
                    player.pause().ok();
                } else {
                    player.resume().ok();
                }
            }
            Ok(Cmd::SetVolume(volume)) => {
                config.volume = volume.clamp(0.0, 1.0);
                player.set_volume(config.volume).ok();
            }
            Ok(Cmd::ChatCommand) => {
                // Зритель или стример попросил показать трек ещё раз.
                if config.overlay_seconds == 0 {
                    overlay_forever = true;
                    overlay_until = None;
                } else {
                    overlay_forever = false;
                    overlay_until = Some(
                        std::time::Instant::now()
                            + std::time::Duration::from_secs(config.overlay_seconds.max(1)),
                    );
                }
            }
            Ok(Cmd::ChatState(online)) => {
                chat_online = online;
            }
            Ok(Cmd::Replay(redemption_id)) => {
                if let Some(item) = queue
                    .items()
                    .iter()
                    .find(|item| item.redemption_id == redemption_id)
                    .cloned()
                {
                    let stamp = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_millis())
                        .unwrap_or(0);
                    let mut copy = item;
                    copy.redemption_id = format!("{redemption_id}-replay-{stamp}");
                    copy.state = ItemState::Queued;
                    copy.attempts = 0;
                    copy.error = None;
                    let _ = queue.push(copy);
                    persist_queue(&queue, &queue_file, config.restore_queue);
                }
            }
            Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) => break,
        }

        // 2. Конец текущего трека.
        if let Some(item) = current.clone() {
            let player_state = player.state();
            // Завершение считаем ТОЛЬКО по своим часам: время, прошедшее
            // с момента передачи трека плееру. Состояние плеера для этого
            // не годится — во время декодирования там ещё живёт прошлый трек.
            // Позиция от прошлого трека может быть больше длительности нового.
            // Пока не увидели позицию ВНУТРИ трека, конец не засчитываем.
            if player_state.position_sec > 0
                && player_state.position_sec + 2 < item.duration_sec
            {
                seen_running = true;
            }

            let reached_end = seen_running
                && item.duration_sec > 0
                && player_state.position_sec + 2 >= item.duration_sec;

            if reached_end {
                log::info!(
                    "Музыка: «{}» сыгран: длительность {} с, позиция плеера {} с",
                    item.label(),
                    item.duration_sec,
                    player_state.position_sec
                );
                queue.complete(&item.redemption_id, ItemState::Done);
                persist_queue(&queue, &queue_file, config.restore_queue);
                // Сбрасываем плеер: ползунок не должен оставаться на прошлом треке.
                player.stop().ok();
                seen_running = false;
                let _ = events.send(MusicEvent::Finished {
                    redemption_id: item.redemption_id.clone(),
                });
                if is_autodj_item(&item) {
                    autodj_bytes = None;
                }
                current = None;
                if autodj_armed {
                    last_autodj_at = None;
                }
            } else if let Some(error) = player_state.error.clone() {
                queue.fail(&item.redemption_id, error.clone());
                persist_queue(&queue, &queue_file, config.restore_queue);
                player.stop().ok();
                seen_running = false;
                let _ = events.send(MusicEvent::Failed {
                    redemption_id: item.redemption_id.clone(),
                    reason: error,
                });
                if is_autodj_item(&item) {
                    autodj_bytes = None;
                }
                current = None;
                if autodj_armed {
                    last_autodj_at = None;
                }
            }
        }

        // 2.5. Заявка зрителя важнее AutoDJ: мягко останавливаем AutoDJ,
        //      сохраняя байты и позицию, чтобы вернуться после очереди.
        if autodj_armed
            && config.autodj_interrupt
            && current.as_ref().is_some_and(is_autodj_item)
            && request_is_waiting(&queue)
        {
            let position = player.state().position_sec;
            player.stop().ok();
            if let Some(item) = current.take() {
                queue.remove(&item.redemption_id);
                if let Some(bytes) = autodj_bytes.take() {
                    log::info!(
                        "Музыка: AutoDJ приостановлен на {} с ради заявки",
                        position
                    );
                    autodj_resume = Some((item, bytes, position));
                }
            }
        }

        // 3. Старт следующей заявки.
        if current.is_none() && config.enabled {
            if let Some(item) = queue.take_next() {
                let redemption_id = item.redemption_id.clone();
                let title = item.label();
                log::info!("Музыка: старт «{title}» (@{})", item.user_login);
                let _ = events.send(MusicEvent::Started {
                    redemption_id,
                    title,
                });
                persist_queue(&queue, &queue_file, config.restore_queue);
                // Строка «Сейчас играет» показывается заданное время после старта.
                // 0 — показывать всё время, пока играет трек.
                if config.overlay_seconds == 0 {
                    overlay_forever = true;
                    overlay_until = None;
                } else {
                    overlay_forever = false;
                    overlay_until = Some(
                        std::time::Instant::now()
                            + std::time::Duration::from_secs(config.overlay_seconds.max(1)),
                    );
                }
                // Заказанный трек важнее: ставим Яндекс Музыку на паузу один раз
                // на всю серию заявок (а не между треками, чтобы её не дёргать).
                if config.pause_yandex && !yandex_paused {
                    if crate::music::yandex::is_playing() == Some(true)
                        && crate::music::yandex::pause()
                    {
                        yandex_paused = true;
                        log::info!("Музыка: Яндекс Музыка поставлена на паузу");
                    }
                }

                match prefetch.take(&item.video_id) {
                    Some(ready) => {
                        awaiting_start = None;
                        track_started_at = Some(std::time::Instant::now());
                        start_generation = player.state().generation;
                        seen_running = false;
                        if is_autodj_item(&item) {
                            autodj_bytes = Some(ready.bytes.clone());
                        } else {
                            autodj_bytes = None;
                        }
                        if let Err(err) = player.play(ready.bytes, item.duration_sec) {
                            log::error!("Музыка: плеер не запустился: {err}");
                            queue.fail(&item.redemption_id, err.clone());
                            let _ = events.send(MusicEvent::Failed {
                                redemption_id: item.redemption_id.clone(),
                                reason: err,
                            });
                        } else {
                            current = Some(item);
                        }
                    }
                    None => {
                        if let Some(exe) = exe.clone() {
                            awaiting_start = Some(item.video_id.clone());
                            loading.insert(item.video_id.clone());
                            if !is_autodj_item(&item) {
                                autodj_bytes = None;
                            }
                            spawn_download(
                                exe,
                                temp_dir.clone(),
                                config.cookies_file.clone(),
                                item.video_id.clone(),
                                item.url.clone(),
                                tx.clone(),
                            );
                            current = Some(item);
                        } else {
                            queue.fail(&item.redemption_id, "yt-dlp не найден");
                        }
                    }
                }
            }
        }

        // 3.4. Очередь зрителей пуста — возвращаем AutoDJ с того же места.
        if current.is_none() && autodj_resume.is_some() && !request_is_waiting(&queue) {
            let (item, bytes, position) = autodj_resume.take().expect("resume есть");
            if !bytes.is_empty() {
                player.set_volume(config.volume).ok();
                match player.play(bytes.clone(), item.duration_sec) {
                    Ok(()) => {
                        player.seek(position).ok();
                        current = Some(item);
                        autodj_bytes = Some(bytes);
                        log::info!("Музыка: AutoDJ продолжен с {} с", position);
                    }
                    Err(err) => {
                        log::warn!("Музыка: не удалось вернуть AutoDJ: {err}");
                    }
                }
            }
        }

        // 3.5. AutoDJ: очередь пуста, плеер свободен — берём следующий URL.
        //      Запускается только после Cmd::StartAutoDj (кнопка Play).
        if autodj_armed
            && config.enabled
            && config.autodj
            && !config.autodj_playlist.is_empty()
            && current.is_none()
            && queue.pending() == 0
            && validating.is_empty()
            && last_autodj_at
                .map(|at| at.elapsed() >= std::time::Duration::from_secs(6))
                .unwrap_or(true)
        {
            let playlist: Vec<&String> = config
                .autodj_playlist
                .iter()
                .filter(|url| !url.trim().is_empty())
                .collect();
            if !playlist.is_empty() {
                let index = if config.autodj_shuffle {
                    let nanos = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|value| value.as_nanos() as usize)
                        .unwrap_or(0);
                    let mut index = nanos % playlist.len();
                    if playlist.len() > 1 && Some(index) == last_autodj_index {
                        index = (index + 1) % playlist.len();
                    }
                    index
                } else {
                    autodj_index % playlist.len()
                };
                let url = playlist[index].clone();
                last_autodj_index = Some(index);
                autodj_index = index + 1;
                last_autodj_at = Some(Instant::now());
                log::info!("Музыка: AutoDJ ставит следующий трек");
                let _ = tx.send(Cmd::AutoDjTrack { url });
            }
        }

        // 4. Предзагрузка следующей заявки, пока играет текущая.
        if current.is_some() && config.enabled && prefetch.ready_video().is_none() {
            if let Some(exe) = exe.clone() {
                if let Some(next) = queue
                    .items()
                    .iter()
                    .find(|item| item.state == ItemState::Queued)
                    .filter(|item| !loading.contains(&item.video_id))
                {
                    loading.insert(next.video_id.clone());
                    log::info!("Музыка: предзагрузка «{}»", next.label());
                    spawn_download(
                        exe,
                        temp_dir.clone(),
                        config.cookies_file.clone(),
                        next.video_id.clone(),
                        next.url.clone(),
                        tx.clone(),
                    );
                }
            }
        }

        // 5. Очередь опустела — возвращаем Яндекс Музыку как было.
        if yandex_paused && current.is_none() && queue.pending() == 0 {
            if crate::music::yandex::resume() {
                log::info!("Музыка: Яндекс Музыка продолжает играть");
            }
            yandex_paused = false;
        }

        // 6. Состояние для интерфейса.
        if let Ok(mut snapshot) = state.lock() {
            snapshot.enabled = config.enabled;
            snapshot.items = queue.items().to_vec();
            snapshot.player = player.state();
            snapshot.current = current.clone();
            snapshot.autodj_active = autodj_armed;
            snapshot.prefetched = prefetch.ready_video().map(str::to_string);
            snapshot.ytdlp_version = version.clone();
            snapshot.ytdlp_path = exe.as_ref().map(|path| path.display().to_string());
            snapshot.overlay_ms = if overlay_forever && current.is_some() {
                u64::MAX
            } else {
                overlay_until
                    .map(|until| {
                        until
                            .saturating_duration_since(std::time::Instant::now())
                            .as_millis() as u64
                    })
                    .unwrap_or(0)
            };
            snapshot.overlay_position = config.overlay_position.clone();
            snapshot.overlay_font = config.overlay_font;
            snapshot.chat_online = chat_online;
            snapshot.error = if version.is_none() {
                Some("yt-dlp не найден: положите yt-dlp.exe рядом с программой".to_string())
            } else {
                None
            };
        }
    }

    persist_queue(&queue, &queue_file, config.restore_queue);
    player.stop().ok();
    log::info!("Музыка: служба остановлена");
}

/// Сохраняет очередь на диск (если восстановление включено).
fn persist_queue(queue: &Queue, path: &Path, enabled: bool) {
    if !enabled {
        return;
    }
    if let Err(err) = queue.save(path) {
        log::warn!("Музыка: не удалось сохранить очередь: {err}");
    }
}

/// Пишет в журнал, найден ли `yt-dlp`.
fn log_ytdlp(version: &Option<String>, exe: &Option<PathBuf>) {
    match (version, exe) {
        (Some(version), Some(path)) => {
            log::info!("Музыка: yt-dlp {version} ({})", path.display())
        }
        _ => log::error!("Музыка: yt-dlp не найден — заявки приниматься не будут"),
    }
}

fn reject(events: &Sender<MusicEvent>, redemption_id: String, reason: String) {    log::info!("Музыка: заявка {redemption_id} отклонена — {reason}");
    let _ = events.send(MusicEvent::Rejected {
        redemption_id,
        reason,
    });
}

/// Проверка ссылки в отдельном потоке: метаданные занимают секунды.
fn spawn_validate(exe: PathBuf, temp_dir: PathBuf, cookies: String, item: QueueItem, tx: Sender<Cmd>) {
    let spawned = thread::Builder::new()
        .name("music-validate".to_string())
        .spawn(move || {
            let cookies = (!cookies.trim().is_empty()).then(|| PathBuf::from(cookies.trim()));
            let tool = YtDlp::new(&exe, &temp_dir).with_cookies(cookies);
            let redemption_id = item.redemption_id.clone();

            match tool.probe(&item.url) {
                Ok(meta) if meta.is_live => {
                    let _ = tx.send(Cmd::Validated(Err((
                        redemption_id,
                        QueueReject::Live.message(),
                    ))));
                }
                Ok(meta) => {
                    let mut item = item;
                    item.apply_meta(&meta);
                    let _ = tx.send(Cmd::Validated(Ok(item)));
                }
                Err(err) => {
                    let _ = tx.send(Cmd::Validated(Err((redemption_id, err.to_string()))));
                }
            }
        });

    if let Err(err) = spawned {
        log::error!("Музыка: не удалось запустить проверку ссылки: {err}");
    }
}

/// Загрузка аудио в память в отдельном потоке.
fn spawn_download(exe: PathBuf, temp_dir: PathBuf, cookies: String, video_id: String, url: String, tx: Sender<Cmd>) {
    let spawned = thread::Builder::new()
        .name("music-download".to_string())
        .spawn(move || {
            let cookies = (!cookies.trim().is_empty()).then(|| PathBuf::from(cookies.trim()));
            let tool = YtDlp::new(&exe, &temp_dir).with_cookies(cookies);
            match tool.download_audio(&url) {
                Ok(bytes) => {
                    let _ = tx.send(Cmd::AudioReady { video_id, bytes });
                }
                Err(err) => {
                    let _ = tx.send(Cmd::AudioFailed {
                        video_id,
                        message: err.to_string(),
                    });
                }
            }
        });

    if let Err(err) = spawned {
        log::error!("Музыка: не удалось запустить загрузку: {err}");
    }
}
