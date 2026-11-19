//! Общее состояние Tauri-приложения и команды для UI.
//!
//! Здесь живёт «контроллер» нового интерфейса: настройки, фоновый Twitch-сервис,
//! аудиодвижок и кэш привязок. Команды отдают фронтенду снимок состояния,
//! поэтому React/JS-слою не нужно знать о потоках и токенах.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, TryRecvError};
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
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
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

/// Локальная привязка звука: доступна даже без подключённого Twitch.
#[derive(Clone, Serialize)]
pub struct LocalBindingView {
    pub reward_id: String,
    pub title: String,
    pub file: Option<FileInfo>,
    /// Привязка используется вкладкой «Музыка».
    pub music: bool,
}

/// Награда в том виде, в котором её удобно рисовать.
#[derive(Clone, Serialize)]
pub struct RewardView {
    pub id: String,
    pub title: String,
    pub cost: i64,
    pub color: String,
    pub available: bool,
    pub requires_input: bool,
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

/// Один индикатор здоровья подсистемы для статус-хаба.
#[derive(Clone, Serialize)]
pub struct HealthItemView {
    /// twitch | eventsub | audio | ytdlp | overlay
    pub key: String,
    pub title: String,
    /// ok | warn | error | off
    pub state: String,
    pub detail: String,
    /// Вкладка, куда ведёт «Открыть»: settings | music | log.
    pub action: String,
}

/// Одна заявка в очереди музыки.
#[derive(Clone, Serialize)]
pub struct MusicItemView {
    pub id: String,
    pub video_id: String,
    pub title: String,
    pub user_login: String,
    pub channel: String,
    pub duration_sec: u64,
    pub state: String,
    /// Этот трек уже скачан и ждёт очереди.
    pub prefetched: bool,
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
    pub ytdlp_path_setting: String,
    pub ytdlp_update_days: u64,
    pub cookies_file: String,
    pub error: Option<String>,
    pub current: Option<MusicItemView>,
    pub player: MusicPlayerView,
    pub items: Vec<MusicItemView>,
    pub prefetched: Option<String>,
    pub prefetched_title: Option<String>,
    pub overlay_ms: u64,
    pub overlay_seconds: u64,
    pub overlay_position: String,
    pub overlay_font: u32,
    pub reward_title: String,
    pub reward_cost: u32,
    pub reward_id: String,
    pub max_queue: usize,
    pub max_duration_sec: u64,
    pub pause_yandex: bool,
    pub request_cooldown_sec: u64,
    pub blocked_videos: Vec<String>,
    pub autodj: bool,
    pub autodj_playlist: Vec<String>,
    pub restore_queue: bool,
    pub prefetch: bool,
    pub volume: f64,
    /// Чат канала реально подключён (команда `!трек` доступна).
    pub chat_online: bool,
    /// HTTP-оверлей поднялся и слушает порт.
    pub overlay_ready: bool,
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
    pub audio_device: Option<String>,
    pub audio_error: Option<String>,
    pub rewards: Vec<RewardView>,
    pub rewards_loading: bool,
    pub rewards_error: Option<String>,
    pub bindings: usize,
    pub local_bindings: Vec<LocalBindingView>,
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
    pub grid_view: bool,
    /// Акцентный цвет интерфейса (#RRGGBB).
    pub accent: String,
    pub normalizing: bool,
    pub normalize_message: Option<String>,
    pub data_dir: String,
    pub log_file: String,
    /// Агрегат здоровья подсистем для чипа «Все системы работают».
    pub health: Vec<HealthItemView>,
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
    /// Последняя ошибка аудиодвижка (показывается плашкой в UI).
    audio_error: Option<String>,
    /// Идёт фоновое выравнивание громкости звуков.
    normalizing: bool,
    normalize_rx: Option<Receiver<Vec<(String, f64)>>>,
    /// Результат последнего выравнивания (тост для интерфейса).
    normalize_message: Option<String>,
    /// Звук, который нужно привязать к только что созданной награде
    /// (название, путь): ждём, пока Twitch вернёт созданную награду с id.
    pending_sound: Option<(String, String)>,
}

pub struct AppCore {
    paths: AppPaths,
    inner: Mutex<Inner>,
}

impl AppCore {
    pub fn start() -> Arc<Self> {
        let paths = AppPaths::resolve();
        let _ = paths.ensure_dirs();
        let (mut settings, _) = Settings::load(&paths.config_file);
        // Автозапуск читаем из реестра: пользователь мог включить/выключить его
        // вне приложения, а UI должен показывать реальное состояние.
        settings.autostart = reward_sounds::autostart::is_enabled();

        let files = build_file_cache(&settings);
        let music_config = music::Config {
            enabled: settings.music.enabled,
            reward_id: settings.music.reward_id.clone(),
            max_queue: settings.music.max_queue,
            max_duration_sec: settings.music.max_duration_sec,
            volume: settings.music.volume_f32(),
            pause_yandex: settings.music.pause_yandex,
            request_cooldown_sec: settings.music.request_cooldown_sec,
            blocked_videos: settings.music.blocked_videos.clone(),
            channel: settings.twitch.login.clone(),
            restore_queue: settings.music.restore_queue,
            overlay_seconds: settings.music.overlay_seconds,
            overlay_position: settings.music.overlay_position.clone(),
            overlay_font: settings.music.overlay_font,
            cookies_file: settings.music.cookies_file.clone(),
        };
        // Временные файлы yt-dlp/PyInstaller держим в системном TEMP:
        // в Roaming-папке PyInstaller иногда не может создать временный каталог.
        let music_temp = std::env::temp_dir().join("RewardSoundsMusic");
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
            audio_error: None,
            normalizing: false,
            normalize_rx: None,
            normalize_message: None,
            pending_sound: None,
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

    /// Включены ли звуки наград (для галочки в меню трея).
    pub fn playback_enabled(&self) -> bool {
        self.lock().settings.playback_enabled
    }

    /// Включает/выключает воспроизведение звуков наград (меню трея).
    pub fn set_playback_enabled(&self, enabled: bool) {
        {
            let mut inner = self.lock();
            inner.settings.playback_enabled = enabled;
            if !enabled {
                let _ = inner.audio.stop_all();
            }
        }
        self.save();
        log::info!("Звуки наград: {}", if enabled { "включены" } else { "выключены" });
    }

    /// Останавливает все играющие звуки (меню трея).
    pub fn stop_all_sounds(&self) -> Result<(), String> {
        self.lock().audio.stop_all()
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
            inner.error =
                Some("В сохранённом входе нет ID канала. Подключите Twitch заново.".into());
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
        self.poll_audio_state();
        self.poll_normalize();
    }

    /// Забирает ошибки аудиодвижка и показывает их плашкой в интерфейсе.
    fn poll_audio_state(&self) {
        let errors = {
            let inner = self.lock();
            inner.audio.take_errors()
        };
        if errors.is_empty() {
            return;
        }
        for message in &errors {
            log::error!("{message}");
        }
        self.lock().audio_error = Some(errors.join(" "));
    }

    /// Проверяет, закончилось ли фоновое выравнивание громкости.
    fn poll_normalize(&self) {
        let outcome = {
            let inner = self.lock();
            inner
                .normalize_rx
                .as_ref()
                .map(|receiver| receiver.try_recv())
        };
        match outcome {
            None => {}
            Some(Err(TryRecvError::Empty)) => {}
            Some(Err(TryRecvError::Disconnected)) => {
                let mut inner = self.lock();
                inner.normalize_rx = None;
                inner.normalizing = false;
                inner.normalize_message = Some("Не удалось измерить громкость звуков.".into());
            }
            Some(Ok(volumes)) => {
                {
                    let mut inner = self.lock();
                    inner.normalize_rx = None;
                    inner.normalizing = false;
                    if volumes.is_empty() {
                        inner.normalize_message =
                            Some("Не удалось измерить громкость звуков.".into());
                    } else {
                        let count = volumes.len();
                        for (reward_id, volume) in &volumes {
                            inner.settings.set_sound_volume(reward_id, *volume);
                            if let Some(file) = inner.files.get_mut(reward_id) {
                                file.volume = *volume;
                            }
                        }
                        inner.normalize_message = Some(format!(
                            "Громкость выровнена по {count} {}.",
                            util::plural_ru(count, "звуку", "звукам", "звукам")
                        ));
                        log::info!("Громкость выровнена по {count} звукам(ам)");
                    }
                }
                self.save();
            }
        }
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
                music::MusicEvent::Skipped {
                    redemption_id,
                    reason,
                } => {
                    log::info!("Музыка: пропуск {redemption_id} — {reason}");
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
                    // Канал мог измениться — обновляем чтение чата для `!трек`.
                    apply_music_config(&mut inner);
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
                    // Канал мог измениться — обновляем чтение чата для `!трек`.
                    apply_music_config(&mut inner);
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
                // Если награду создавали сразу со звуком — привязываем файл,
                // как только Twitch вернул созданную награду с id.
                let bind_ready = inner
                    .pending_sound
                    .as_ref()
                    .and_then(|(title, _)| {
                        inner
                            .rewards
                            .iter()
                            .find(|reward| reward.title.trim() == title.trim())
                            .cloned()
                    });
                if let Some(reward) = bind_ready {
                    if let Some((_, path)) = inner.pending_sound.take() {
                        inner
                            .settings
                            .set_reward_sound(&reward.id, &reward.title, &path);
                        inner
                            .files
                            .insert(reward.id.clone(), file_info(&path, 1.0));
                        log::info!(
                            "Награда «{}» создана со звуком {}",
                            reward.title,
                            path
                        );
                        drop(inner);
                        self.save();
                    }
                }
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
                    apply_music_config(&mut inner);
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
        let audio = inner.audio.snapshot();
        let active = audio.active.clone();
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
                    requires_input: reward.requires_input,
                    has_sound: file.as_ref().map(|file| file.exists).unwrap_or(false),
                    file,
                    playing: active.iter().any(|id| id == &reward.id),
                }
            })
            .collect();
        let local_bindings = settings
            .twitch_rewards
            .iter()
            .map(|binding| LocalBindingView {
                reward_id: binding.reward_id.clone(),
                title: binding.title.clone(),
                file: inner.files.get(&binding.reward_id).cloned(),
                music: binding.reward_id == settings.music.reward_id,
            })
            .collect();
        let music_snapshot = inner.music.snapshot();
        let health = health_view(settings, &inner, &music_snapshot, &audio);
        CoreView {
            version: reward_sounds::VERSION.to_string(),
            login: settings.twitch.login.clone(),
            display_name: settings.twitch.display_name.clone(),
            connected: settings.twitch.is_connected(),
            volume: settings.volume,
            muted: settings.muted,
            audio_ready: audio.is_ready(),
            audio_device: audio.device.clone(),
            audio_error: inner.audio_error.clone(),
            rewards,
            rewards_loading: inner.loading,
            rewards_error: inner.error.clone(),
            bindings: settings.twitch_rewards.len(),
            local_bindings,
            playing: active,
            music_enabled: settings.music.enabled,
            music_reward_title: settings.music.reward_title.clone(),
            music_reward_cost: settings.music.reward_cost,
            music: music_view(&music_snapshot, settings),
            eventsub: inner.eventsub_state.clone(),
            eventsub_error: inner.eventsub_error.clone(),
            client_id: settings.twitch.client_id.clone(),
            autostart: settings.autostart,
            close_to_tray: settings.close_to_tray,
            start_minimized: settings.start_minimized,
            playback_enabled: settings.playback_enabled,
            grid_view: settings.grid_view,
            accent: settings.accent.clone(),
            normalizing: inner.normalizing,
            normalize_message: inner.normalize_message.clone(),
            data_dir: self.paths.data_dir.display().to_string(),
            log_file: self.paths.log_file.display().to_string(),
            health,
            auth: inner.auth.clone(),
        }
    }
}

/// Собирает статус всех подсистем для статус-хаба и карточки «Здоровье системы».
fn health_view(
    settings: &Settings,
    inner: &Inner,
    music: &music::Snapshot,
    audio: &audio::Status,
) -> Vec<HealthItemView> {
    let item = |key: &str, title: &str, state: &str, detail: String, action: &str| HealthItemView {
        key: key.to_string(),
        title: title.to_string(),
        state: state.to_string(),
        detail,
        action: action.to_string(),
    };

    let twitch_state = if settings.twitch.is_connected() {
        "ok"
    } else {
        "error"
    };
    let twitch_detail = if settings.twitch.is_connected() {
        format!("Подключено · @{}", settings.twitch.login)
    } else {
        "Twitch не подключён — награды и команда !трек недоступны".to_string()
    };

    let eventsub_state = if !settings.twitch.is_connected() {
        "off"
    } else {
        match inner.eventsub_state.as_str() {
            "listening" => "ok",
            "connecting" => "warn",
            _ => "warn",
        }
    };
    let eventsub_detail = if eventsub_state == "ok" {
        "Слушаем активации наград".to_string()
    } else if let Some(error) = &inner.eventsub_error {
        error.clone()
    } else if eventsub_state == "off" {
        "Нужен Twitch".to_string()
    } else {
        format!("Статус: {}", inner.eventsub_state)
    };

    let audio_state = if !audio.is_ready() || settings.muted {
        if !audio.is_ready() {
            "error"
        } else {
            "warn"
        }
    } else {
        "ok"
    };
    let audio_detail = if !audio.is_ready() {
        inner
            .audio_error
            .clone()
            .unwrap_or_else(|| "Нет аудиовыхода".to_string())
    } else if settings.muted {
        "Включён режим «Без звука»".to_string()
    } else {
        audio
            .device
            .clone()
            .unwrap_or_else(|| "Устройство по умолчанию".to_string())
    };

    let ytdlp_state = if music.ytdlp_version.is_some() {
        "ok"
    } else {
        "error"
    };
    let ytdlp_detail = match &music.ytdlp_version {
        Some(version) => format!("yt-dlp {version}"),
        None => "yt-dlp не найден — музыка не принимается".to_string(),
    };

    let overlay_state = if music.overlay_ready { "ok" } else { "error" };
    let overlay_detail = if music.overlay_ready {
        format!(
            "http://127.0.0.1:{}/overlay · чат-оверлей: /chat-overlay",
            reward_sounds::music::overlay::PORT
        )
    } else {
        "Оверлей не запустился (порт 8770 занят?)".to_string()
    };

    vec![
        item("twitch", "Twitch", twitch_state, twitch_detail, "settings"),
        item("eventsub", "EventSub", eventsub_state, eventsub_detail, "settings"),
        item("audio", "Звук", audio_state, audio_detail, "settings"),
        item("ytdlp", "yt-dlp", ytdlp_state, ytdlp_detail, "music"),
        item("overlay", "Оверлей", overlay_state, overlay_detail, "music"),
    ]
}

fn item_view(item: &music::QueueItem, prefetched: bool) -> MusicItemView {
    MusicItemView {
        id: item.redemption_id.clone(),
        video_id: item.video_id.clone(),
        title: item.label(),
        user_login: item.user_login.clone(),
        channel: item.channel.clone(),
        duration_sec: item.duration_sec,
        prefetched,
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
    let prefetched_id = snapshot.prefetched.clone();
    let prefetched_title = prefetched_id.as_ref().and_then(|video_id| {
        snapshot
            .items
            .iter()
            .find(|item| &item.video_id == video_id)
            .map(|item| item.label())
    });
    MusicView {
        enabled: snapshot.enabled,
        ready: snapshot.ready(),
        ytdlp_version: snapshot.ytdlp_version.clone(),
        ytdlp_path: snapshot.ytdlp_path.clone(),
        ytdlp_path_setting: settings.music.ytdlp_path.clone(),
        ytdlp_update_days: settings.music.ytdlp_update_days,
        cookies_file: settings.music.cookies_file.clone(),
        error: snapshot.error.clone(),
        current: snapshot
            .current
            .as_ref()
            .map(|item| item_view(item, false)),
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
            .map(|item| {
                let prefetched = prefetched_id
                    .as_deref()
                    .map(|video_id| video_id == item.video_id)
                    .unwrap_or(false);
                item_view(item, prefetched)
            })
            .collect(),
        prefetched: prefetched_id,
        prefetched_title,
        overlay_ms: snapshot.overlay_ms,
        overlay_seconds: settings.music.overlay_seconds,
        overlay_position: snapshot.overlay_position.clone(),
        overlay_font: snapshot.overlay_font,
        reward_title: settings.music.reward_title.clone(),
        reward_cost: settings.music.reward_cost,
        reward_id: settings.music.reward_id.clone(),
        max_queue: settings.music.max_queue,
        max_duration_sec: settings.music.max_duration_sec,
        pause_yandex: settings.music.pause_yandex,
        request_cooldown_sec: settings.music.request_cooldown_sec,
        blocked_videos: settings.music.blocked_videos.clone(),
        autodj: settings.music.autodj,
        autodj_playlist: settings.music.autodj_playlist.clone(),
        restore_queue: settings.music.restore_queue,
        prefetch: settings.music.prefetch,
        volume: settings.music.music_volume,
        chat_online: snapshot.chat_online,
        overlay_ready: snapshot.overlay_ready,
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
    sound_path: Option<String>,
) -> Result<CoreView, String> {
    let draft = twitch::RewardDraft::new(title, cost, color).with_input(requires_input);
    draft.validate()?;
    if let Some(path) = sound_path.as_deref() {
        validate_sound_path(path)?;
    }
    {
        let mut inner = core.lock();
        let (client_id, access, user_id) = twitch_reward_credentials(&inner)?;
        let pending = sound_path.map(|path| (draft.title.trim().to_string(), path));
        inner.pending_sound = pending;
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
    sound_path: Option<String>,
    clear_sound: bool,
) -> Result<CoreView, String> {
    if reward_id.trim().is_empty() {
        return Err("Не передана награда.".into());
    }
    let draft = twitch::RewardDraft::new(title, cost, color).with_input(requires_input);
    draft.validate()?;
    if let Some(path) = sound_path.as_deref() {
        validate_sound_path(path)?;
    }
    {
        let mut inner = core.lock();
        let (client_id, access, user_id) = twitch_reward_credentials(&inner)?;
        inner
            .twitch
            .update_reward(&client_id, &access, &user_id, &reward_id, draft.clone());
        // Звук меняем сразу: отдельного «сохранить звук» в форме награды нет.
        if clear_sound {
            inner.settings.clear_reward_sound(&reward_id);
            inner.files.remove(&reward_id);
        } else if let Some(path) = sound_path {
            inner
                .settings
                .set_reward_sound(&reward_id, &draft.title, &path);
            inner.files.insert(reward_id.clone(), file_info(&path, 1.0));
        }
    }
    core.save();
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
pub fn choose_ytdlp_cookies() -> Option<String> {
    rfd::FileDialog::new()
        .add_filter("Cookies", &["txt"])
        .set_title("Выберите cookies.txt для YouTube")
        .pick_file()
        .map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn check_ytdlp_cookies(path: String) -> bool {
    reward_sounds::music::cookies_have_youtube_login(Path::new(&path))
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
        apply_music_config(&mut inner);
    }
    core.save();
    core.view()
}

/// Проверяет акцентный цвет: только `#RRGGBB`.
fn normalize_accent(value: &str) -> Result<String, String> {
    let value = value.trim();
    let valid = value.len() == 7
        && value.starts_with('#')
        && value[1..].chars().all(|ch| ch.is_ascii_hexdigit());
    if !valid {
        return Err("Акцентный цвет должен быть в формате #RRGGBB".to_string());
    }
    Ok(value.to_uppercase())
}

#[tauri::command]
pub fn set_app_setting(    app: AppHandle,
    core: State<'_, Arc<AppCore>>,
    key: String,
    value: String,
) -> Result<CoreView, String> {
    let mut playback_changed: Option<bool> = None;
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
                let enabled = value == "1" || value.eq_ignore_ascii_case("true");
                inner.settings.playback_enabled = enabled;
                playback_changed = Some(enabled);
            }
            "grid_view" => {
                inner.settings.grid_view = value == "1" || value.eq_ignore_ascii_case("true");
            }
            "accent" => {
                inner.settings.accent = normalize_accent(&value)?;
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
    if let Some(enabled) = playback_changed {
        // Обновляем галочку «Воспроизводить звуки» в меню трея.
        let _ = app.emit("playback-changed", enabled);
    }
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
    // Новые записи — первыми: пользователь их и хочет видеть в журнале.
    entries
}

/// Очищает журнал, сохранив копию в `logs/archive-*.log`.
/// Возвращает имя архива, если было что сохранять.
#[tauri::command]
pub fn clear_log() -> Result<Option<String>, String> {
    let paths = AppPaths::resolve();
    let text = std::fs::read_to_string(&paths.log_file).unwrap_or_default();
    let mut archived = None;
    if !text.trim().is_empty() {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_secs())
            .unwrap_or(0);
        let name = format!("archive-{stamp}.log");
        let archive = paths.log_dir.join(&name);
        std::fs::write(&archive, text)
            .map_err(|error| format!("Не удалось сохранить архив журнала: {error}"))?;
        archived = Some(name);
    }
    std::fs::write(&paths.log_file, "")
        .map_err(|error| format!("Не удалось очистить журнал: {error}"))?;
    if let Some(name) = &archived {
        log::info!("Журнал очищен, архив: {name}");
    }
    Ok(archived)
}

#[tauri::command]
pub fn get_chat_overlay_settings(core: State<'_, Arc<AppCore>>) -> Result<String, String> {
    let path = core.paths.data_dir.join("chat_overlay_settings.js");
    match std::fs::read_to_string(path) {
        Ok(text) => {
            // Страница оверлея ждёт `window.OVERLAY_SETTINGS = {...};`.
            let json = text
                .split_once("window.OVERLAY_SETTINGS")
                .and_then(|(_, rest)| rest.split_once('=').map(|(_, rest)| rest))
                .map(|rest| rest.trim().trim_end_matches(';').trim().to_string())
                .unwrap_or_default();
            Ok(json)
        }
        Err(_) => Ok(String::new()),
    }
}

#[tauri::command]
pub fn save_chat_overlay_settings(
    core: State<'_, Arc<AppCore>>,
    payload: String,
) -> Result<(), String> {
    let value: serde_json::Value =
        serde_json::from_str(&payload).map_err(|error| format!("Некорректные настройки: {error}"))?;
    let valid = value
        .get("presets")
        .and_then(|presets| presets.as_array())
        .map(|presets| !presets.is_empty())
        .unwrap_or(false);
    if !valid {
        return Err("В настройках нет пресетов".into());
    }
    let path = core.paths.data_dir.join("chat_overlay_settings.js");
    std::fs::create_dir_all(&core.paths.data_dir)
        .map_err(|error| format!("Не удалось создать папку настроек: {error}"))?;
    let file = format!(
        "// Twitch Chat Overlay — настройки.\n// Файл создаётся приложением Reward Sounds.\nwindow.OVERLAY_SETTINGS = {payload};\n"
    );
    std::fs::write(path, file).map_err(|error| format!("Не удалось сохранить настройки: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    let allowed = url.starts_with("https://twitch.tv/activate")
        || url.starts_with("https://www.twitch.tv/activate")
        || url.starts_with("https://dev.twitch.tv/")
        || url.starts_with("https://dashboard.twitch.tv/")
        || url.starts_with("https://www.twitch.tv/")
        || url.starts_with("https://www.youtube.com/")
        || url.starts_with("https://youtube.com/")
        || url.starts_with("https://youtu.be/")
        || url.starts_with("http://127.0.0.1:8770/")
        || url.starts_with("http://localhost:8770/");
    if !allowed {
        return Err("Недопустимая ссылка".into());
    }
    webbrowser::open(&url).map_err(|err| err.to_string())?;
    Ok(())
}

/// Выбранный в диалоге звук (ещё не привязан к награде).
#[derive(Clone, Serialize)]
pub struct PickedSound {
    pub path: String,
    pub name: String,
    pub meta: String,
}

/// Проверяет, что путь ведёт к поддерживаемому непустому аудиофайлу.
fn validate_sound_path(path: &str) -> Result<(), String> {
    let path_buf = PathBuf::from(path);
    if !audio::is_supported_file(&path_buf) {
        return Err(audio::unsupported_format_message(&path_buf));
    }
    match std::fs::metadata(&path_buf) {
        Ok(meta) if meta.is_file() && meta.len() > 0 => Ok(()),
        Ok(_) => Err(format!(
            "Файл «{}» пустой или недоступен.",
            util::file_name(&path_buf)
        )),
        Err(err) => Err(format!(
            "Не удалось прочитать файл «{}»: {err}",
            util::file_name(&path_buf)
        )),
    }
}

/// Диалог выбора звука без привязки: файл выбирается в форме награды,
/// а привязывается только после «Создать/Сохранить».
#[tauri::command]
pub fn pick_sound_file() -> Result<Option<PickedSound>, String> {
    let Some(path) = rfd::FileDialog::new()
        .add_filter(
            "Аудио",
            &["mp3", "wav", "ogg", "flac", "m4a", "aac", "mp4", "opus"],
        )
        .set_title("Выберите звук для награды")
        .pick_file()
    else {
        return Ok(None);
    };
    let path_text = path.display().to_string();
    validate_sound_path(&path_text)?;
    let info = file_info(&path_text, 1.0);
    Ok(Some(PickedSound {
        path: info.path,
        name: info.name,
        meta: info.meta,
    }))
}

/// Прослушивание выбранного файла до сохранения награды.
#[tauri::command]
pub fn preview_path(core: State<'_, Arc<AppCore>>, path: String) -> Result<(), String> {
    validate_sound_path(&path)?;
    let inner = core.lock();
    inner.audio.play(
        "__editor_preview__",
        PathBuf::from(path),
        inner.settings.effective_volume(),
    )
}

/// «Обновить данные»: обновляет токен при необходимости и перечитывает награды.
#[tauri::command]
pub fn refresh_twitch_now(core: State<'_, Arc<AppCore>>) -> CoreView {
    {
        let mut inner = core.lock();
        if !inner.settings.twitch.is_connected() {
            inner.error = Some("Twitch не подключён.".into());
        } else {
            inner.refresh_tried = false;
            if twitch::token_expired_or_soon(inner.settings.twitch.expires_at) {
                core.start_refresh(&mut inner);
            } else {
                core.fetch_rewards(&mut inner);
            }
        }
    }
    core.view()
}

/// Перезапуск прослушивания активаций наград (EventSub).
#[tauri::command]
pub fn restart_eventsub(core: State<'_, Arc<AppCore>>) -> CoreView {
    {
        let mut inner = core.lock();
        inner.eventsub.stop();
        inner.eventsub_state = "stopped".to_string();
        inner.eventsub_error = None;
    }
    core.start_eventsub();
    core.view()
}

/// Открывает папку настроек или журнала в проводнике.
#[tauri::command]
pub fn open_folder(kind: String) -> Result<(), String> {
    let paths = AppPaths::resolve();
    match kind.as_str() {
        "config" | "data" => util::open_in_explorer(&paths.data_dir),
        "logs" => util::open_in_explorer(&paths.log_dir),
        other => return Err(format!("Неизвестная папка: {other}")),
    }
    Ok(())
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
pub fn music_next(core: State<'_, Arc<AppCore>>) -> CoreView {
    core.lock().music.next();
    core.view()
}

#[tauri::command]
pub fn music_undo_skip(core: State<'_, Arc<AppCore>>) -> CoreView {
    core.lock().music.undo_skip();
    core.view()
}

#[tauri::command]
pub fn music_skip(core: State<'_, Arc<AppCore>>, reason: Option<String>) -> CoreView {
    core.lock()
        .music
        .skip(reason.unwrap_or_else(|| "без причины".to_string()));
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

/// Патч настроек музыки из интерфейса: меняем только переданные поля.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicSettingsPatch {
    pub enabled: Option<bool>,
    pub max_queue: Option<usize>,
    pub max_duration_sec: Option<u64>,
    pub pause_yandex: Option<bool>,
    pub request_cooldown_sec: Option<u64>,
    pub blocked_videos: Option<Vec<String>>,
    pub autodj: Option<bool>,
    pub autodj_playlist: Option<Vec<String>>,
    pub restore_queue: Option<bool>,
    pub prefetch: Option<bool>,
    pub overlay_seconds: Option<u64>,
    pub overlay_position: Option<String>,
    pub overlay_font: Option<u32>,
    pub ytdlp_path: Option<String>,
    pub ytdlp_update_days: Option<u64>,
    pub cookies_file: Option<String>,
}

/// Применяет патч настроек музыки с ограничениями диапазонов.
fn apply_music_patch(music: &mut reward_sounds::config::MusicSettings, patch: &MusicSettingsPatch) {
    if let Some(value) = patch.enabled {
        music.enabled = value;
    }
    if let Some(value) = patch.max_queue {
        music.max_queue = value.clamp(1, 50);
    }
    if let Some(value) = patch.max_duration_sec {
        music.max_duration_sec = value.clamp(60, 7200);
    }
    if let Some(value) = patch.pause_yandex {
        music.pause_yandex = value;
    }
    if let Some(value) = patch.request_cooldown_sec {
        music.request_cooldown_sec = value.min(3600);
    }
    if let Some(value) = &patch.blocked_videos {
        music.blocked_videos = value
            .iter()
            .map(|id| id.trim().to_string())
            .filter(|id| !id.is_empty())
            .collect();
    }
    if let Some(value) = patch.autodj {
        music.autodj = value;
    }
    if let Some(value) = &patch.autodj_playlist {
        music.autodj_playlist = value
            .iter()
            .map(|url| url.trim().to_string())
            .filter(|url| !url.is_empty())
            .collect();
    }
    if let Some(value) = patch.restore_queue {
        music.restore_queue = value;
    }
    if let Some(value) = patch.prefetch {
        music.prefetch = value;
    }
    if let Some(value) = patch.overlay_seconds {
        music.overlay_seconds = value.min(600);
    }
    if let Some(value) = &patch.overlay_position {
        music.overlay_position = if value == "bottom" { "bottom" } else { "top" }.to_string();
    }
    if let Some(value) = patch.overlay_font {
        music.overlay_font = value.clamp(12, 48);
    }
    if let Some(value) = &patch.ytdlp_path {
        let value = value.trim().to_string();
        music.ytdlp_path = if value.is_empty() { "auto".to_string() } else { value };
    }
    if let Some(value) = patch.ytdlp_update_days {
        music.ytdlp_update_days = value.min(365);
    }
    if let Some(value) = &patch.cookies_file {
        music.cookies_file = value.trim().to_string();
    }
}

/// Настройки музыки: лимиты очереди, поведение плеера и параметры оверлея.
#[tauri::command]
pub fn set_music_settings(
    core: State<'_, Arc<AppCore>>,
    patch: MusicSettingsPatch,
) -> CoreView {
    {
        let mut inner = core.lock();
        apply_music_patch(&mut inner.settings.music, &patch);
        apply_music_config(&mut inner);
    }
    core.save();
    core.view()
}

/// Выбор награды, из которой приходят заявки на треки.
#[tauri::command]
pub fn set_music_reward(
    core: State<'_, Arc<AppCore>>,
    reward_id: String,
) -> Result<CoreView, String> {
    if reward_id.trim().is_empty() {
        return Err("Не передана награда.".into());
    }
    let reward = {
        core.lock()
            .rewards
            .iter()
            .find(|reward| reward.id == reward_id)
            .cloned()
    };
    let Some(reward) = reward else {
        return Err("Награда не найдена в списке — обновите его на вкладке «Награды».".into());
    };
    {
        let mut inner = core.lock();
        inner.settings.music.reward_id = reward.id.clone();
        inner.settings.music.reward_title = reward.title.clone();
        inner.settings.music.reward_cost = reward.cost.clamp(1, 1_000_000) as u32;
        // Награда должна требовать текст: туда зритель вставляет ссылку.
        if let Some(access) = inner.settings.twitch.access_token() {
            let draft =
                twitch::RewardDraft::new(reward.title.clone(), reward.cost, reward.color.clone())
                    .with_input(true);
            inner.twitch.update_reward(
                &inner.settings.twitch.client_id,
                &access,
                &inner.settings.twitch.user_id,
                &reward.id,
                draft,
            );
        }
        apply_music_config(&mut inner);
    }
    core.save();
    Ok(core.view())
}

/// «Применить цену»: меняет стоимость награды и на Twitch, и локально.
#[tauri::command]
pub fn apply_music_price(core: State<'_, Arc<AppCore>>, cost: i64) -> Result<CoreView, String> {
    if !(1..=1_000_000).contains(&cost) {
        return Err("Цена — от 1 до 1 000 000 баллов.".into());
    }
    let reward_id = { core.lock().settings.music.reward_id.clone() };
    if reward_id.trim().is_empty() {
        return Err("Сначала выберите награду для музыки.".into());
    }
    let reward = {
        core.lock()
            .rewards
            .iter()
            .find(|reward| reward.id == reward_id)
            .cloned()
    };
    let Some(reward) = reward else {
        return Err("Награда не найдена в списке — обновите его на вкладке «Награды».".into());
    };
    {
        let mut inner = core.lock();
        inner.settings.music.reward_cost = cost as u32;
        if let Some(access) = inner.settings.twitch.access_token() {
            let draft =
                twitch::RewardDraft::new(reward.title.clone(), cost, reward.color.clone())
                    .with_input(true);
            inner.twitch.update_reward(
                &inner.settings.twitch.client_id,
                &access,
                &inner.settings.twitch.user_id,
                &reward_id,
                draft,
            );
        }
        apply_music_config(&mut inner);
    }
    core.save();
    Ok(core.view())
}

/// Фоновое выравнивание громкости всех привязанных звуков.
#[tauri::command]
pub fn normalize_volumes(core: State<'_, Arc<AppCore>>) -> CoreView {
    {
        let mut inner = core.lock();
        if !inner.normalizing {
            let files: Vec<(String, PathBuf)> = inner
                .settings
                .twitch_rewards
                .iter()
                .filter(|binding| !binding.path.trim().is_empty())
                .map(|binding| (binding.reward_id.clone(), PathBuf::from(&binding.path)))
                .filter(|(_, path)| path.is_file())
                .collect();
            if files.is_empty() {
                inner.normalize_message =
                    Some("Нет привязанных звуков для выравнивания.".into());
            } else {
                let (sender, receiver) = mpsc::channel();
                inner.normalize_rx = Some(receiver);
                inner.normalizing = true;
                inner.normalize_message = None;
                let _ = thread::Builder::new()
                    .name("reward-sounds-normalize".to_string())
                    .spawn(move || {
                        let mut result = Vec::new();
                        for (reward_id, path) in files {
                            match audio::measure_loudness(&path) {
                                Ok(loudness) => {
                                    let volume = audio::normalization_volume(
                                        loudness,
                                        audio::NORMALIZE_TARGET_RMS,
                                    );
                                    result.push((reward_id, volume as f64));
                                }
                                Err(err) => log::warn!(
                                    "Не удалось измерить громкость {}: {err}",
                                    path.display()
                                ),
                            }
                        }
                        let _ = sender.send(result);
                    });
            }
        }
    }
    core.view()
}

/// Перезапуск аудиовыхода (например, после смены устройства Windows).
#[tauri::command]
pub fn restart_audio(core: State<'_, Arc<AppCore>>) -> CoreView {
    let result = {
        let inner = core.lock();
        inner.audio.restart()
    };
    match result {
        Ok(()) => {
            log::info!("Аудиовыход перезапущен по запросу из интерфейса");
            core.lock().audio_error = None;
        }
        Err(err) => {
            log::warn!("Не удалось перезапустить аудиовыход: {err}");
            core.lock().audio_error = Some(err);
        }
    }
    core.view()
}

/// Короткий тестовый сигнал на текущем устройстве вывода.
#[tauri::command]
pub fn test_audio(core: State<'_, Arc<AppCore>>) -> Result<(), String> {
    let inner = core.lock();
    let device = inner
        .audio
        .snapshot()
        .device
        .unwrap_or_else(|| "устройство по умолчанию".to_string());
    inner.audio.play_test_tone(inner.settings.effective_volume())?;
    log::info!("Звук: тестовый сигнал отправлен на «{device}»");
    Ok(())
}

/// Полный выход из приложения (в обход «закрывать в трей»).
#[tauri::command]
pub fn exit_app(app: AppHandle) {
    log::info!("Выход из приложения по кнопке в интерфейсе");
    app.exit(0);
}

/// Пересобирает конфиг музыкального сервиса из текущих настроек.
fn apply_music_config(inner: &mut Inner) {
    let config = music_config(&inner.settings);
    inner.music.configure(config);
}

fn music_config(settings: &Settings) -> music::Config {
    music::Config {
        enabled: settings.music.enabled,
        reward_id: settings.music.reward_id.clone(),
        max_queue: settings.music.max_queue,
        max_duration_sec: settings.music.max_duration_sec,
        volume: settings.music.volume_f32(),
        pause_yandex: settings.music.pause_yandex,
        request_cooldown_sec: settings.music.request_cooldown_sec,
        blocked_videos: settings.music.blocked_videos.clone(),
        channel: settings.twitch.login.clone(),
        restore_queue: settings.music.restore_queue,
        overlay_seconds: settings.music.overlay_seconds,
        overlay_position: settings.music.overlay_position.clone(),
        overlay_font: settings.music.overlay_font,
        cookies_file: settings.music.cookies_file.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use reward_sounds::config::MusicSettings;

    fn empty_patch() -> MusicSettingsPatch {
        MusicSettingsPatch {
            max_queue: None,
            max_duration_sec: None,
            pause_yandex: None,
            request_cooldown_sec: None,
            blocked_videos: None,
            autodj: None,
            autodj_playlist: None,
            restore_queue: None,
            prefetch: None,
            overlay_seconds: None,
            overlay_position: None,
            overlay_font: None,
            ytdlp_path: None,
            ytdlp_update_days: None,
            cookies_file: None,
        }
    }

    #[test]
    fn music_patch_clamps_values() {
        let mut music = MusicSettings::default();
        let patch = MusicSettingsPatch {
            max_queue: Some(0),
            max_duration_sec: Some(1),
            overlay_seconds: Some(10_000),
            overlay_position: Some("sideways".to_string()),
            overlay_font: Some(2),
            ytdlp_path: Some("   ".to_string()),
            ytdlp_update_days: Some(999),
            ..empty_patch()
        };
        apply_music_patch(&mut music, &patch);
        assert_eq!(music.max_queue, 1);
        assert_eq!(music.max_duration_sec, 60);
        assert_eq!(music.overlay_seconds, 600);
        assert_eq!(music.overlay_position, "top");
        assert_eq!(music.overlay_font, 12);
        assert_eq!(music.ytdlp_path, "auto");
        assert_eq!(music.ytdlp_update_days, 365);

        let patch = MusicSettingsPatch {
            max_queue: Some(500),
            overlay_position: Some("bottom".to_string()),
            ..empty_patch()
        };
        apply_music_patch(&mut music, &patch);
        assert_eq!(music.max_queue, 50);
        assert_eq!(music.overlay_position, "bottom");
    }

    #[test]
    fn music_patch_keeps_untouched_fields() {
        let mut music = MusicSettings::default();
        music.max_queue = 7;
        music.overlay_font = 20;
        let patch = MusicSettingsPatch {
            pause_yandex: Some(false),
            ..empty_patch()
        };
        apply_music_patch(&mut music, &patch);
        assert!(!music.pause_yandex);
        assert_eq!(music.max_queue, 7);
        assert_eq!(music.overlay_font, 20);
    }

    #[test]
    fn music_config_maps_settings() {
        let mut settings = Settings::default();
        settings.music.enabled = false;
        settings.music.reward_id = "reward-1".to_string();
        settings.music.max_queue = 12;
        settings.music.max_duration_sec = 300;
        settings.music.pause_yandex = false;
        settings.music.restore_queue = false;
        settings.music.overlay_seconds = 0;
        settings.music.overlay_position = "bottom".to_string();
        settings.music.overlay_font = 22;
        settings.twitch.login = "streamer".to_string();

        let config = music_config(&settings);
        assert!(!config.enabled);
        assert_eq!(config.reward_id, "reward-1");
        assert_eq!(config.max_queue, 12);
        assert_eq!(config.max_duration_sec, 300);
        assert!(!config.pause_yandex);
        assert!(!config.restore_queue);
        assert_eq!(config.overlay_seconds, 0);
        assert_eq!(config.overlay_position, "bottom");
        assert_eq!(config.overlay_font, 22);
        assert_eq!(config.channel, "streamer");
    }

    #[test]
    fn sound_path_validation_rejects_bad_files() {
        assert!(validate_sound_path("").is_err());
        assert!(validate_sound_path("C:\\definitely\\missing.mp3").is_err());

        let unsupported = std::env::temp_dir().join("reward-sounds-test.txt");
        std::fs::write(&unsupported, b"x").unwrap();
        assert!(validate_sound_path(&unsupported.display().to_string()).is_err());
        std::fs::remove_file(&unsupported).ok();

        let empty = std::env::temp_dir().join("reward-sounds-test-empty.mp3");
        std::fs::write(&empty, b"").unwrap();
        assert!(validate_sound_path(&empty.display().to_string()).is_err());
        std::fs::remove_file(&empty).ok();

        let valid = std::env::temp_dir().join("reward-sounds-test-valid.mp3");
        std::fs::write(&valid, b"ID3").unwrap();
        assert!(validate_sound_path(&valid.display().to_string()).is_ok());
        std::fs::remove_file(&valid).ok();
    }

    #[test]
    fn accent_color_validation() {
        assert_eq!(normalize_accent("#8b00ff").unwrap(), "#8B00FF");
        assert_eq!(normalize_accent("  #22C55E ").unwrap(), "#22C55E");
        assert!(normalize_accent("8B00FF").is_err());
        assert!(normalize_accent("#8B00F").is_err());
        assert!(normalize_accent("#GGGGGG").is_err());
        assert!(normalize_accent("#8B00FF00").is_err());
    }
}
