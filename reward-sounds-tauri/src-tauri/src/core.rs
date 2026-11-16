//! Общее состояние Tauri-приложения и команды для UI.
//!
//! Здесь живёт «контроллер» нового интерфейса: настройки, фоновый Twitch-сервис,
//! аудиодвижок и кэш привязок. Команды отдают фронтенду снимок состояния,
//! поэтому React/JS-слою не нужно знать о потоках и токенах.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread;
use std::time::{Duration, Instant};

use reward_sounds::audio;
use reward_sounds::eventsub;
use reward_sounds::playback::{Playback, PlaybackState};
use reward_sounds::config::{AppPaths, Settings};
use reward_sounds::music::{self, ItemState};
use reward_sounds::twitch::{self, RemoteReward};
use reward_sounds::util;
use serde::Serialize;
use tauri::State;

/// Сведения о привязанном аудиофайле.
#[derive(Clone, Serialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub exists: bool,
    /// «MP3 · 0:08»
    pub meta: String,
    pub volume: f64,
}

/// Награда в том виде, в котором её удобно рисовать.
#[derive(Clone, Serialize)]
pub struct RewardView {
    pub id: String,
    pub title: String,
    pub cost: i64,
    pub color: String,
    pub available: bool,
    pub has_sound: bool,
    pub file: Option<FileInfo>,
    pub playing: bool,
}

/// Запись журнала для экрана «Журнал».
#[derive(Clone, Serialize)]
pub struct LogEntryView {
    pub time: String,
    pub level: String,
    pub message: String,
}

/// Состояние входа в Twitch для экрана настроек.
#[derive(Clone, Serialize, Default)]
pub struct AuthView {
    /// idle | waiting | error
    pub state: String,
    pub user_code: Option<String>,
    pub verification_uri: Option<String>,
    pub expires_in: u64,
    pub progress: Option<String>,
    pub error: Option<String>,
}

/// Одна заявка в очереди музыки.
#[derive(Clone, Serialize)]
pub struct MusicItemView {
    pub id: String,
    pub title: String,
    pub user_login: String,
    pub channel: String,
    pub duration_sec: u64,
    pub state: String,
}

/// Плеер музыки.
#[derive(Clone, Serialize)]
pub struct MusicPlayerView {
    pub loaded: bool,
    pub paused: bool,
    pub position_sec: u64,
    pub duration_sec: u64,
    pub error: Option<String>,
}

/// Состояние вкладки «Музыка».
#[derive(Clone, Serialize)]
pub struct MusicView {
    pub enabled: bool,
    pub ready: bool,
    pub ytdlp_version: Option<String>,
    pub ytdlp_path: Option<String>,
    pub error: Option<String>,
    pub current: Option<MusicItemView>,
    pub player: MusicPlayerView,
    pub items: Vec<MusicItemView>,
    pub prefetched: Option<String>,
    pub overlay_ms: u64,
    pub overlay_position: String,
    pub overlay_font: u32,
    pub reward_title: String,
    pub reward_cost: u32,
    pub reward_id: String,
    pub max_queue: usize,
    pub volume: f64,
}

/// Полный снимок состояния для вкладки «Награды» и шапки.
#[derive(Serialize)]
pub struct CoreView {
    pub version: String,
    pub login: String,
    pub display_name: String,
    pub connected: bool,
    pub volume: f64,
    pub muted: bool,
    pub audio_ready: bool,
    pub rewards: Vec<RewardView>,
    pub rewards_loading: bool,
    pub rewards_error: Option<String>,
    pub bindings: usize,
    pub playing: Vec<String>,
    pub music_enabled: bool,
    pub music_reward_title: String,
    pub music_reward_cost: u32,
    pub music: MusicView,
    pub eventsub: String,
    pub eventsub_error: Option<String>,
    pub client_id: String,
    pub autostart: bool,
    pub close_to_tray: bool,
    pub start_minimized: bool,
    pub playback_enabled: bool,
    pub auth: AuthView,
}

struct Inner {
    settings: Settings,
    twitch: twitch::Service,
    audio: audio::AudioEngine,
    music: music::MusicService,
    eventsub: eventsub::Service,
    playback_state: Arc<Mutex<PlaybackState>>,
    eventsub_state: String,
    eventsub_error: Option<String>,
    rewards: Vec<RemoteReward>,
    loading: bool,
    error: Option<String>,
    /// Кэш разбора файлов: не дёргаем диск при каждом опросе состояния.
    files: HashMap<String, FileInfo>,
    refresh_tried: bool,
    auth: AuthView,
}

pub struct AppCore {
    paths: AppPaths,
    inner: Mutex<Inner>,
}

impl AppCore {
    pub fn start() -> Arc<Self> {
        let paths = AppPaths::resolve();
        let _ = paths.ensure_dirs();
        let (settings, _) = Settings::load(&paths.config_file);

        let files = build_file_cache(&settings);
        let music_config = music::Config {
            enabled: settings.music.enabled,
            reward_id: settings.music.reward_id.clone(),
            max_queue: settings.music.max_queue,
            max_duration_sec: settings.music.max_duration_sec,
            volume: settings.music.volume_f32(),
            pause_yandex: settings.music.pause_yandex,
            channel: settings.twitch.login.clone(),
            restore_queue: settings.music.restore_queue,
            overlay_seconds: settings.music.overlay_seconds,
            overlay_position: settings.music.overlay_position.clone(),
            overlay_font: settings.music.overlay_font,
        };
        let music_temp = paths.data_dir.join("tmp");
        let music_service = music::MusicService::spawn(
            music_config,
            settings.music.ytdlp_path.clone(),
            music_temp,
        );
        let audio_engine = audio::AudioEngine::spawn();
        let playback_state = Arc::new(Mutex::new(PlaybackState::default()));
        if let Ok(mut state) = playback_state.lock() {
            state.sync(&settings);
        }
        let playback = Playback::new(audio_engine.clone(), Arc::clone(&playback_state));
        let eventsub_service = eventsub::Service::spawn_headless(playback);
        let inner = Inner {
            settings,
            twitch: twitch::Service::spawn(),
            audio: audio_engine,
            music: music_service,
            eventsub: eventsub_service,
            playback_state,
            eventsub_state: "stopped".to_string(),
            eventsub_error: None,
            rewards: Vec::new(),
            loading: false,
            error: None,
            files,
            refresh_tried: false,
            auth: AuthView {
                state: "idle".to_string(),
                ..AuthView::default()
            },
        };
        let core = Arc::new(Self {
            paths,
            inner: Mutex::new(inner),
        });

        core.bootstrap();
        core.start_eventsub();
        core.spawn_workers();
        core
    }

    /// Фоновый цикл: забирает события Twitch/EventSub/музыки, даже когда окно
    /// скрыто. Звуки играет сам EventSub, а статусы активаций обновляются здесь.
    fn spawn_workers(self: &Arc<Self>) {
        let core = Arc::clone(self);
        let _ = thread::Builder::new()
            .name("reward-sounds-tauri-events".to_string())
            .spawn(move || loop {
                core.drain_events();
                thread::sleep(Duration::from_millis(350));
            });
    }

    pub fn close_to_tray(&self) -> bool {
        self.lock().settings.close_to_tray
    }

    pub fn start_minimized(&self) -> bool {
        self.lock().settings.start_minimized
    }

    fn lock(&self) -> MutexGuard<'_, Inner> {
        self.inner.lock().unwrap_or_else(|err| err.into_inner())
    }

    fn save(&self) {
        let (playback_state, settings) = {
            let inner = self.lock();
            if let Err(err) = inner.settings.save(&self.paths.config_file) {
                log::warn!("Не удалось сохранить настройки: {err}");
            }
            (Arc::clone(&inner.playback_state), inner.settings.clone())
        };
        let mut state = playback_state
            .lock()
            .unwrap_or_else(|err| err.into_inner());
        state.sync(&settings);
        drop(state);
    }

    /// При запуске: обновляет токен, если он истёк, иначе сразу тянет награды.
    fn bootstrap(&self) {
        let mut inner = self.lock();
        if !inner.settings.twitch.is_connected() {
            return;
        }
        if inner.settings.twitch.user_id.trim().is_empty() {
            inner.error = Some("В сохранённом входе нет ID канала. Подключите Twitch заново.".into());
            return;
        }
        if twitch::token_expired_or_soon(inner.settings.twitch.expires_at) {
            self.start_refresh(&mut inner);
        } else {
            self.fetch_rewards(&mut inner);
        }
    }

    fn start_refresh(&self, inner: &mut Inner) {
        let client_id = inner.settings.twitch.client_id.trim().to_string();
        let Some(refresh) = inner.settings.twitch.refresh_token() else {
            inner.loading = false;
            inner.error = Some("Сессия Twitch истекла. Подключите аккаунт заново.".into());
            return;
        };
        if client_id.is_empty() {
            inner.loading = false;
            inner.error = Some("Не задан Client ID Twitch.".into());
            return;
        }
        inner.loading = true;
        inner.error = None;
        inner.twitch.refresh(&client_id, &refresh);
    }

    fn fetch_rewards(&self, inner: &mut Inner) {
        let settings = &inner.settings;
        if !settings.twitch.is_connected() {
            inner.loading = false;
            inner.error = Some("Twitch не подключён.".into());
            return;
        }
        let Some(access) = settings.twitch.access_token() else {
            inner.loading = false;
            inner.error = Some("Не удалось прочитать токен Twitch. Подключите аккаунт заново.".into());
            return;
        };
        if settings.twitch.user_id.trim().is_empty() {
            inner.loading = false;
            inner.error = Some("В сохранённом входе нет ID канала. Подключите Twitch заново.".into());
            return;
        }
        inner.loading = true;
        inner.error = None;
        inner.twitch.fetch_rewards(
            &settings.twitch.client_id,
            &access,
            &settings.twitch.user_id,
        );
    }

    /// Забирает накопившиеся события Twitch. Вызывается командами состояния:
    /// UI опрашивает get_state раз в 1,5 с, этого достаточно для наград.
    fn drain_events(&self) {
        let events = {
            let inner = self.lock();
            inner.twitch.poll()
        };
        if !events.is_empty() {
            log::info!("Tauri core: событий Twitch — {}", events.len());
            for event in events {
                self.handle_event(event);
            }
        }
        self.poll_eventsub();
        self.poll_music_events();
    }

    fn start_eventsub(&self) {
        let mut inner = self.lock();
        if !inner.settings.twitch.is_connected()
            || inner.settings.twitch.user_id.trim().is_empty()
        {
            return;
        }
        if inner.eventsub_state == "listening" || inner.eventsub_state == "connecting" {
            return;
        }
        let Some(access) = inner.settings.twitch.access_token() else {
            inner.eventsub_error = Some("Не удалось прочитать токен Twitch.".into());
            inner.eventsub_state = "stopped".to_string();
            return;
        };
        let client_id = inner.settings.twitch.client_id.trim().to_string();
        let user_id = inner.settings.twitch.user_id.trim().to_string();
        inner.eventsub.start(&client_id, &access, &user_id);
        inner.eventsub_state = "connecting".to_string();
        inner.eventsub_error = None;
        log::info!("Tauri core: EventSub подключается к Twitch");
    }

    fn poll_eventsub(&self) {
        let events = { self.lock().eventsub.poll() };
        for event in events {
            match event {
                eventsub::Event::Connected => {
                    let mut inner = self.lock();
                    inner.eventsub_state = "listening".to_string();
                    inner.eventsub_error = None;
                    drop(inner);
                    log::info!("EventSub: слушаем активации наград");
                }
                eventsub::Event::Redemption(redemption) => {
                    self.handle_redemption(redemption);
                }
                eventsub::Event::Disconnected(message) => {
                    let mut inner = self.lock();
                    inner.eventsub_state = "connecting".to_string();
                    inner.eventsub_error = Some(message.clone());
                    drop(inner);
                    log::warn!("EventSub: переподключение ({message})");
                }
                eventsub::Event::Revoked(message) => {
                    let mut inner = self.lock();
                    inner.eventsub_state = "connecting".to_string();
                    inner.eventsub_error = Some(message.clone());
                    drop(inner);
                    log::warn!("EventSub: {message}");
                }
                eventsub::Event::Unauthorized => {
                    let mut inner = self.lock();
                    inner.eventsub_state = "stopped".to_string();
                    inner.eventsub_error = Some("Нужно обновить вход в Twitch.".into());
                    self.start_refresh(&mut inner);
                }
                eventsub::Event::Failed(message) => {
                    let mut inner = self.lock();
                    inner.eventsub_state = "stopped".to_string();
                    inner.eventsub_error = Some(message.clone());
                    drop(inner);
                    log::warn!("EventSub: {message}");
                }
            }
        }
    }

    fn handle_redemption(&self, redemption: eventsub::Redemption) {
        log::info!(
            "Награда активирована: «{}» (@{})",
            redemption.reward_title,
            redemption.user_login
        );
        let music_reward = {
            let inner = self.lock();
            if !inner.settings.music.enabled {
                return;
            }
            inner.settings.music.reward_id.trim().to_string()
        };
        if !music_reward.is_empty() && redemption.reward_id == music_reward {
            self.lock().music.request(
                &redemption.redemption_id,
                &redemption.user_login,
                &redemption.user_input,
                &redemption.redeemed_at,
            );
            log::info!(
                "Музыка: заявка от @{} принята в обработку",
                redemption.user_login
            );
        }
    }

    fn poll_music_events(&self) {
        let events = { self.lock().music.poll_events() };
        for event in events {
            match event {
                music::MusicEvent::Queued { title, position, .. } => {
                    log::info!("Музыка: «{title}» в очереди, позиция {position}");
                }
                music::MusicEvent::Started { title, .. } => {
                    log::info!("Музыка: играет «{title}»");
                }
                music::MusicEvent::Finished { redemption_id } => {
                    self.set_redemption_status(&redemption_id, twitch::RedemptionStatus::Fulfilled);
                }
                music::MusicEvent::Rejected {
                    redemption_id,
                    reason,
                } => {
                    log::warn!("Музыка: заявка отклонена — {reason}");
                    self.set_redemption_status(&redemption_id, twitch::RedemptionStatus::Canceled);
                }
                music::MusicEvent::Failed {
                    redemption_id,
                    reason,
                } => {
                    log::warn!("Музыка: трек не сыграл — {reason}");
                    self.set_redemption_status(&redemption_id, twitch::RedemptionStatus::Canceled);
                }
                music::MusicEvent::Skipped { redemption_id } => {
                    self.set_redemption_status(&redemption_id, twitch::RedemptionStatus::Canceled);
                }
            }
        }
    }

    fn set_redemption_status(&self, redemption_id: &str, status: twitch::RedemptionStatus) {
        if redemption_id.starts_with("manual-") || redemption_id.contains("-replay-") {
            return;
        }
        let inner = self.lock();
        let reward_id = inner.settings.music.reward_id.trim().to_string();
        if reward_id.is_empty() || redemption_id.trim().is_empty() {
            return;
        }
        let Some(access) = inner.settings.twitch.access_token() else {
            return;
        };
        inner.twitch.update_redemption_status(
            &inner.settings.twitch.client_id,
            &access,
            &inner.settings.twitch.user_id,
            &reward_id,
            redemption_id,
            status,
        );
        log::info!(
            "Twitch: активация {redemption_id} — {}",
            status.label()
        );
    }

    fn handle_event(&self, event: twitch::Event) {
        match event {
            twitch::Event::Refreshed { user, tokens } => {
                {
                    let mut inner = self.lock();
                    inner.settings.twitch.user_id = user.id.clone();
                    inner.settings.twitch.login = user.login.clone();
                    inner.settings.twitch.display_name = user.display_name.clone();
                    if let Err(err) = inner.settings.twitch.store_tokens(
                        &tokens.access,
                        &tokens.refresh,
                        tokens.expires_at,
                    ) {
                        inner.error = Some(format!("Не удалось сохранить вход: {err}"));
                    } else {
                        inner.error = None;
                    }
                    inner.refresh_tried = false;
                }
                self.save();
                {
                    let mut inner = self.lock();
                    if inner.settings.twitch.is_connected() {
                        self.fetch_rewards(&mut inner);
                    }
                }
                self.start_eventsub();
            }
            twitch::Event::CodeReady {
                user_code,
                verification_uri,
                expires_in,
            } => {
                let mut inner = self.lock();
                inner.auth.state = "waiting".to_string();
                inner.auth.user_code = Some(user_code);
                inner.auth.verification_uri = Some(verification_uri);
                inner.auth.expires_in = expires_in;
                inner.auth.error = None;
                inner.auth.progress = None;
            }
            twitch::Event::Progress(text) => {
                self.lock().auth.progress = Some(text);
            }
            twitch::Event::Authorized { user, tokens } => {
                {
                    let mut inner = self.lock();
                    inner.settings.twitch.user_id = user.id.clone();
                    inner.settings.twitch.login = user.login.clone();
                    inner.settings.twitch.display_name = user.display_name.clone();
                    if let Err(err) = inner.settings.twitch.store_tokens(
                        &tokens.access,
                        &tokens.refresh,
                        tokens.expires_at,
                    ) {
                        inner.auth.state = "error".to_string();
                        inner.auth.error = Some(format!("Не удалось сохранить вход: {err}"));
                        return;
                    }
                    inner.auth.state = "idle".to_string();
                    inner.auth.user_code = None;
                    inner.auth.verification_uri = None;
                    inner.auth.progress = None;
                    inner.auth.error = None;
                    inner.refresh_tried = false;
                }
                self.save();
                self.start_eventsub();
                {
                    let mut inner = self.lock();
                    self.fetch_rewards(&mut inner);
                }
            }
            twitch::Event::RewardsLoaded { rewards } => {
                let mut inner = self.lock();
                inner.rewards = rewards;
                inner.loading = false;
                inner.error = None;
                inner.refresh_tried = false;
            }
            twitch::Event::RewardCreated { title, .. } => {
                log::info!("Twitch: награда «{title}» создана");
            }
            twitch::Event::RewardUpdated { title, .. } => {
                log::info!("Twitch: награда «{title}» изменена");
            }
            twitch::Event::RewardDeleted(title) => {
                log::info!("Twitch: награда «{title}» удалена");
            }
            twitch::Event::RewardManageUnauthorized => {
                let mut inner = self.lock();
                inner.error = Some(
                    "Twitch не разрешил управлять наградами — переподключите аккаунт.".into(),
                );
            }
            twitch::Event::RewardManageFailed(message) => {
                let mut inner = self.lock();
                inner.error = Some(message);
            }
            twitch::Event::RewardsUnauthorized => {
                {
                    let mut inner = self.lock();
                    if inner.settings.twitch.refresh_token().is_none() {
                        inner.loading = false;
                        inner.error = Some(
                            "Twitch не принял токен. Подключите аккаунт заново.".into(),
                        );
                        return;
                    }
                    if inner.refresh_tried {
                        inner.loading = false;
                        inner.error = Some(
                            "Не удалось обновить вход в Twitch. Подключите аккаунт заново.".into(),
                        );
                        return;
                    }
                    inner.refresh_tried = true;
                    self.start_refresh(&mut inner);
                }
            }
            twitch::Event::RewardsFailed(message) => {
                let mut inner = self.lock();
                inner.loading = false;
                inner.error = Some(message);
            }
            twitch::Event::SessionExpired(message) => {
                {
                    let mut inner = self.lock();
                    inner.settings.twitch.clear_session();
                    inner.rewards.clear();
                    inner.loading = false;
                    inner.error = Some(message.clone());
                    inner.auth.state = "error".to_string();
                    inner.auth.error = Some(message);
                }
                self.save();
            }
            twitch::Event::Failed(message) => {
                let mut inner = self.lock();
                inner.loading = false;
                inner.auth.state = "error".to_string();
                inner.auth.error = Some(message.clone());
                inner.error = Some(message);
            }
            _ => {}
        }
    }

    fn view(&self) -> CoreView {
        let inner = self.lock();
        let settings = &inner.settings;
        let active = inner.audio.snapshot().active;
        let rewards = inner
            .rewards
            .iter()
            .map(|reward| {
                let file = inner.files.get(&reward.id).cloned();
                RewardView {
                    id: reward.id.clone(),
                    title: reward.title.clone(),
                    cost: reward.cost,
                    color: reward.color.clone(),
                    available: reward.is_available(),
                    has_sound: file.as_ref().map(|file| file.exists).unwrap_or(false),
                    file,
                    playing: active.iter().any(|id| id == &reward.id),
                }
            })
            .collect();
        CoreView {
            version: reward_sounds::VERSION.to_string(),
            login: settings.twitch.login.clone(),
            display_name: settings.twitch.display_name.clone(),
            connected: settings.twitch.is_connected(),
            volume: settings.volume,
            muted: settings.muted,
            audio_ready: inner.audio.snapshot().is_ready(),
            rewards,
            rewards_loading: inner.loading,
            rewards_error: inner.error.clone(),
            bindings: settings.twitch_rewards.len(),
            playing: active,
            music_enabled: settings.music.enabled,
            music_reward_title: settings.music.reward_title.clone(),
            music_reward_cost: settings.music.reward_cost,
            music: music_view(&inner.music.snapshot(), settings),
            eventsub: inner.eventsub_state.clone(),
            eventsub_error: inner.eventsub_error.clone(),
            client_id: settings.twitch.client_id.clone(),
            autostart: settings.autostart,
            close_to_tray: settings.close_to_tray,
            start_minimized: settings.start_minimized,
            playback_enabled: settings.playback_enabled,
            auth: inner.auth.clone(),
        }
    }
}

fn item_view(item: &music::QueueItem) -> MusicItemView {
    MusicItemView {
        id: item.redemption_id.clone(),
        title: item.label(),
        user_login: item.user_login.clone(),
        channel: item.channel.clone(),
        duration_sec: item.duration_sec,
        state: match item.state {
            ItemState::Queued => "queued",
            ItemState::Loading => "loading",
            ItemState::Playing => "playing",
            ItemState::Done => "done",
            ItemState::Failed => "failed",
            ItemState::Refunded => "refunded",
            ItemState::Skipped => "skipped",
        }
        .to_string(),
    }
}

fn music_view(snapshot: &music::Snapshot, settings: &Settings) -> MusicView {
    MusicView {
        enabled: snapshot.enabled,
        ready: snapshot.ready(),
        ytdlp_version: snapshot.ytdlp_version.clone(),
        ytdlp_path: snapshot.ytdlp_path.clone(),
        error: snapshot.error.clone(),
        current: snapshot.current.as_ref().map(item_view),
        player: MusicPlayerView {
            loaded: snapshot.player.loaded,
            paused: snapshot.player.paused,
            position_sec: snapshot.player.position_sec,
            duration_sec: snapshot.player.duration_sec,
            error: snapshot.player.error.clone(),
        },
        items: snapshot
            .items
            .iter()
            .filter(|item| !item.state.is_final())
            .map(item_view)
            .collect(),
        prefetched: snapshot.prefetched.clone(),
        overlay_ms: snapshot.overlay_ms,
        overlay_position: snapshot.overlay_position.clone(),
        overlay_font: snapshot.overlay_font,
        reward_title: settings.music.reward_title.clone(),
        reward_cost: settings.music.reward_cost,
        reward_id: settings.music.reward_id.clone(),
        max_queue: settings.music.max_queue,
        volume: settings.music.music_volume,
    }
}

fn build_file_cache(settings: &Settings) -> HashMap<String, FileInfo> {
    let mut map = HashMap::new();
    for binding in &settings.twitch_rewards {
        if binding.path.trim().is_empty() {
            continue;
        }
        map.insert(binding.reward_id.clone(), file_info(&binding.path, binding.volume));
    }
    map
}

fn file_info(path: &str, volume: f64) -> FileInfo {
    let path_buf = PathBuf::from(path);
    let exists = path_buf.is_file();
    let format = path_buf
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_uppercase())
        .unwrap_or_else(|| "—".to_string());
    let duration = if exists {
        audio::probe_duration_sec(&path_buf)
            .map(format_duration)
            .unwrap_or_else(|| "—".to_string())
    } else {
        "—".to_string()
    };
    let meta = if duration == "—" {
        format.clone()
    } else {
        format!("{format} · {duration}")
    };
    FileInfo {
        name: util::file_name(Path::new(path)),
        path: path.to_string(),
        exists,
        meta,
        volume,
    }
}

fn format_duration(seconds: u64) -> String {
    format!("{}:{:02}", seconds / 60, seconds % 60)
}

/* ------------------------------------------------------------------ */
/* Команды                                                             */
/* ------------------------------------------------------------------ */

#[tauri::command]
pub fn get_state(core: State<'_, Arc<AppCore>>) -> CoreView {
    core.drain_events();
    // Первый запрос после запуска может прийти раньше, чем Twitch ответит:
    // ждём загрузку наград, чтобы интерфейс сразу получил данные.
    let started = Instant::now();
    loop {
        let (loading, empty) = {
            let inner = core.lock();
            (inner.loading, inner.rewards.is_empty())
        };
        if !loading || !empty || started.elapsed() > Duration::from_millis(2500) {
            break;
        }
        std::thread::sleep(Duration::from_millis(40));
        core.drain_events();
    }
    core.view()
}

#[tauri::command]
pub fn refresh_rewards(core: State<'_, Arc<AppCore>>) -> CoreView {
    core.drain_events();
    {
        let mut inner = core.lock();
        if !inner.loading {
            if twitch::token_expired_or_soon(inner.settings.twitch.expires_at) {
                core.start_refresh(&mut inner);
            } else {
                core.fetch_rewards(&mut inner);
            }
        }
    }
    core.view()
}

fn twitch_reward_credentials(inner: &Inner) -> Result<(String, String, String), String> {
    if !inner.settings.twitch.is_connected() {
        return Err("Twitch не подключён.".into());
    }
    let access = inner
        .settings
        .twitch
        .access_token()
        .ok_or("Не удалось прочитать токен Twitch. Переподключите аккаунт.")?;
    Ok((
        inner.settings.twitch.client_id.trim().to_string(),
        access,
        inner.settings.twitch.user_id.trim().to_string(),
    ))
}

#[tauri::command]
pub fn create_reward(
    core: State<'_, Arc<AppCore>>,
    title: String,
    cost: i64,
    color: String,
    requires_input: bool,
) -> Result<CoreView, String> {
    let draft = twitch::RewardDraft::new(title, cost, color).with_input(requires_input);
    draft.validate()?;
    {
        let inner = core.lock();
        let (client_id, access, user_id) = twitch_reward_credentials(&inner)?;
        inner
            .twitch
            .create_reward(&client_id, &access, &user_id, draft);
    }
    Ok(core.view())
}

#[tauri::command]
pub fn update_reward(
    core: State<'_, Arc<AppCore>>,
    reward_id: String,
    title: String,
    cost: i64,
    color: String,
    requires_input: bool,
) -> Result<CoreView, String> {
    if reward_id.trim().is_empty() {
        return Err("Не передана награда.".into());
    }
    let draft = twitch::RewardDraft::new(title, cost, color).with_input(requires_input);
    draft.validate()?;
    {
        let inner = core.lock();
        let (client_id, access, user_id) = twitch_reward_credentials(&inner)?;
        inner
            .twitch
            .update_reward(&client_id, &access, &user_id, &reward_id, draft);
    }
    Ok(core.view())
}

#[tauri::command]
pub fn delete_reward(
    core: State<'_, Arc<AppCore>>,
    reward_id: String,
    title: String,
) -> Result<CoreView, String> {
    if reward_id.trim().is_empty() {
        return Err("Не передана награда.".into());
    }
    {
        let inner = core.lock();
        let (client_id, access, user_id) = twitch_reward_credentials(&inner)?;
        inner
            .twitch
            .delete_reward(&client_id, &access, &user_id, &reward_id, &title);
    }
    Ok(core.view())
}

#[tauri::command]
pub fn set_volume(core: State<'_, Arc<AppCore>>, volume: f64) -> CoreView {
    {
        let mut inner = core.lock();
        inner.settings.volume = volume.clamp(0.0, 1.0);
        inner.settings.muted = false;
        let effective = inner.settings.effective_volume();
        let _ = inner.audio.set_volume(effective);
    }
    core.save();
    core.view()
}

#[tauri::command]
pub fn choose_sound(
    core: State<'_, Arc<AppCore>>,
    reward_id: String,
    title: String,
) -> Result<CoreView, String> {
    let Some(path) = rfd::FileDialog::new()
        .add_filter(
            "Аудио",
            &["mp3", "wav", "ogg", "flac", "m4a", "aac", "mp4", "opus"],
        )
        .set_title("Выберите звук для награды")
        .pick_file()
    else {
        return Ok(core.view());
    };
    if !audio::is_supported_file(&path) {
        return Err(audio::unsupported_format_message(&path));
    }
    let path_text = path.to_string_lossy().into_owned();
    {
        let mut inner = core.lock();
        inner
            .settings
            .set_reward_sound(&reward_id, &title, &path_text);
        inner
            .files
            .insert(reward_id.clone(), file_info(&path_text, 1.0));
    }
    core.save();
    Ok(core.view())
}

#[tauri::command]
pub fn clear_sound(core: State<'_, Arc<AppCore>>, reward_id: String) -> Result<CoreView, String> {
    {
        let mut inner = core.lock();
        inner.settings.clear_reward_sound(&reward_id);
        inner.files.remove(&reward_id);
    }
    core.save();
    Ok(core.view())
}

#[tauri::command]
pub fn set_sound_volume(
    core: State<'_, Arc<AppCore>>,
    reward_id: String,
    volume: f64,
) -> Result<CoreView, String> {
    {
        let mut inner = core.lock();
        inner.settings.set_sound_volume(&reward_id, volume);
        if let Some(file) = inner.files.get_mut(&reward_id) {
            file.volume = volume.clamp(0.0, 2.0);
        }
        let effective = inner.settings.effective_sound_volume(&reward_id);
        let _ = inner.audio.set_id_volume(&reward_id, effective);
    }
    core.save();
    Ok(core.view())
}

#[tauri::command]
pub fn preview_sound(core: State<'_, Arc<AppCore>>, reward_id: String) -> Result<(), String> {
    let inner = core.lock();
    let Some(binding) = inner.settings.reward_sound(&reward_id) else {
        return Err("У награды не выбран звук.".into());
    };
    let path = PathBuf::from(&binding.path);
    if !path.is_file() {
        return Err(format!("Файл «{}» не найден.", util::file_name(&path)));
    }
    let volume = inner.settings.effective_sound_volume(&reward_id);
    inner.audio.play(&reward_id, path, volume)?;
    Ok(())
}

#[tauri::command]
pub fn stop_all_sounds(core: State<'_, Arc<AppCore>>) -> Result<(), String> {
    let inner = core.lock();
    inner.audio.stop_all()?;
    Ok(())
}

#[tauri::command]
pub fn twitch_start_login(
    core: State<'_, Arc<AppCore>>,
    client_id: String,
) -> Result<CoreView, String> {
    let id = client_id.trim().to_string();
    if id.len() < 20 || !id.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err("Client ID должен состоять примерно из 30 букв и цифр без пробелов.".into());
    }
    {
        let mut inner = core.lock();
        inner.settings.twitch.client_id = id.clone();
        inner.auth = AuthView {
            state: "waiting".to_string(),
            progress: Some("Открываем страницу Twitch…".to_string()),
            ..AuthView::default()
        };
        inner.twitch.sign_in(&id);
    }
    core.save();
    Ok(core.view())
}

#[tauri::command]
pub fn twitch_cancel_login(core: State<'_, Arc<AppCore>>) -> CoreView {
    {
        let mut inner = core.lock();
        inner.twitch.cancel();
        inner.auth = AuthView {
            state: "idle".to_string(),
            ..AuthView::default()
        };
    }
    core.view()
}

#[tauri::command]
pub fn twitch_disconnect(core: State<'_, Arc<AppCore>>) -> CoreView {
    {
        let mut inner = core.lock();
        inner.settings.twitch.clear_session();
        inner.rewards.clear();
        inner.loading = false;
        inner.error = None;
        inner.eventsub.stop();
        inner.eventsub_state = "stopped".to_string();
        inner.eventsub_error = None;
        inner.auth = AuthView {
            state: "idle".to_string(),
            ..AuthView::default()
        };
    }
    core.save();
    core.view()
}

#[tauri::command]
pub fn set_app_setting(
    core: State<'_, Arc<AppCore>>,
    key: String,
    value: String,
) -> Result<CoreView, String> {
    {
        let mut inner = core.lock();
        match key.as_str() {
            "autostart" => {
                let enabled = value == "1" || value.eq_ignore_ascii_case("true");
                if let Err(err) = reward_sounds::autostart::set_enabled(enabled) {
                    return Err(format!("Не удалось изменить автозапуск: {err}"));
                }
                inner.settings.autostart = enabled;
            }
            "close_to_tray" => {
                inner.settings.close_to_tray = value == "1" || value.eq_ignore_ascii_case("true");
            }
            "start_minimized" => {
                inner.settings.start_minimized = value == "1" || value.eq_ignore_ascii_case("true");
            }
            "playback_enabled" => {
                inner.settings.playback_enabled = value == "1" || value.eq_ignore_ascii_case("true");
            }
            "muted" => {
                inner.settings.muted = value == "1" || value.eq_ignore_ascii_case("true");
                let volume = inner.settings.effective_volume();
                let _ = inner.audio.set_volume(volume);
                inner.music.set_volume(inner.settings.music.volume_f32());
            }
            "volume" => {
                let volume = value.parse::<f64>().map_err(|_| "Некорректная громкость")?;
                inner.settings.volume = volume.clamp(0.0, 1.0);
                inner.settings.muted = false;
                let effective = inner.settings.effective_volume();
                let _ = inner.audio.set_volume(effective);
            }
            other => return Err(format!("Неизвестная настройка: {other}")),
        }
    }
    core.save();
    Ok(core.view())
}

#[tauri::command]
pub fn get_logs(limit: Option<usize>) -> Vec<LogEntryView> {
    let paths = AppPaths::resolve();
    let Ok(text) = std::fs::read_to_string(&paths.log_file) else {
        return Vec::new();
    };
    let limit = limit.unwrap_or(400).clamp(1, 2000);
    let mut entries: Vec<LogEntryView> = text
        .lines()
        .rev()
        .take(limit)
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() {
                return None;
            }
            let mut parts = line.splitn(3, ' ');
            let date = parts.next()?;
            let clock = parts.next()?;
            let rest = parts.next()?.trim_start();
            let level_end = rest.find(char::is_whitespace).unwrap_or(rest.len());
            let level = rest[..level_end].to_string();
            let message = rest[level_end..].trim_start().to_string();
            if message.starts_with("Tauri core: get_state")
                || message.starts_with("Tauri core: событий Twitch")
            {
                return None;
            }
            Some(LogEntryView {
                time: format!("{date} {clock}"),
                level,
                message,
            })
        })
        .collect();
    entries.reverse();
    entries
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    if url.starts_with("https://twitch.tv/activate")
        || url.starts_with("https://www.twitch.tv/activate")
        || url.starts_with("https://dev.twitch.tv/")
    {
        webbrowser::open(&url).map_err(|err| err.to_string())?;
        Ok(())
    } else {
        Err("Недопустимая ссылка".into())
    }
}

#[tauri::command]
pub fn music_toggle_pause(core: State<'_, Arc<AppCore>>) -> CoreView {
    {
        let inner = core.lock();
        let paused = inner.music.snapshot().player.paused;
        inner.music.set_paused(!paused);
    }
    core.view()
}

#[tauri::command]
pub fn music_restart(core: State<'_, Arc<AppCore>>) -> CoreView {
    {
        let inner = core.lock();
        inner.music.seek(0);
        inner.music.set_paused(false);
    }
    core.view()
}

#[tauri::command]
pub fn music_skip(core: State<'_, Arc<AppCore>>) -> CoreView {
    core.lock().music.skip();
    core.view()
}

#[tauri::command]
pub fn music_seek(core: State<'_, Arc<AppCore>>, sec: u64) -> CoreView {
    core.lock().music.seek(sec);
    core.view()
}

#[tauri::command]
pub fn music_clear_queue(core: State<'_, Arc<AppCore>>) -> CoreView {
    core.lock().music.clear_queue();
    core.view()
}

#[tauri::command]
pub fn music_remove_item(core: State<'_, Arc<AppCore>>, id: String) -> CoreView {
    core.lock().music.remove_item(&id);
    core.view()
}

#[tauri::command]
pub fn music_move_up(core: State<'_, Arc<AppCore>>, id: String) -> CoreView {
    core.lock().music.move_up(&id);
    core.view()
}

#[tauri::command]
pub fn music_add_manual(core: State<'_, Arc<AppCore>>, url: String) -> CoreView {
    core.lock().music.add_manual(&url);
    core.view()
}

#[tauri::command]
pub fn music_show_overlay(core: State<'_, Arc<AppCore>>) -> CoreView {
    core.lock().music.show_overlay();
    core.view()
}

#[tauri::command]
pub fn music_recheck(core: State<'_, Arc<AppCore>>) -> CoreView {
    core.lock().music.recheck();
    core.view()
}

#[tauri::command]
pub fn music_set_volume(core: State<'_, Arc<AppCore>>, volume: f64) -> CoreView {
    {
        let mut inner = core.lock();
        let volume = volume.clamp(0.0, 1.0);
        inner.settings.music.music_volume = volume;
        inner.music.set_volume(volume as f32);
    }
    core.save();
    core.view()
}

#[tauri::command]
pub fn music_set_enabled(core: State<'_, Arc<AppCore>>, enabled: bool) -> CoreView {
    {
        let mut inner = core.lock();
        inner.settings.music.enabled = enabled;
        inner.music.set_paused(!enabled);
        let config = music_config(&inner.settings);
        inner.music.configure(config);
    }
    core.save();
    core.view()
}

fn music_config(settings: &Settings) -> music::Config {
    music::Config {
        enabled: settings.music.enabled,
        reward_id: settings.music.reward_id.clone(),
        max_queue: settings.music.max_queue,
        max_duration_sec: settings.music.max_duration_sec,
        volume: settings.music.volume_f32(),
        pause_yandex: settings.music.pause_yandex,
        channel: settings.twitch.login.clone(),
        restore_queue: settings.music.restore_queue,
        overlay_seconds: settings.music.overlay_seconds,
        overlay_position: settings.music.overlay_position.clone(),
        overlay_font: settings.music.overlay_font,
    }
}
