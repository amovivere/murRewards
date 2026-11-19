//! Главное окно приложения и весь интерфейс.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use eframe::egui;
use egui::{Align, Align2, Color32, FontId, Layout, RichText, Rounding, Sense, Stroke, Vec2};

use crate::audio::{self, AudioEngine, Status as AudioStatus};
use crate::autostart;
use crate::config::{AppPaths, Settings};
use crate::eventsub;
use crate::logging::{LogEntry, Logger};
use crate::music::{self, ItemState, MusicEvent};
use crate::theme::*;
use crate::tray;
use crate::twitch::{self, TwitchUser};
use crate::util;
use crate::window_ops;
use crate::playback;

const DASHBOARD_URL: &str = "https://dashboard.twitch.tv/community/channel-points/rewards";
const TOAST_INFO_SECS: u64 = 6;
const TOAST_WARN_SECS: u64 = 9;
const TOAST_ERROR_SECS: u64 = 11;

/// Разделы приложения.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Tab {
    Rewards,
    Music,
    Settings,
    Log,
}

/// Состояние подключения к Twitch для интерфейса.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TwitchState {
    Disconnected,
    Busy,
    Waiting,
    Connected,
}

/// Состояние прослушивания активаций наград (EventSub).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum EventSubState {
    Stopped,
    Connecting,
    Listening,
}

/// Выданный код подтверждения.
struct TwitchCodeView {
    user_code: String,
    verification_uri: String,
    expires_at: Instant,
}

/// Тип уведомления в нижней строке.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ToastKind {
    Info,
    Success,
    Warning,
    Error,
}

/// Состояние окна создания/изменения награды.
#[derive(Clone)]
struct RewardEditor {
    /// `None` — создание новой награды.
    id: Option<String>,
    title: String,
    cost: i64,
    color: [u8; 3],
    /// Выбранный звук (путь к файлу), если пользователь добавил его сразу.
    sound: Option<String>,
    error: Option<String>,
    pending: bool,
    /// Нужно ли поставить фокус в поле названия при первом показе.
    focus_title: bool,
}

struct Toast {
    text: String,
    kind: ToastKind,
    until: Instant,
}

/// Сортировка списка наград.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RewardSort {
    Default,
    PriceDesc,
    PriceAsc,
    Title,
}

impl RewardSort {
    fn label(self) -> &'static str {
        match self {
            RewardSort::Default => "Все награды",
            RewardSort::PriceDesc => "Сначала дорогие",
            RewardSort::PriceAsc => "Сначала дешёвые",
            RewardSort::Title => "По названию",
        }
    }
}

/// Фильтр списка наград.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RewardFilter {
    All,
    WithSound,
    WithoutSound,
    Playing,
    Disabled,
}

impl RewardFilter {
    fn label(self) -> &'static str {
        match self {
            RewardFilter::All => "Все",
            RewardFilter::WithSound => "Со звуком",
            RewardFilter::WithoutSound => "Без звука",
            RewardFilter::Playing => "Играет",
            RewardFilter::Disabled => "Выключенные",
        }
    }
}

/// Закэшированные сведения о файле звука.
#[derive(Clone)]
struct CachedFile {
    exists: bool,
    size: u64,
    duration_sec: Option<u64>,
    checked_at: Instant,
}

impl CachedFile {
    fn duration_label(&self) -> String {
        match self.duration_sec {
            Some(seconds) => format!(
                "{}:{:02}",
                seconds / 60,
                seconds % 60
            ),
            None => "—".to_string(),
        }
    }
}

/// Кэш проверок файлов: карточки не должны дергать диск каждый кадр.
const FILE_CACHE_TTL: Duration = Duration::from_secs(3);

/// Что подтверждает пользователь во всплывающем окне.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ConfirmAction {
    DisconnectTwitch,
    NormalizeVolumes,
    ClearMusicQueue,
}

struct ConfirmDialog {
    title: String,
    text: String,
    confirm_label: String,
    action: ConfirmAction,
    danger: bool,
}




/// Действие с наградой, выбранное пользователем.
#[derive(Debug, Clone, PartialEq)]
enum RewardUiAction {
    Bind { reward_id: String, title: String },
    Clear { reward_id: String },
    Play { reward_id: String, path: String },
    Edit { reward: twitch::RemoteReward },
    Delete { reward: twitch::RemoteReward },
    SetVolume { reward_id: String, volume: f64 },
}

pub struct RewardSoundsApp {
    settings: Settings,
    paths: AppPaths,
    engine: AudioEngine,
    logger: Arc<Logger>,
    audio: AudioStatus,
    playing: Vec<String>,
    tab: Tab,
    toast: Option<Toast>,
    save_at: Option<Instant>,
    wake_until: Option<Instant>,
    logs: Vec<LogEntry>,
    log_refresh_at: Instant,
    remote_rewards: Vec<twitch::RemoteReward>,
    rewards_loading: bool,
    rewards_error: Option<String>,
    rewards_loaded_at: Option<Instant>,
    pending_rewards_fetch: bool,
    twitch_service: twitch::Service,
    twitch_state: TwitchState,
    twitch_code: Option<TwitchCodeView>,
    twitch_progress: Option<String>,
    twitch_error: Option<String>,
    eventsub_service: eventsub::Service,
    eventsub_state: EventSubState,
    eventsub_error: Option<String>,
    pending_eventsub_start: bool,
    tray: tray::Tray,
    playback_state: Arc<Mutex<playback::PlaybackState>>,
    window_visible: bool,
    allow_close: bool,
    tray_check_at: Option<Instant>,
    reward_editor: Option<RewardEditor>,
    /// Звук, выбранный в окне создания: привяжем, когда Twitch вернёт ID.
    pending_created_sound: Option<String>,
    reward_delete: Option<twitch::RemoteReward>,
    reward_busy: bool,
    normalizing: bool,
    normalize_rx: Option<std::sync::mpsc::Receiver<Vec<(String, f64)>>>,
    hide_on_start: bool,
    /// Служба треков по заявке.
    music: music::MusicService,
    /// Её состояние для отрисовки.
    music_snapshot: music::Snapshot,
    /// Когда в следующий раз опрашивать службу.
    music_poll_at: Instant,
    /// Поле цены награды в интерфейсе.
    music_cost_input: String,
    /// Системная рамка окна уже убрана.
    decorations_removed: bool,
    /// Раскрыты настройки на вкладке «Музыка».
    music_settings_open: bool,
    /// Открыто окно настроек оверлея для OBS.
    obs_window_open: bool,
    /// Поиск по наградам на вкладке «Награды».
    search: String,
    /// Активный фильтр списка наград.
    reward_filter: RewardFilter,
    /// Сортировка списка наград.
    reward_sort: RewardSort,
    /// Показывать выключенные и недоступные награды.
    disabled_open: bool,
    /// Кэш проверок файлов звуков (is_file/размер/длительность).
    file_cache: HashMap<String, CachedFile>,
    /// Диалог подтверждения опасного действия.
    confirm: Option<ConfirmDialog>,
    /// Когда настройки были сохранены — для индикатора в «Настройках».
    saved_at: Option<Instant>,
    /// Показывать отладочные записи в журнале.
    log_show_debug: bool,
    /// Показывать только ошибки и предупреждения в журнале.
    log_errors_only: bool,
    /// Поле ручной ссылки на вкладке «Музыка».
    music_manual_input: String,
    /// Открыто окно «Награда и цена» на вкладке «Музыка».
    music_price_open: bool,
    /// Показаны все локальные привязки (а не первые три).
    local_bindings_open: bool,
    /// Демо-режим для скриншотов: подставляет примеры вместо живого Twitch.
    demo: bool,
}

impl RewardSoundsApp {
    pub fn new(
        cc: &eframe::CreationContext<'_>,
        paths: AppPaths,
        logger: Arc<Logger>,
        start_hidden: bool,
    ) -> Self {
        let (mut settings, warning) = Settings::load(&paths.config_file);
        settings.autostart = autostart::is_enabled();
        log::info!(
            "Настройки загружены: {} {}, громкость {}, {}",
            settings.twitch_rewards.len(),
            util::plural_ru(settings.twitch_rewards.len(), "привязка", "привязки", "привязок"),
            settings.volume_label(),
            if settings.muted { "режим «без звука»" } else { "звук включён" }
        );

        let demo = std::env::var_os("REWARD_SOUNDS_DEMO").is_some();
        let engine = AudioEngine::spawn();
        let playback_enabled = settings.playback_enabled;
        let playback_state = Arc::new(Mutex::new(playback::PlaybackState::default()));
        if let Ok(mut state) = playback_state.lock() {
            state.sync(&settings);
        }
        let eventsub_playback = playback::Playback::new(engine.clone(), Arc::clone(&playback_state));

        // Служба треков по заявке: запускаем сразу, но играть будет только
        // при включённой вкладке и настроенной награде.
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
            cookies_file: settings.music.cookies_file.clone(),
        };
        let music_temp = paths.data_dir.join("tmp");
        let music_service = music::MusicService::spawn(
            music_config,
            settings.music.ytdlp_path.clone(),
            music_temp,
        );
        let music_cost_input = settings.music.reward_cost.to_string();

        let mut app = Self {
            settings,
            paths,
            engine,
            logger,
            audio: AudioStatus::default(),
            playing: Vec::new(),
            tab: Tab::Rewards,
            toast: None,
            save_at: None,
            wake_until: None,
            logs: Vec::new(),
            log_refresh_at: Instant::now(),
            remote_rewards: Vec::new(),
            rewards_loading: false,
            rewards_error: None,
            rewards_loaded_at: None,
            pending_rewards_fetch: false,
            twitch_service: twitch::Service::spawn(),
            twitch_state: TwitchState::Disconnected,
            twitch_code: None,
            twitch_progress: None,
            twitch_error: None,
            eventsub_service: eventsub::Service::spawn(
                eventsub_playback,
                cc.egui_ctx.clone(),
            ),
            eventsub_state: EventSubState::Stopped,
            eventsub_error: None,
            pending_eventsub_start: false,
            tray: if demo {
                tray::Tray::disabled()
            } else {
                tray::Tray::spawn(playback_enabled, cc.egui_ctx.clone())
            },
            playback_state: Arc::clone(&playback_state),
            window_visible: !start_hidden,
            allow_close: false,
            tray_check_at: Some(Instant::now() + Duration::from_secs(4)),
            reward_editor: None,
            pending_created_sound: None,
            reward_delete: None,
            reward_busy: false,
            normalizing: false,
            normalize_rx: None,
            hide_on_start: start_hidden,
            music: music_service,
            music_snapshot: music::Snapshot::default(),
            music_poll_at: Instant::now(),
            music_cost_input,
            decorations_removed: false,
            music_settings_open: false,
            obs_window_open: false,
            search: String::new(),
            reward_filter: RewardFilter::All,
            reward_sort: RewardSort::Default,
            disabled_open: false,
            file_cache: HashMap::new(),
            confirm: None,
            saved_at: None,
            log_show_debug: false,
            log_errors_only: false,
            music_manual_input: String::new(),
            music_price_open: false,
            local_bindings_open: false,
            demo,
        };

        if let Some(warning) = warning {
            app.notify(warning, ToastKind::Warning);
        }
        if app.demo {
            app.apply_demo();
        } else {
            app.restore_twitch_session();
        }



        app
    }

    // ---------- состояние / служебное ----------


    /// Наполняет интерфейс примерами для скриншотов и визуальной проверки.
    fn apply_demo(&mut self) {
        let demo_dir = self.paths.data_dir.join("tmp").join("demo");
        let files = ensure_demo_sounds(&demo_dir);

        self.settings.twitch.client_id = "demo0000000000000000000000aa".to_string();
        self.settings.twitch.user_id = "130450087".to_string();
        self.settings.twitch.login = "goshanmur".to_string();
        self.settings.twitch.display_name = "goshanmur".to_string();
        self.settings.grid_view = true;
        self.twitch_state = TwitchState::Connected;
        self.eventsub_state = EventSubState::Listening;

        let reward = |id: &str, title: &str, cost: i64, color: &str, enabled: bool, paused: bool| {
            twitch::RemoteReward {
                id: id.to_string(),
                title: title.to_string(),
                cost,
                is_enabled: enabled,
                is_paused: paused,
                is_in_stock: true,
                color: color.to_string(),
                requires_input: false,
            }
        };
        self.remote_rewards = vec![
            reward("demo-newbie", "Ты новичок?", 200, "#FF5A5F", true, false),
            reward("demo-like", "Мне нравится как он", 150, "#4E7CFF", true, false),
            reward("demo-shiza", "Шиза", 250, "#A970FF", true, false),
            reward("demo-run", "Беги", 200, "#22C55E", true, false),
            reward("demo-shot", "Выстрел", 50, "#5B6CFF", true, false),
            reward("demo-laugh", "Смешок", 200, "#22B8CF", true, false),
            reward("demo-music", "МУЗЫКА ЮТУБ", 50, "#FF4FA3", true, false),
            reward("demo-donats", "А где донаты", 100, "#2BC48A", true, false),
            reward("demo-morning", "Доброе утро", 150, "#F59E0B", true, false),
            reward("demo-donate", "Звук доната", 300, "#8B5CF6", true, false),
            reward("demo-off", "Сказануть что-то", 250, "#7C7C7C", false, false),
            reward("demo-paused", "Слишком дорого", 1000000, "#8A8A8A", true, true),
        ];

        let paths: Vec<String> = files.iter().map(|path| path.display().to_string()).collect();
        let names = ["newbie.wav", "like.wav", "shiza.wav", "run.wav", "shot.wav"];
        let mut bindings = Vec::new();
        for (index, (id, title, volume)) in [
            ("demo-newbie", "Ты новичок?", 2.0_f64),
            ("demo-like", "Мне нравится как он", 1.8),
            ("demo-shiza", "Шиза", 0.46),
            ("demo-run", "Беги", 1.33),
            ("demo-shot", "Выстрел", 1.0),
            ("demo-laugh", "Смешок", 0.9),
            ("demo-donate", "Звук доната", 1.2),
        ]
        .iter()
        .enumerate()
        {
            let path = &paths[index % paths.len()];
            bindings.push(crate::config::RewardSound {
                reward_id: id.to_string(),
                title: title.to_string(),
                path: path.clone(),
                volume: *volume,
            });
            let _ = names;
        }
        self.settings.twitch_rewards = bindings;
        self.file_cache.clear();

        self.settings.music.enabled = true;
        self.settings.music.reward_id = "demo-music".to_string();
        self.settings.music.reward_title = "МУЗЫКА ЮТУБ".to_string();
        self.settings.music.reward_cost = 50;
        self.settings.music.music_volume = 0.3;
        self.music_cost_input = "50".to_string();

        let item = |id: &str, title: &str, user: &str, duration: u64, state: music::ItemState| {
            music::QueueItem {
                redemption_id: id.to_string(),
                video_id: format!("video-{id}"),
                url: "https://www.youtube.com/watch?v=demo".to_string(),
                title: title.to_string(),
                channel: "YouTube".to_string(),
                duration_sec: duration,
                user_login: user.to_string(),
                redeemed_at: "2026-11-16T22:00:00Z".to_string(),
                state,
                attempts: 0,
                error: None,
            }
        };
        let current = item("demo-1", "ДИНАСТИЯ — Земляк", "nix", 164, music::ItemState::Playing);
        let queued = item(
            "demo-2",
            "Vulvas — Kanye West",
            "goshanmur",
            214,
            music::ItemState::Loading,
        );
        let next = item("demo-3", "run.mp3", "goshanmur", 6, music::ItemState::Queued);
        let done = item("demo-4", "Ты новичок?", "newbie", 8, music::ItemState::Done);
        self.music_snapshot = music::Snapshot {
            enabled: true,
            items: vec![current.clone(), queued, next, done],
            player: music::PlayerState {
                loaded: true,
                paused: false,
                finished: false,
                generation: 1,
                position_sec: 58,
                duration_sec: 164,
                volume: 0.3,
                error: None,
            },
            current: Some(current),
            prefetched: Some("Vulvas".to_string()),
            ytdlp_version: Some("2026.10.26".to_string()),
            ytdlp_path: Some("yt-dlp.exe".to_string()),
            overlay_ms: 8000,
            overlay_position: "top".to_string(),
            overlay_font: 17,
            error: None,
            chat_online: true,
            overlay_ready: true,
        };
        if let Some(tab) = std::env::var_os("REWARD_SOUNDS_DEMO_TAB") {
            match tab.to_string_lossy().to_lowercase().as_str() {
                "music" => self.tab = Tab::Music,
                "settings" => self.tab = Tab::Settings,
                "log" => self.tab = Tab::Log,
                _ => {}
            }
        }
        if std::env::var_os("REWARD_SOUNDS_DEMO_LIST").is_some() {
            self.settings.grid_view = false;
        }
        if std::env::var_os("REWARD_SOUNDS_DEMO_OFFLINE").is_some() {
            // Для скриншота первого запуска: локальные привязки есть, Twitch нет.
            self.settings.twitch.clear_session();
            self.settings.twitch.login.clear();
            self.settings.twitch.display_name.clear();
            self.settings.twitch.user_id.clear();
            self.twitch_state = TwitchState::Disconnected;
            self.eventsub_state = EventSubState::Stopped;
        }
        if let Some(what) = std::env::var_os("REWARD_SOUNDS_DEMO_OPEN") {
            match what.to_string_lossy().to_lowercase().as_str() {
                "editor" => self.open_create_reward(),
                "obs" => self.obs_window_open = true,
                _ => {}
            }
        }
        log::info!("Включён демо-режим: данные для скриншотов");
    }

    fn notify(&mut self, text: impl Into<String>, kind: ToastKind) {
        let text = text.into();
        let seconds = match kind {
            ToastKind::Error => TOAST_ERROR_SECS,
            ToastKind::Warning => TOAST_WARN_SECS,
            _ => TOAST_INFO_SECS,
        };
        match kind {
            ToastKind::Error => log::error!("{text}"),
            ToastKind::Warning => log::warn!("{text}"),
            ToastKind::Success => log::info!("{text}"),
            ToastKind::Info => log::info!("{text}"),
        }
        self.toast = Some(Toast {
            text,
            kind,
            until: Instant::now() + Duration::from_secs(seconds),
        });
        self.touch();
    }

    /// Просит интерфейс перерисоваться ещё немного (нужно, чтобы успеть
    /// показать изменения статуса аудио и скрыть уведомление).
    fn touch(&mut self) {
        self.wake_until = Some(Instant::now() + Duration::from_millis(1200));
    }

    fn busy(&self) -> bool {
        !self.playing.is_empty()
            || self.toast.is_some()
            || self.save_at.is_some()
            || self
                .wake_until
                .map(|until| Instant::now() < until)
                .unwrap_or(false)
            || matches!(self.twitch_state, TwitchState::Busy | TwitchState::Waiting)
            || self.eventsub_state == EventSubState::Connecting
    }

    // ---------- системный трей ----------

    fn show_window(&mut self, ctx: &egui::Context) {
        window_ops::show_from_tray();
        ctx.send_viewport_cmd(egui::ViewportCommand::Focus);
        self.window_visible = true;
        self.touch();
        log::info!("Окно открыто из трея");
    }

    fn hide_to_tray(&mut self, _ctx: &egui::Context) {
        window_ops::hide_to_tray();
        self.window_visible = false;
        self.touch();
        log::info!("Окно свёрнуто в трей");
    }

    fn set_playback_enabled(&mut self, enabled: bool) {
        self.settings.playback_enabled = enabled;
        self.tray.set_enabled(enabled);
        if !enabled {
            if let Err(err) = self.engine.stop_all() {
                log::warn!("Не удалось остановить звуки: {err}");
            }
            self.notify(
                "Звуки наград выключены. Включить можно в трее или в настройках.",
                ToastKind::Info,
            );
        } else {
            self.notify("Звуки наград включены.", ToastKind::Info);
        }
        self.mark_dirty();
        self.touch();
    }

    fn poll_tray(&mut self, ctx: &egui::Context) {
        for event in self.tray.poll() {
            match event {
                tray::Event::Open => self.show_window(ctx),
                tray::Event::TogglePlayback => {
                    self.set_playback_enabled(!self.settings.playback_enabled)
                }
                tray::Event::StopAll => {
                    if let Err(err) = self.engine.stop_all() {
                        self.notify(err, ToastKind::Error);
                    }
                    self.touch();
                }
                tray::Event::Exit => {
                    self.allow_close = true;
                    self.save_now();
                    ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                }
            }
        }
    }

    fn poll_audio(&mut self) {
        self.audio = self.engine.snapshot();
        self.playing = self
            .audio
            .active
            .iter()
            .filter(|id| !id.starts_with("__"))
            .cloned()
            .collect();

        for message in self.engine.take_errors() {
            self.notify(message, ToastKind::Error);
        }
    }

    // ---------- Twitch ----------

    /// Восстанавливает сохранённый вход при запуске.
    fn restore_twitch_session(&mut self) {
        if !self.settings.twitch.has_session() {
            return;
        }

        if self.settings.twitch.refresh_token().is_none()
            && self.settings.twitch.access_token().is_none()
        {
            log::warn!("Twitch: сохранённый вход недоступен (другая учётная запись Windows?)");
            self.settings.twitch.clear_session();
            self.mark_dirty();
            self.notify(
                "Сохранённый вход в Twitch не читается. Подключите аккаунт заново.",
                ToastKind::Warning,
            );
            return;
        }

        if twitch::token_expired_or_soon(self.settings.twitch.expires_at) {
            if let Some(refresh) = self.settings.twitch.refresh_token() {
                if self.settings.twitch.has_client_id() {
                    log::info!("Twitch: обновляем истёкший токен");
                    self.twitch_state = TwitchState::Busy;
                    self.twitch_progress = Some("Обновляем вход в Twitch…".to_string());
                    let client_id = self.settings.twitch.client_id.clone();
                    self.twitch_service.refresh(&client_id, &refresh);
                    return;
                }
            }
            log::warn!("Twitch: недостаточно данных для обновления входа, нужен повторный вход");
            self.settings.twitch.clear_session();
            self.mark_dirty();
        } else if self.settings.twitch.is_connected() {
            self.twitch_state = TwitchState::Connected;
            log::info!(
                "Twitch: восстановлен вход для @{}",
                self.settings.twitch.login
            );
            self.fetch_reward_list();
            self.start_eventsub();
        }
    }

    fn poll_twitch(&mut self) {
        if self.demo {
            return;
        }
        for event in self.twitch_service.poll() {
            match event {
                twitch::Event::RedemptionStatusSet {
                    redemption_id,
                    status,
                } => {
                    log::info!("Twitch: активация {redemption_id} — {status}");
                }
                twitch::Event::RedemptionStatusFailed {
                    redemption_id,
                    message,
                } => {
                    log::warn!("Twitch: активация {redemption_id} не обновлена: {message}");
                }
                twitch::Event::CodeReady {
                    user_code,
                    verification_uri,
                    expires_in,
                } => {
                    log::info!("Twitch: выдан код подтверждения (действует {expires_in} с)");
                    let opened = webbrowser::open(&verification_uri).is_ok();
                    self.twitch_code = Some(TwitchCodeView {
                        user_code: user_code.clone(),
                        verification_uri,
                        expires_at: Instant::now() + Duration::from_secs(expires_in),
                    });
                    self.twitch_state = TwitchState::Waiting;
                    self.twitch_error = None;
                    self.twitch_progress = None;
                    if opened {
                        self.notify(
                            format!(
                                "Код для Twitch: {user_code}. Введите его на открывшейся странице."
                            ),
                            ToastKind::Info,
                        );
                    } else {
                        self.notify(
                            format!(
                                "Код для Twitch: {user_code}. Откройте twitch.tv/activate вручную."
                            ),
                            ToastKind::Info,
                        );
                    }
                    self.touch();
                }
                twitch::Event::Progress(text) => {
                    self.twitch_progress = Some(text);
                    self.touch();
                }
                twitch::Event::Authorized { user, tokens } => {
                    self.twitch_state = TwitchState::Connected;
                    self.twitch_code = None;
                    self.twitch_progress = None;
                    self.twitch_error = None;
                    self.commit_twitch_session(&user, &tokens);
                    self.notify(
                        format!("Twitch подключён: {}", user.display_name),
                        ToastKind::Success,
                    );
                    self.fetch_reward_list();
                    self.start_eventsub();
                }
                twitch::Event::Refreshed { user, tokens } => {
                    self.twitch_state = TwitchState::Connected;
                    self.twitch_progress = None;
                    self.twitch_error = None;
                    self.commit_twitch_session(&user, &tokens);
                    if self.pending_rewards_fetch || self.remote_rewards.is_empty() {
                        self.pending_rewards_fetch = false;
                        self.fetch_reward_list();
                    }
                    if self.pending_eventsub_start || self.eventsub_state == EventSubState::Stopped {
                        self.pending_eventsub_start = false;
                        self.start_eventsub();
                    }
                    self.touch();
                }
                twitch::Event::RewardsLoaded { rewards } => {
                    let count = rewards.len();
                    self.remote_rewards = rewards;
                    self.rewards_loading = false;
                    self.rewards_error = None;
                    self.rewards_loaded_at = Some(Instant::now());
                    log::info!("Twitch: список наград обновлён ({count})");
                    self.touch();
                }
                twitch::Event::RewardsUnauthorized => {
                    self.rewards_loading = false;
                    log::warn!("Twitch: токен не принят при загрузке наград");
                    if self.settings.twitch.refresh_token().is_some() {
                        self.pending_rewards_fetch = true;
                        self.refresh_twitch_silently();
                    } else {
                        self.rewards_error = Some(
                            "Нужно заново подключить Twitch, чтобы загрузить награды.".to_string(),
                        );
                    }
                    self.touch();
                }
                twitch::Event::RewardsFailed(message) => {
                    self.rewards_loading = false;
                    self.rewards_error = Some(message.clone());
                    self.notify(message, ToastKind::Error);
                }
                twitch::Event::RewardCreated { id, title } => {
                    self.reward_busy = false;
                    self.reward_editor = None;
                    if let Some(path) = self.pending_created_sound.take() {
                        if id.is_empty() {
                            self.notify(
                                "Награда создана, но Twitch не вернул её ID — привяжите звук вручную.",
                                ToastKind::Warning,
                            );
                        } else if Path::new(&path).is_file() {
                            self.settings.set_reward_sound(&id, &title, &path);
                            self.mark_dirty();
                            log::info!("Награда {id}: звук привязан при создании");
                        } else {
                            self.notify(
                                "Награда создана, но выбранный файл звука пропал.",
                                ToastKind::Warning,
                            );
                        }
                    }
                    self.notify(format!("Награда «{title}» создана."), ToastKind::Success);
                    // Список на Twitch уже изменился — подтягиваем его, чтобы
                    // карточка появилась сразу, а не после ручного «Обновить».
                    self.fetch_reward_list();
                    self.touch();
                }
                twitch::Event::RewardUpdated { id, title } => {
                    self.reward_busy = false;
                    self.reward_editor = None;
                    let mut renamed = false;
                    if let Some(reward) = self
                        .settings
                        .twitch_rewards
                        .iter_mut()
                        .find(|reward| reward.reward_id == id)
                    {
                        reward.title = title.clone();
                        renamed = true;
                    }
                    if renamed {
                        self.mark_dirty();
                    }
                    self.notify(format!("Награда «{title}» изменена."), ToastKind::Success);
                    self.fetch_reward_list();
                    self.touch();
                }
                twitch::Event::RewardDeleted(title) => {
                    self.reward_busy = false;
                    self.reward_delete = None;
                    self.notify(format!("Награда «{title}» удалена."), ToastKind::Success);
                    self.fetch_reward_list();
                    self.touch();
                }
                twitch::Event::RewardManageUnauthorized => {
                    self.reward_busy = false;
                    self.pending_created_sound = None;
                    if let Some(editor) = &mut self.reward_editor {
                        editor.pending = false;
                        editor.error = Some(
                            "Twitch не дал право управлять наградами. Переподключите аккаунт в настройках."
                                .to_string(),
                        );
                    }
                    self.notify(
                        "Нужно переподключить Twitch: добавлено право управлять наградами.",
                        ToastKind::Warning,
                    );
                    self.touch();
                }
                twitch::Event::RewardManageFailed(message) => {
                    self.reward_busy = false;
                    self.pending_created_sound = None;
                    if let Some(editor) = &mut self.reward_editor {
                        editor.pending = false;
                        editor.error = Some(message.clone());
                    }
                    self.notify(message, ToastKind::Error);
                    self.touch();
                }
                twitch::Event::SessionExpired(message) => {
                    log::warn!("Twitch: сессия истекла, требуется повторный вход");
                    self.twitch_state = TwitchState::Disconnected;
                    self.twitch_progress = None;
                    self.twitch_code = None;
                    self.twitch_error = Some(message.clone());
                    self.settings.twitch.clear_session();
                    self.reset_rewards_state();
                    self.stop_eventsub();
                    self.mark_dirty();
                    self.notify(message, ToastKind::Warning);
                }
                twitch::Event::LoggedOut => {
                    self.settings.twitch.clear_session();
                    self.twitch_state = TwitchState::Disconnected;
                    self.twitch_code = None;
                    self.twitch_progress = None;
                    self.reset_rewards_state();
                    self.stop_eventsub();
                    self.mark_dirty();
                    self.notify("Twitch отключён.", ToastKind::Info);
                }
                twitch::Event::Failed(message) => {
                    log::warn!("Twitch: {message}");
                    self.twitch_state = TwitchState::Disconnected;
                    self.twitch_code = None;
                    self.twitch_progress = None;
                    self.twitch_error = Some(message.clone());
                    self.rewards_loading = false;
                    self.stop_eventsub();
                    self.notify(message, ToastKind::Error);
                }
            }
        }
    }

    fn reset_rewards_state(&mut self) {
        self.remote_rewards.clear();
        self.rewards_loading = false;
        self.rewards_error = None;
        self.rewards_loaded_at = None;
        self.pending_rewards_fetch = false;
    }

    /// Запрашивает список наград у Twitch (в фоне).
    fn fetch_reward_list(&mut self) {
        if self.rewards_loading || !self.settings.twitch.is_connected() {
            return;
        }
        if self.settings.twitch.user_id.trim().is_empty() {
            return;
        }
        let Some(access) = self.settings.twitch.access_token() else {
            self.rewards_error = Some(
                "Не удалось прочитать сохранённый токен. Подключите Twitch заново.".to_string(),
            );
            return;
        };

        self.rewards_loading = true;
        self.rewards_error = None;
        self.twitch_service.fetch_rewards(
            &self.settings.twitch.client_id,
            &access,
            &self.settings.twitch.user_id,
        );
        self.touch();
    }

    /// Тихо обновляет токен (например, когда истёк при загрузке наград).
    fn refresh_twitch_silently(&mut self) {
        let client_id = self.settings.twitch.client_id.clone();
        if let Some(refresh) = self.settings.twitch.refresh_token() {
            self.twitch_progress = Some("Обновляем вход в Twitch…".to_string());
            self.twitch_state = TwitchState::Busy;
            self.twitch_service.refresh(&client_id, &refresh);
            self.touch();
        }
    }

    /// Начинает слушать активации наград через EventSub.
    fn start_eventsub(&mut self) {
        if !self.settings.twitch.is_connected() {
            return;
        }
        if self.settings.twitch.user_id.trim().is_empty() {
            return;
        }
        let Some(access) = self.settings.twitch.access_token() else {
            self.eventsub_error =
                Some("Не удалось прочитать сохранённый токен Twitch.".to_string());
            return;
        };

        self.eventsub_state = EventSubState::Connecting;
        self.eventsub_error = None;
        self.eventsub_service.start(
            &self.settings.twitch.client_id,
            &access,
            &self.settings.twitch.user_id,
        );
        log::info!("EventSub: подключаемся к Twitch");
        self.touch();
    }

    fn stop_eventsub(&mut self) {
        self.eventsub_service.stop();
        self.eventsub_state = EventSubState::Stopped;
        self.eventsub_error = None;
        self.pending_eventsub_start = false;
    }

    /// Текст и цвет статуса прослушивания наград.
    fn eventsub_status(&self) -> (&'static str, Color32) {
        match self.eventsub_state {
            EventSubState::Listening => ("Слушаем награды", SUCCESS),
            EventSubState::Connecting => ("Переподключение…", WARN),
            EventSubState::Stopped => ("Не слушаем", TEXT_DIM),
        }
    }

    fn poll_eventsub(&mut self) {
        if self.demo {
            return;
        }
        for event in self.eventsub_service.poll() {
            match event {
                eventsub::Event::Connected => {
                    self.eventsub_state = EventSubState::Listening;
                    self.eventsub_error = None;
                    log::info!("EventSub: слушаем активации наград");
                    self.touch();
                }
                eventsub::Event::Redemption(redemption) => self.handle_redemption(redemption),
                eventsub::Event::Disconnected(message) => {
                    self.eventsub_state = EventSubState::Connecting;
                    self.eventsub_error = Some(message.clone());
                    log::warn!("EventSub: переподключение ({message})");
                    self.touch();
                }
                eventsub::Event::Revoked(message) => {
                    self.eventsub_state = EventSubState::Connecting;
                    self.eventsub_error = Some(message.clone());
                    self.notify(message, ToastKind::Warning);
                    self.touch();
                }
                eventsub::Event::Unauthorized => {
                    self.eventsub_state = EventSubState::Stopped;
                    self.eventsub_error =
                        Some("Нужно обновить вход в Twitch.".to_string());
                    self.pending_eventsub_start = true;
                    self.refresh_twitch_silently();
                }
                eventsub::Event::Failed(message) => {
                    self.eventsub_state = EventSubState::Stopped;
                    self.eventsub_error = Some(message.clone());
                    self.notify(message, ToastKind::Error);
                }
            }
        }
    }

    /// Зритель активировал награду: играем привязанный звук.
    /// Зритель активировал награду: звук запускает сервис EventSub,
    /// здесь только обновляем журнал и интерфейс.
    fn handle_redemption(&mut self, redemption: eventsub::Redemption) {
        log::info!(
            "Награда активирована: «{}» (@{})",
            redemption.reward_title,
            redemption.user_login
        );

        // Награда-музыка уходит в службу треков, а не в звуки наград.
        let music_reward = self.settings.music.reward_id.trim().to_string();
        if self.settings.music.enabled
            && !music_reward.is_empty()
            && redemption.reward_id == music_reward
        {
            self.music.request(
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

        self.touch();
    }

    /// Забирает состояние и события службы музыки.
    fn poll_music(&mut self) {
        if self.demo {
            return;
        }
        if Instant::now() < self.music_poll_at {
            return;
        }
        self.music_poll_at = Instant::now() + Duration::from_millis(200);
        self.music_snapshot = self.music.snapshot();

        for event in self.music.poll_events() {
            match event {
                MusicEvent::Queued {
                    title, position, ..
                } => {
                    log::info!("Музыка: «{title}» в очереди, позиция {position}");
                }
                MusicEvent::Started { title, .. } => {
                    log::info!("Музыка: играет «{title}»");
                }
                MusicEvent::Finished { redemption_id } => {
                    self.set_redemption_status(
                        &redemption_id,
                        twitch::RedemptionStatus::Fulfilled,
                    );
                }
                MusicEvent::Rejected {
                    redemption_id,
                    reason,
                } => {
                    log::warn!("Музыка: заявка отклонена — {reason}");
                    self.notify(format!("Заявка отклонена: {reason}"), ToastKind::Warning);
                    self.set_redemption_status(
                        &redemption_id,
                        twitch::RedemptionStatus::Canceled,
                    );
                }
                MusicEvent::Failed {
                    redemption_id,
                    reason,
                } => {
                    log::warn!("Музыка: трек не сыграл — {reason}");
                    self.notify(
                        format!("Трек не сыграл: {reason}"),
                        ToastKind::Error,
                    );
                    self.set_redemption_status(
                        &redemption_id,
                        twitch::RedemptionStatus::Canceled,
                    );
                }
                MusicEvent::Skipped { redemption_id, .. } => {
                    // Пропущенный трек не считается сыгранным — баллы возвращаем.
                    self.set_redemption_status(
                        &redemption_id,
                        twitch::RedemptionStatus::Canceled,
                    );
                }
            }
            self.touch();
        }
    }

    /// Сообщает Twitch статус активации: засчитать или вернуть баллы.
    fn set_redemption_status(&self, redemption_id: &str, status: twitch::RedemptionStatus) {
        // Служебные заявки (ручная очередь и повторы) не существуют на Twitch:
        // возвращать за них баллы некуда.
        if redemption_id.starts_with("manual-") || redemption_id.contains("-replay-") {
            return;
        }
        let reward_id = self.settings.music.reward_id.trim();
        if reward_id.is_empty() || redemption_id.trim().is_empty() {
            return;
        }
        let Some(access_token) = self.settings.twitch.access_token() else {
            return;
        };
        let broadcaster_id = self.settings.twitch.user_id.trim();
        if broadcaster_id.is_empty() {
            return;
        }

        self.twitch_service.update_redemption_status(
            &self.settings.twitch.client_id,
            &access_token,
            broadcaster_id,
            reward_id,
            redemption_id,
            status,
        );
    }

    /// Передаёт службе музыки актуальные настройки.
    fn apply_music_config(&self) {
        self.music.configure(music::Config {
            enabled: self.settings.music.enabled,
            reward_id: self.settings.music.reward_id.clone(),
            max_queue: self.settings.music.max_queue,
            max_duration_sec: self.settings.music.max_duration_sec,
            volume: self.settings.music.volume_f32(),
            pause_yandex: self.settings.music.pause_yandex,
            channel: self.settings.twitch.login.clone(),
            restore_queue: self.settings.music.restore_queue,
            overlay_seconds: self.settings.music.overlay_seconds,
            overlay_position: self.settings.music.overlay_position.clone(),
            overlay_font: self.settings.music.overlay_font,
            cookies_file: self.settings.music.cookies_file.clone(),
        });
    }

    /// Привязывает выбранный файл к награде.
    fn bind_reward_sound(&mut self, reward_id: &str, title: &str) {
        let Some(path) = pick_audio_file() else {
            return;
        };
        let path_text = path.display().to_string();

        if !audio::is_supported_file(&path) {
            self.notify(audio::unsupported_format_message(&path), ToastKind::Error);
            return;
        }
        match std::fs::metadata(&path) {
            Ok(meta) if meta.len() == 0 => {
                self.notify(
                    format!("Файл «{}» пустой.", util::file_name(&path)),
                    ToastKind::Error,
                );
                return;
            }
            Ok(_) => {}
            Err(err) => {
                self.notify(
                    format!(
                        "Не удалось прочитать файл «{}»: {err}",
                        util::file_name(&path)
                    ),
                    ToastKind::Error,
                );
                return;
            }
        }

        self.settings.set_reward_sound(reward_id, title, &path_text);
        log::info!("Награда «{title}»: привязан звук {}", path.display());
        self.mark_dirty();
        self.touch();
        self.notify(
            format!("Звук для награды «{title}» сохранён."),
            ToastKind::Success,
        );
    }

    fn commit_twitch_session(&mut self, user: &TwitchUser, tokens: &twitch::Tokens) {
        let result = {
            let twitch = &mut self.settings.twitch;
            twitch.user_id = user.id.clone();
            twitch.login = user.login.clone();
            twitch.display_name = user.display_name.clone();
            twitch.store_tokens(&tokens.access, &tokens.refresh, tokens.expires_at)
        };

        match result {
            Ok(()) => {
                self.mark_dirty();
                self.touch();
            }
            Err(err) => {
                log::error!("Не удалось сохранить вход Twitch: {err}");
                self.twitch_error = Some(format!("Не удалось сохранить вход: {err}"));
                self.notify(
                    format!("Не удалось сохранить вход в Twitch: {err}"),
                    ToastKind::Error,
                );
            }
        }
    }

    fn start_twitch_login(&mut self) {
        let client_id = self.settings.twitch.client_id.trim().to_string();
        if client_id.len() < 20 || !client_id.chars().all(|c| c.is_ascii_alphanumeric()) {
            self.twitch_error = Some(
                "Client ID должен состоять примерно из 30 букв и цифр без пробелов. Скопируйте его из Twitch Developer Console."
                    .to_string(),
            );
            self.notify(self.twitch_error.clone().unwrap_or_default(), ToastKind::Error);
            return;
        }

        self.settings.twitch.client_id = client_id.clone();
        self.mark_dirty();
        self.twitch_error = None;
        self.twitch_progress = Some("Запрашиваем код у Twitch…".to_string());
        self.twitch_code = None;
        self.twitch_state = TwitchState::Busy;
        self.twitch_service.sign_in(&client_id);
        self.touch();
    }

    fn cancel_twitch_login(&mut self) {
        self.twitch_service.cancel();
        self.twitch_state = TwitchState::Disconnected;
        self.twitch_code = None;
        self.twitch_progress = None;
        log::info!("Twitch: вход отменён пользователем");
        self.notify("Вход в Twitch отменён.", ToastKind::Info);
    }

    fn disconnect_twitch(&mut self) {
        let client_id = self.settings.twitch.client_id.clone();
        if let Some(access) = self.settings.twitch.access_token() {
        self.stop_eventsub();
            self.twitch_service.sign_out(&client_id, &access);
        }
        self.settings.twitch.clear_session();
        self.twitch_state = TwitchState::Disconnected;
        self.twitch_code = None;
        self.twitch_progress = None;
        self.twitch_error = None;
        self.mark_dirty();
        self.notify("Twitch отключён. Звуки и настройки сохранены.", ToastKind::Info);
    }

    fn refresh_twitch_now(&mut self) {
        let client_id = self.settings.twitch.client_id.clone();
        match self.settings.twitch.refresh_token() {
            Some(refresh) => {
                self.twitch_progress = Some("Обновляем данные аккаунта…".to_string());
                self.twitch_state = TwitchState::Busy;
                self.twitch_error = None;
                self.twitch_service.refresh(&client_id, &refresh);
                self.touch();
            }
            None => self.notify(
                "Нет сохранённого входа. Подключите аккаунт заново.",
                ToastKind::Warning,
            ),
        }
    }

    fn apply_volume(&mut self) {
        let volume = self.settings.effective_volume();
        if let Err(err) = self.engine.set_volume(volume) {
            self.notify(err, ToastKind::Error);
            return;
        }
        // Общая громкость применяется ко всем звукам, поэтому сразу возвращаем
        // индивидуальные множители тем, что играют сейчас.
        for id in self.playing.clone() {
            let target = self.settings.effective_sound_volume(&id);
            if (target - volume).abs() > f32::EPSILON {
                let _ = self.engine.set_id_volume(&id, target);
            }
        }
    }

    fn mark_dirty(&mut self) {
        self.save_at = Some(Instant::now() + Duration::from_millis(350));
    }

    fn maybe_save(&mut self) {
        let due = self.save_at.map(|at| Instant::now() >= at).unwrap_or(false);
        if due {
            self.save_at = None;
            self.save_now();
        }
    }

    fn save_now(&mut self) {
        match self.settings.save(&self.paths.config_file) {
            Ok(()) => {
                self.saved_at = Some(Instant::now());
                log::debug!("Настройки сохранены");
            }
            Err(err) => self.notify(
                format!("Не удалось сохранить настройки: {err}"),
                ToastKind::Error,
            ),
        }
    }

    fn current_toast(&mut self) -> Option<(&str, Color32)> {
        let expired = self
            .toast
            .as_ref()
            .map(|toast| Instant::now() >= toast.until)
            .unwrap_or(false);
        if expired {
            self.toast = None;
        }
        self.toast.as_ref().map(|toast| {
            (
                toast.text.as_str(),
                match toast.kind {
                    ToastKind::Info => TEXT_DIM,
                    ToastKind::Success => SUCCESS,
                    ToastKind::Warning => WARN,
                    ToastKind::Error => DANGER,
                },
            )
        })
    }

    // ---------- каркас окна ----------

    /// Своя шапка окна: перетаскивание и кнопки вместо системных.
    fn title_bar(&mut self, ctx: &egui::Context) {
        egui::TopBottomPanel::top("titlebar")
            .exact_height(38.0)
            .frame(
                egui::Frame::none()
                    .fill(BG)
                    .inner_margin(egui::Margin::symmetric(10.0, 0.0)),
            )
            .show(ctx, |ui| {
                let rect = ui.max_rect();
                let drag = ui.interact(
                    rect,
                    ui.id().with("titlebar-drag"),
                    Sense::click_and_drag(),
                );
                if drag.drag_started() {
                    ctx.send_viewport_cmd(egui::ViewportCommand::StartDrag);
                }
                if drag.double_clicked() {
                    let maximized = ctx.input(|input| input.viewport().maximized.unwrap_or(false));
                    ctx.send_viewport_cmd(egui::ViewportCommand::Maximized(!maximized));
                }

                ui.horizontal_centered(|ui| {
                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        if title_bar_button(ui, TitleBarIcon::Close, DANGER).clicked() {
                            ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                        }
                        let maximized =
                            ctx.input(|input| input.viewport().maximized.unwrap_or(false));
                        let icon = if maximized {
                            TitleBarIcon::Restore
                        } else {
                            TitleBarIcon::Maximize
                        };
                        if title_bar_button(ui, icon, TEXT).clicked() {
                            ctx.send_viewport_cmd(egui::ViewportCommand::Maximized(!maximized));
                        }
                        if title_bar_button(ui, TitleBarIcon::Minimize, TEXT).clicked() {
                            ctx.send_viewport_cmd(egui::ViewportCommand::Minimized(true));
                        }
                    });
                });
            });
    }

    /// Тянем за края окна: системной рамки нет, поэтому курсор и захват свои.
    fn resize_edges(&self, ctx: &egui::Context) {
        let Some(position) = ctx.pointer_hover_pos() else {
            return;
        };
        let screen = ctx.screen_rect();
        const EDGE: f32 = 10.0;
        let left = position.x - screen.left() <= EDGE;
        let right = screen.right() - position.x <= EDGE;
        let top = position.y - screen.top() <= EDGE;
        let bottom = screen.bottom() - position.y <= EDGE;

        use egui::viewport::ResizeDirection as Dir;
        let (direction, cursor) = match (top, bottom, left, right) {
            (true, _, true, _) => (Dir::NorthWest, egui::CursorIcon::ResizeNwSe),
            (true, _, _, true) => (Dir::NorthEast, egui::CursorIcon::ResizeNeSw),
            (_, true, true, _) => (Dir::SouthWest, egui::CursorIcon::ResizeNeSw),
            (_, true, _, true) => (Dir::SouthEast, egui::CursorIcon::ResizeNwSe),
            (true, _, _, _) => (Dir::North, egui::CursorIcon::ResizeVertical),
            (_, true, _, _) => (Dir::South, egui::CursorIcon::ResizeVertical),
            (_, _, true, _) => (Dir::West, egui::CursorIcon::ResizeHorizontal),
            (_, _, _, true) => (Dir::East, egui::CursorIcon::ResizeHorizontal),
            _ => return,
        };

        // Курсор виден ещё до нажатия — понятно, где можно тянуть.
        ctx.set_cursor_icon(cursor);

        if ctx.input(|input| input.pointer.any_pressed()) {
            ctx.send_viewport_cmd(egui::ViewportCommand::BeginResize(direction));
        }
    }

    fn header(&mut self, ctx: &egui::Context) {
        let connected =
            self.settings.twitch.is_connected() || self.twitch_state == TwitchState::Connected;
        let account = self.settings.twitch.account_label();
        let (listen_text, listen_color) = self.eventsub_status();
        let muted = self.settings.muted;
        let volume_percent = self.settings.volume_label();
        let mut toggle_mute = false;
        let mut go_settings = false;

        egui::TopBottomPanel::top("header")
            .frame(
                egui::Frame::none()
                    .fill(BG)
                    .inner_margin(egui::Margin::symmetric(24.0, 14.0)),
            )
            .show(ctx, |ui| {
                let compact = ui.available_width() < 820.0;
                ui.horizontal(|ui| {
                    let color = if connected { SUCCESS } else { TEXT_DIM };
                    ui.label(RichText::new("●").size(10.8).color(color));
                    ui.label(
                        RichText::new(if connected {
                            format!("Подключено · {account}")
                        } else {
                            "Twitch не подключён".to_string()
                        })
                        .size(13.8)
                        .color(TEXT_DIM),
                    );

                    if connected && !compact {
                        ui.add_space(6.0);
                        ui.label(
                            RichText::new("·")
                                .size(13.0)
                                .color(with_alpha(TEXT_DIM, 120)),
                        );
                        ui.add_space(4.0);
                        let status = ui
                            .add(
                                egui::Label::new(
                                    RichText::new(format!("● {listen_text}"))
                                        .size(13.2)
                                        .color(listen_color),
                                )
                                .sense(Sense::click()),
                            )
                            .on_hover_text("Открыть настройки прослушивания");
                        if status.clicked() {
                            go_settings = true;
                        }
                        if !self.playing.is_empty() {
                            ui.add_space(8.0);
                            ui.label(
                                RichText::new(format!("звучит: {}", self.playing.len()))
                                    .size(12.4)
                                    .color(SUCCESS),
                            );
                        }
                    }

                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        self.twitch_pill(ui);
                        ui.add_space(16.0);

                        ui.label(
                            RichText::new(if muted {
                                "БЕЗ ЗВУКА".to_string()
                            } else {
                                volume_percent.clone()
                            })
                            .size(14.4)
                            .color(if muted { WARN } else { TEXT }),
                        );

                        let mut volume = self.settings.volume;
                        let response = fader(
                            ui,
                            &mut volume,
                            0.0,
                            1.0,
                            if compact { 92.0 } else { 128.0 },
                        );
                        if response.changed() {
                            self.settings.volume = volume;
                            self.settings.muted = false;
                            self.apply_volume();
                            self.mark_dirty();
                            self.touch();
                        }

                        if icon_button(
                            ui,
                            if muted {
                                UiIcon::VolumeMuted
                            } else {
                                UiIcon::Volume
                            },
                            if muted {
                                "Включить звук"
                            } else {
                                "Выключить звук"
                            },
                            30.0,
                        )
                        .clicked()
                        {
                            toggle_mute = true;
                        }

                        if !compact {
                            ui.label(
                                RichText::new("ЗВУК")
                                    .size(11.4)
                                    .color(with_alpha(TEXT_DIM, 190)),
                            );
                        }
                    });
                });
            });

        if toggle_mute {
            self.settings.muted = !self.settings.muted;
            self.apply_volume();
            self.mark_dirty();
            self.notify(
                if self.settings.muted {
                    "Звук выключен."
                } else {
                    "Звук включён."
                },
                ToastKind::Info,
            );
            self.touch();
        }
        if go_settings {
            self.tab = Tab::Settings;
            self.touch();
        }
    }

    fn sidebar(&mut self, ctx: &egui::Context) {
        egui::SidePanel::left("rail")
            .exact_width(236.0)
            .resizable(false)
            .frame(
                egui::Frame::none()
                    .fill(PANEL)
                    .inner_margin(egui::Margin::symmetric(14.0, 18.0)),
            )
            .show(ctx, |ui| {
                // Логотип приложения.
                ui.horizontal(|ui| {
                    let (mark, _) = ui.allocate_exact_size(Vec2::splat(28.0), Sense::hover());
                    ui.painter()
                        .rect_filled(mark, Rounding::same(9.0), with_alpha(ACCENT, 22));
                    ui.painter().text(
                        mark.center(),
                        Align2::CENTER_CENTER,
                        "R",
                        FontId::new(14.0, semibold()),
                        TEXT,
                    );
                    ui.add_space(2.0);
                    ui.label(
                        RichText::new("Reward Sounds")
                            .family(semibold())
                            .size(15.0)
                            .color(TEXT),
                    );
                });

                ui.add_space(22.0);

                ui.label(
                    RichText::new("ОСНОВНОЕ")
                        .size(10.8)
                        .color(with_alpha(TEXT_DIM, 170)),
                );
                ui.add_space(6.0);
                for (tab, icon, label) in [
                    (Tab::Rewards, NavIcon::Rewards, "Награды"),
                    (Tab::Music, NavIcon::Music, "Музыка"),
                ] {
                    if nav_item(ui, icon, label, self.tab == tab).clicked() {
                        self.tab = tab;
                        self.touch();
                    }
                }

                ui.add_space(18.0);

                ui.label(
                    RichText::new("СИСТЕМА")
                        .size(10.8)
                        .color(with_alpha(TEXT_DIM, 170)),
                );
                ui.add_space(6.0);
                for (tab, icon, label) in [
                    (Tab::Settings, NavIcon::Settings, "Настройки"),
                    (Tab::Log, NavIcon::Log, "Журнал"),
                ] {
                    if nav_item(ui, icon, label, self.tab == tab).clicked() {
                        self.tab = tab;
                        if tab == Tab::Log {
                            self.logs = self.logger.entries();
                            self.log_refresh_at = Instant::now() + Duration::from_millis(800);
                        }
                        self.touch();
                    }
                }

                ui.with_layout(Layout::bottom_up(Align::LEFT), |ui| {
                    if ghost_button(ui, "Завершить", with_alpha(TEXT_DIM, 170)).clicked() {
                        self.allow_close = true;
                        self.save_now();
                        ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                    }
                    ui.add_space(2.0);
                    ui.label(
                        RichText::new(format!("версия {}", crate::VERSION))
                            .size(11.4)
                            .color(with_alpha(TEXT_DIM, 140)),
                    );
                    ui.add_space(6.0);
                    ui.horizontal(|ui| {
                        let color = if self.audio.is_ready() { SUCCESS } else { DANGER };
                        ui.label(RichText::new("●").size(9.0).color(color));
                        ui.label(
                            RichText::new(if self.audio.is_ready() {
                                "звук готов"
                            } else {
                                "нет аудиовыхода"
                            })
                            .size(11.6)
                            .color(TEXT_DIM),
                        );
                    });
                });
            });
    }

    fn footer(&mut self, ctx: &egui::Context) {
        let audio_ready = self.audio.is_ready();
        let toast = self
            .current_toast()
            .map(|(text, color)| (text.to_string(), color));
        let has_toast = toast.is_some();
        let mut dismiss = false;

        egui::TopBottomPanel::bottom("footer")
            .frame(
                egui::Frame::none()
                    .fill(BG)
                    .inner_margin(egui::Margin::symmetric(24.0, 8.0)),
            )
            .show(ctx, |ui| {
                ui.horizontal(|ui| {
                    match &toast {
                        Some((text, color)) => {
                            ui.label(RichText::new("•").size(12.0).color(*color));
                            ui.add_space(2.0);
                            let label = ui.add(
                                egui::Label::new(
                                    RichText::new(text).size(13.2).color(*color),
                                )
                                .truncate(),
                            );
                            if label.hovered() {
                                label.on_hover_text(text);
                            }
                        }
                        None => {
                            let (text, color) = if audio_ready {
                                ("Готово".to_string(), with_alpha(TEXT_DIM, 170))
                            } else {
                                (
                                    "Аудиовыход недоступен — откройте настройки".to_string(),
                                    DANGER,
                                )
                            };
                            ui.add(
                                egui::Label::new(RichText::new(text).size(13.2).color(color))
                                    .truncate(),
                            );
                        }
                    }

                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        ui.label(
                            RichText::new("REWARD SOUNDS")
                                .size(10.2)
                                .color(with_alpha(TEXT_DIM, 120)),
                        );
                        if has_toast
                            && icon_button(ui, UiIcon::X, "Скрыть уведомление", 24.0).clicked()
                        {
                            dismiss = true;
                        }
                    });
                });
            });

        if dismiss {
            self.toast = None;
            self.touch();
        }
    }

    fn twitch_pill(&mut self, ui: &mut egui::Ui) {
        let (text, color) = match self.twitch_state {
            TwitchState::Connected => (format!("@{}", self.settings.twitch.login), SUCCESS),
            TwitchState::Busy | TwitchState::Waiting => {
                ("Twitch: подключение…".to_string(), WARN)
            }
            TwitchState::Disconnected => ("Twitch: не подключён".to_string(), TEXT_DIM),
        };

        let response = pill_button(ui, &text, color);
        if response.clicked() {
            self.tab = Tab::Settings;
            self.touch();
        }
        response.on_hover_text("Нажмите, чтобы открыть подключение к Twitch");
    }

    // ---------- раздел «Звуки» ----------

    fn start_playback(&mut self, id: &str, path: PathBuf) {
        if !path.is_file() {
            self.notify(
                format!(
                    "Файл «{}» не найден. Нажмите «Заменить файл» и выберите его заново.",
                    util::file_name(&path)
                ),
                ToastKind::Error,
            );
            return;
        }
        if !audio::is_supported_file(&path) {
            self.notify(audio::unsupported_format_message(&path), ToastKind::Error);
            return;
        }

        // Прослушивание учитывает и общую громкость, и ползунок на карточке.
        let volume = self.settings.effective_sound_volume(id);

        match self.engine.play(id, path, volume) {
            Ok(()) => {
                if self.settings.muted {
                    self.notify(
                        "Звук запущен, но включён режим «Без звука» — выключите его в настройках.",
                        ToastKind::Info,
                    );
                }
                self.touch();
            }
            Err(err) => self.notify(err, ToastKind::Error),
        }
    }

    // ---------- раздел «Награды» ----------

    fn rewards_tab(&mut self, ui: &mut egui::Ui) {
        let connected =
            self.settings.twitch.is_connected() || self.twitch_state == TwitchState::Connected;
        let login = self.settings.twitch.login.clone();
        let mut rewards = self.remote_rewards.clone();
        twitch::sort_rewards_for_display(&mut rewards);
        match self.reward_sort {
            RewardSort::Default => {}
            RewardSort::PriceDesc => {
                rewards.sort_by(|a, b| b.cost.cmp(&a.cost).then(a.title.cmp(&b.title)))
            }
            RewardSort::PriceAsc => {
                rewards.sort_by(|a, b| a.cost.cmp(&b.cost).then(a.title.cmp(&b.title)))
            }
            RewardSort::Title => rewards.sort_by(|a, b| a.title.cmp(&b.title)),
        }
        let mut new_sort = self.reward_sort;
        let bindings = self.settings.twitch_rewards.clone();
        let playing = self.playing.clone();
        let loading = self.rewards_loading;
        let error = self.rewards_error.clone();
        let loaded = self.rewards_loaded_at;
        self.ensure_file_cache();
        let cache = self.file_cache.clone();

        let (listen_text, listen_color) = self.eventsub_status();
        let mut refresh_requested = false;
        let mut open_panel = false;
        let mut create_requested = false;
        let mut stop_all = false;
        let mut view_changed = false;
        let mut go_settings = false;
        let mut go_log = false;
        let mut reset_filters = false;
        let mut toggle_disabled = false;
        let mut grid_view = self.settings.grid_view;
        let filter = self.reward_filter;
        let mut new_filter = filter;
        let mut actions: Vec<RewardUiAction> = Vec::new();

        let count_all = rewards.len();
        let count_with = rewards
            .iter()
            .filter(|reward| bindings.iter().any(|b| b.reward_id == reward.id && b.has_sound()))
            .count();
        let count_without = count_all.saturating_sub(count_with);
        let count_disabled = rewards.iter().filter(|reward| !reward.is_available()).count();
        let count_playing = playing.len();

        // ---- Строка 1: заголовок и главное действие ----
        ui.horizontal(|ui| {
            ui.vertical(|ui| {
                ui.label(
                    RichText::new("Награды")
                        .family(semibold())
                        .size(36.0)
                        .color(TEXT),
                );
                let subtitle = if !connected {
                    "Подключите Twitch, чтобы увидеть награды".to_string()
                } else if loading && count_all == 0 {
                    "Загружаем список наград…".to_string()
                } else {
                    format!(
                        "@{login} · {} {} · {} со звуком",
                        count_all,
                        util::plural_ru(count_all, "награда", "награды", "наград"),
                        count_with
                    )
                };
                ui.label(RichText::new(subtitle).size(15.0).color(TEXT_DIM));
            });
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                if connected {
                    if accent_button(ui, "+   Создать награду").clicked() {
                        create_requested = true;
                    }
                    ui.add_space(6.0);
                    ui.scope(|ui| {
                        ui.spacing_mut().button_padding = Vec2::new(7.0, 8.0);
                        ui.menu_button(
                            RichText::new("•••").size(13.0).color(TEXT_DIM),
                            |ui| {
                                ui.set_min_width(210.0);
                                if ui.button("Открыть панель наград Twitch").clicked() {
                                    open_panel = true;
                                    ui.close_menu();
                                }
                                if ui.button("Открыть журнал").clicked() {
                                    go_log = true;
                                    ui.close_menu();
                                }
                            },
                        );
                    });
                }
            });
        });

        // ---- Строка 2: статус, поиск, вид, обновление, стоп ----
        if connected {
        ui.add_space(12.0);
        ui.horizontal_wrapped(|ui| {
            let search_width = 252.0;
            egui::Frame::none()
                .fill(blend_over(BG, with_alpha(Color32::WHITE, 5)))
                .stroke(Stroke::new(
                    1.0_f32,
                    blend_over(BG, with_alpha(Color32::WHITE, 26)),
                ))
                .rounding(Rounding::same(17.0))
                .inner_margin(egui::Margin::symmetric(14.0, 6.0))
                .show(ui, |ui| {
                    ui.horizontal(|ui| {
                        let (icon_rect, _) =
                            ui.allocate_exact_size(Vec2::splat(15.0), Sense::hover());
                        paint_ui_icon(
                            ui.painter(),
                            icon_rect,
                            UiIcon::Search,
                            with_alpha(TEXT_DIM, 220),
                        );
                        ui.add(
                            egui::TextEdit::singleline(&mut self.search)
                                .frame(false)
                                .hint_text("Поиск награды")
                                .desired_width(search_width - 58.0)
                                .font(FontId::proportional(13.6)),
                        );
                    });
                });
            if !self.search.is_empty() {
                if icon_button(ui, UiIcon::X, "Очистить поиск", 24.0).clicked() {
                    self.search.clear();
                }
            }

            // Переключатель вида.
            egui::Frame::none()
                .fill(blend_over(BG, with_alpha(Color32::WHITE, 10)))
                .rounding(Rounding::same(17.0))
                .inner_margin(egui::Margin::symmetric(3.0, 2.0))
                .show(ui, |ui| {
                    ui.horizontal(|ui| {
                        ui.spacing_mut().item_spacing.x = 2.0;
                        if seg_button(ui, UiIcon::Grid, "Плитка", grid_view) {
                            grid_view = true;
                            view_changed = true;
                        }
                        if seg_button(ui, UiIcon::List, "Список", !grid_view) {
                            grid_view = false;
                            view_changed = true;
                        }
                    });
                });

            // Сортировка — как выпадающий список в макете.
            ui.scope(|ui| {
                ui.spacing_mut().interact_size.y = 34.0;
                let visuals = &mut ui.style_mut().visuals.widgets;
                visuals.inactive.weak_bg_fill = blend_over(BG, with_alpha(Color32::WHITE, 4));
                visuals.inactive.bg_stroke = Stroke::new(
                    1.0_f32,
                    blend_over(BG, with_alpha(Color32::WHITE, 26)),
                );
                visuals.inactive.fg_stroke = Stroke::new(1.0_f32, TEXT);
                visuals.inactive.rounding = Rounding::same(17.0);
                egui::ComboBox::from_id_salt("reward-sort")
                    .width(150.0)
                    .selected_text(RichText::new(new_sort.label()).size(13.2).color(TEXT))
                    .show_ui(ui, |ui| {
                        for sort in [
                            RewardSort::Default,
                            RewardSort::PriceDesc,
                            RewardSort::PriceAsc,
                            RewardSort::Title,
                        ] {
                            if ui
                                .selectable_label(new_sort == sort, sort.label())
                                .clicked()
                            {
                                new_sort = sort;
                            }
                        }
                    });
            });

            if loading {
                ui.add(egui::Spinner::new().size(16.0));
                ui.label(RichText::new("Обновляем…").size(12.6).color(TEXT_DIM));
            } else if icon_button(ui, UiIcon::Refresh, "Обновить список", 34.0).clicked() {
                refresh_requested = true;
            }

            if danger_button(ui, "Остановить всё").clicked() {
                stop_all = true;
            }
        });
        }

        // ---- Строка 3: фильтры вместо стат-карточек ----
        if connected {
        ui.add_space(10.0);
        ui.horizontal_wrapped(|ui| {
            if filter_chip(ui, RewardFilter::All.label(), count_all, filter == RewardFilter::All, None)
                .clicked()
            {
                new_filter = RewardFilter::All;
            }
            if filter_chip(
                ui,
                RewardFilter::WithSound.label(),
                count_with,
                filter == RewardFilter::WithSound,
                Some(SUCCESS),
            )
            .clicked()
            {
                new_filter = RewardFilter::WithSound;
            }
            if filter_chip(
                ui,
                RewardFilter::WithoutSound.label(),
                count_without,
                filter == RewardFilter::WithoutSound,
                Some(WARN),
            )
            .clicked()
            {
                new_filter = RewardFilter::WithoutSound;
            }
            if filter_chip(
                ui,
                RewardFilter::Playing.label(),
                count_playing,
                filter == RewardFilter::Playing,
                Some(if count_playing > 0 { SUCCESS } else { TEXT_DIM }),
            )
            .clicked()
            {
                new_filter = RewardFilter::Playing;
            }
            if connected
                && count_disabled > 0
                && filter_chip(
                    ui,
                    RewardFilter::Disabled.label(),
                    count_disabled,
                    filter == RewardFilter::Disabled,
                    None,
                )
                .clicked()
            {
                new_filter = RewardFilter::Disabled;
            }
        });
        }

        ui.add_space(12.0);

        // ---- Содержимое ----
        if !connected {
            self.quick_start_card(ui);
            ui.add_space(12.0);
            self.local_bindings_card(ui);
        } else if rewards.is_empty() && !loading {
            section_card(ui, "Наград пока нет", |ui| {
                paragraph(
                    ui,
                    "У канала нет пользовательских наград Channel Points. Создайте награду здесь или в панели Twitch — она появится в этом списке.",
                    TEXT,
                    14.4,
                );
                ui.add_space(10.0);
                ui.horizontal(|ui| {
                    if accent_button(ui, "Создать награду").clicked() {
                        create_requested = true;
                    }
                    if secondary_button(ui, "Открыть панель Twitch").clicked() {
                        open_panel = true;
                    }
                });
            });
            if let Some(err) = &error {
                ui.add_space(10.0);
                error_banner(ui, err, &mut refresh_requested);
            }
        } else {
            if let Some(err) = &error {
                error_banner(ui, err, &mut refresh_requested);
                ui.add_space(10.0);
            }

            let search = self.search.trim().to_lowercase();
            let matches = |reward: &twitch::RemoteReward| {
                search.is_empty() || reward.title.to_lowercase().contains(&search)
            };
            let is_playing = |reward: &twitch::RemoteReward| {
                playing.iter().any(|id| id == &reward.id)
            };
            let has_sound = |reward: &twitch::RemoteReward| {
                bindings
                    .iter()
                    .any(|b| b.reward_id == reward.id && b.has_sound())
            };

            let visible: Vec<&twitch::RemoteReward> = rewards
                .iter()
                .filter(|reward| match filter {
                    RewardFilter::All => reward.is_available(),
                    RewardFilter::WithSound => reward.is_available() && has_sound(reward),
                    RewardFilter::WithoutSound => reward.is_available() && !has_sound(reward),
                    RewardFilter::Playing => reward.is_available() && is_playing(reward),
                    RewardFilter::Disabled => !reward.is_available(),
                })
                .filter(|reward| matches(reward))
                .collect();

            let disabled_visible: Vec<&twitch::RemoteReward> = rewards
                .iter()
                .filter(|reward| !reward.is_available())
                .filter(|reward| matches(reward))
                .collect();

            if visible.is_empty() {
                section_card(ui, "Ничего не найдено", |ui| {
                    paragraph(
                        ui,
                        "По этому фильтру и запросу наград нет. Попробуйте изменить фильтр или сбросить поиск.",
                        TEXT_DIM,
                        14.4,
                    );
                    ui.add_space(10.0);
                    if secondary_button(ui, "Сбросить фильтры").clicked() {
                        reset_filters = true;
                    }
                });
            } else {
                egui::ScrollArea::vertical()
                    .id_source("rewards-main-scroll")
                    .auto_shrink([false, false])
                    .show(ui, |ui| {
                        if grid_view {
                            let columns = if ui.available_width() >= 820.0 { 3 } else { 2 };
                            actions.extend(draw_reward_grid(
                                ui,
                                &visible,
                                &bindings,
                                &playing,
                                &cache,
                                columns,
                            ));
                        } else {
                            for reward in &visible {
                                let binding = bindings
                                    .iter()
                                    .find(|binding| binding.reward_id == reward.id);
                                let instances =
                                    playing.iter().filter(|id| id.as_str() == reward.id.as_str()).count();
                                if let Some(action) =
                                    reward_card(ui, reward, binding, instances, &cache)
                                {
                                    actions.push(action);
                                }
                                ui.add_space(8.0);
                            }
                        }
                    });

                if filter == RewardFilter::All && !disabled_visible.is_empty() {
                    ui.add_space(6.0);
                    let (rect, row) = ui.allocate_exact_size(
                        Vec2::new(ui.available_width(), 42.0),
                        Sense::click(),
                    );
                    let hovered = row.hovered();
                    ui.painter().rect(
                        rect,
                        Rounding::same(12.0),
                        if hovered {
                            blend_over(BG, with_alpha(Color32::WHITE, 5))
                        } else {
                            Color32::TRANSPARENT
                        },
                        Stroke::new(1.0_f32, blend_over(BG, with_alpha(Color32::WHITE, 30))),
                    );
                    let icon = if self.disabled_open {
                        UiIcon::ChevronDown
                    } else {
                        UiIcon::ChevronRight
                    };
                    paint_ui_icon(
                        ui.painter(),
                        egui::Rect::from_center_size(
                            egui::pos2(rect.left() + 20.0, rect.center().y),
                            Vec2::splat(14.0),
                        ),
                        icon,
                        TEXT_DIM,
                    );
                    ui.painter().text(
                        egui::pos2(rect.left() + 40.0, rect.center().y),
                        Align2::LEFT_CENTER,
                        format!(
                            "Выключенные и недоступные награды · {}",
                            disabled_visible.len()
                        ),
                        FontId::new(13.2, egui::FontFamily::Proportional),
                        TEXT_DIM,
                    );
                    ui.painter().text(
                        egui::pos2(rect.right() - 18.0, rect.center().y),
                        Align2::RIGHT_CENTER,
                        if self.disabled_open { "Скрыть" } else { "Показать" },
                        FontId::new(12.6, egui::FontFamily::Proportional),
                        with_alpha(TEXT_DIM, 190),
                    );
                    if row.clicked() {
                        toggle_disabled = true;
                    }
                    if self.disabled_open {
                        ui.add_space(8.0);
                        egui::ScrollArea::vertical()
                            .id_source("disabled-rewards")
                            .max_height(260.0)
                            .auto_shrink([false, true])
                            .show(ui, |ui| {
                                if grid_view {
                                    let columns = if ui.available_width() >= 820.0 { 3 } else { 2 };
                                    actions.extend(draw_reward_grid(
                                        ui,
                                        &disabled_visible,
                                        &bindings,
                                        &playing,
                                        &cache,
                                        columns,
                                    ));
                                } else {
                                    for reward in &disabled_visible {
                                        let binding = bindings
                                            .iter()
                                            .find(|binding| binding.reward_id == reward.id);
                                        let instances = playing
                                            .iter()
                                            .filter(|id| id.as_str() == reward.id.as_str())
                                            .count();
                                        if let Some(action) =
                                            reward_card(ui, reward, binding, instances, &cache)
                                        {
                                            actions.push(action);
                                        }
                                        ui.add_space(8.0);
                                    }
                                }
                            });
                    }
                }
            }

            // Привязки, для которых награды больше нет на Twitch.
            if loaded.is_some() {
                let orphans: Vec<_> = bindings
                    .iter()
                    .filter(|b| !rewards.iter().any(|r| r.id == b.reward_id))
                    .collect();
                if !orphans.is_empty() {
                    ui.add_space(8.0);
                    ui.label(
                        RichText::new("Привязки без награды на Twitch")
                            .size(13.2)
                            .color(TEXT_DIM),
                    );
                    ui.add_space(6.0);
                    for binding in orphans {
                        if let Some(action) = orphan_reward_card(ui, binding) {
                            actions.push(action);
                        }
                        ui.add_space(8.0);
                    }
                }
            }
        }

        // ---- Реакция на действия ----
        if stop_all {
            if let Err(err) = self.engine.stop_all() {
                self.notify(err, ToastKind::Error);
            }
            self.touch();
        }
        if refresh_requested {
            self.fetch_reward_list();
        }
        if create_requested {
            self.open_create_reward();
        }
        if go_settings {
            self.tab = Tab::Settings;
            self.touch();
        }
        if go_log {
            self.tab = Tab::Log;
            self.logs = self.logger.entries();
            self.log_refresh_at = Instant::now() + Duration::from_millis(800);
            self.touch();
        }
        if view_changed {
            self.settings.grid_view = grid_view;
            self.mark_dirty();
            self.touch();
        }
        if new_filter != filter {
            self.reward_filter = new_filter;
            self.touch();
        }
        if new_sort != self.reward_sort {
            self.reward_sort = new_sort;
            self.touch();
        }
        if reset_filters {
            self.search.clear();
            self.reward_filter = RewardFilter::All;
            self.touch();
        }
        if toggle_disabled {
            self.disabled_open = !self.disabled_open;
            self.touch();
        }
        if open_panel {
            let _ = webbrowser::open(DASHBOARD_URL);
        }
        for action in actions {
            self.apply_reward_action(action);
        }
    }

    fn apply_reward_action(&mut self, action: RewardUiAction) {
        match action {
            RewardUiAction::Bind { reward_id, title } => {
                self.bind_reward_sound(&reward_id, &title);
                self.file_cache.clear();
            }
            RewardUiAction::Clear { reward_id } => {
                if let Some(binding) = self.settings.reward_sound(&reward_id) {
                    self.file_cache.remove(&binding.path);
                }
                if self.settings.clear_reward_sound(&reward_id) {
                    log::info!("Награда {reward_id}: привязка звука удалена");
                    self.mark_dirty();
                    self.touch();
                    self.notify("Звук отвязан от награды.", ToastKind::Info);
                }
            }
            RewardUiAction::Play { reward_id, path } => {
                self.start_playback(&reward_id, PathBuf::from(path));
            }
            RewardUiAction::Edit { reward } => {
                self.reward_delete = None;
                self.open_edit_reward(reward);
            }
            RewardUiAction::Delete { reward } => {
                self.reward_editor = None;
                self.reward_delete = Some(reward);
            }
            RewardUiAction::SetVolume { reward_id, volume } => {
                if self.settings.set_sound_volume(&reward_id, volume) {
                    // Если этот звук играет прямо сейчас, меняем его громкость
                    // сразу — чтобы ползунок был слышен без повторного запуска.
                    if self.playing.iter().any(|id| id == &reward_id) {
                        let target = self.settings.effective_sound_volume(&reward_id);
                        if let Err(err) = self.engine.set_id_volume(&reward_id, target) {
                            self.notify(err, ToastKind::Error);
                        }
                    }
                    self.mark_dirty();
                    self.touch();
                }
            }
        }
    }

    /// Обновляет кэш сведений о файлах звуков (не чаще, чем раз в 3 секунды).
    fn ensure_file_cache(&mut self) {
        let bindings = self.settings.twitch_rewards.clone();
        let now = Instant::now();
        let known: Vec<&str> = bindings.iter().map(|binding| binding.path.as_str()).collect();
        self.file_cache
            .retain(|path, _| known.iter().any(|known| *known == path));

        for binding in &bindings {
            let expired = self
                .file_cache
                .get(&binding.path)
                .map(|cached| now.duration_since(cached.checked_at) >= FILE_CACHE_TTL)
                .unwrap_or(true);
            if !expired {
                continue;
            }

            let meta = std::fs::metadata(&binding.path).ok();
            let (exists, size) = match &meta {
                Some(meta) if meta.is_file() => (true, meta.len()),
                _ => (false, 0),
            };
            let duration_sec = match self.file_cache.get(&binding.path) {
                Some(cached) if cached.size == size && cached.duration_sec.is_some() => {
                    cached.duration_sec
                }
                _ if exists => audio::probe_duration_sec(Path::new(&binding.path)),
                _ => None,
            };
            self.file_cache.insert(
                binding.path.clone(),
                CachedFile {
                    exists,
                    size,
                    duration_sec,
                    checked_at: now,
                },
            );
        }
    }

    /// Окно подтверждения опасного действия (общее для разных мест).
    fn confirm_dialog_window(&mut self, ctx: &egui::Context) {
        let Some(dialog) = self.confirm.as_ref() else {
            return;
        };
        let title = dialog.title.clone();
        let text = dialog.text.clone();
        let confirm_label = dialog.confirm_label.clone();
        let danger = dialog.danger;
        let action = dialog.action;

        modal_scrim(ctx);
        let mut close = false;
        let mut confirmed = false;

        egui::Window::new("confirm")
            .id(egui::Id::new("confirm-dialog"))
            .title_bar(false)
            .collapsible(false)
            .resizable(false)
            .movable(false)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .min_width(440.0)
            .max_width(440.0)
            .frame(
                egui::Frame::window(&ctx.style())
                    .fill(PANEL)
                    .rounding(Rounding::same(22.0))
                    .stroke(Stroke::new(1.0_f32, BORDER))
                    .inner_margin(egui::Margin::symmetric(26.0, 22.0)),
            )
            .show(ctx, |ui| {
                ui.set_width(ui.available_width());
                ui.label(RichText::new(title).family(semibold()).size(21.6).color(TEXT));
                ui.add_space(8.0);
                paragraph(ui, &text, TEXT_DIM, 14.4);
                ui.add_space(18.0);
                ui.horizontal(|ui| {
                    if secondary_button(ui, "Отмена").clicked() {
                        close = true;
                    }
                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        let response = if danger {
                            danger_button(ui, &confirm_label)
                        } else {
                            accent_button(ui, &confirm_label)
                        };
                        if response.clicked() {
                            confirmed = true;
                        }
                    });
                });
            });

        if ctx.input(|input| input.key_pressed(egui::Key::Escape)) {
            close = true;
        }
        if confirmed {
            match action {
                ConfirmAction::DisconnectTwitch => {
                    self.disconnect_twitch();
                    self.notify("Twitch отключён.", ToastKind::Info);
                }
                ConfirmAction::NormalizeVolumes => self.start_normalize(),
                ConfirmAction::ClearMusicQueue => {
                    self.music.clear_queue();
                    self.notify("Очередь очищена, баллы за заявки возвращаются.", ToastKind::Info);
                }
            }
            close = true;
        }
        if close {
            self.confirm = None;
            self.touch();
        }
    }

    /// Карточка быстрого старта вместо пустого экрана «Награды».
    fn quick_start_card(&mut self, ui: &mut egui::Ui) {
        let mut go_settings = false;
        let mut open_help = false;

        ui.horizontal_top(|ui| {
            let total = ui.available_width();
            let left_width = (total * 0.62).floor();
            let right_width = total - left_width - 10.0;

            ui.allocate_ui_with_layout(
                Vec2::new(left_width, 402.0),
                Layout::top_down(Align::Min),
                |ui| {
                card_frame().show(ui, |ui| {
                    ui.set_width(ui.available_width());
                    ui.label(
                        RichText::new("Быстрый старт")
                            .family(semibold())
                            .size(19.0)
                            .color(TEXT),
                    );
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new(
                                "Три шага — и звуки будут играть на стриме автоматически.",
                            )
                            .size(12.8)
                            .color(TEXT_DIM),
                        );
                        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                            pill_button(ui, "0 из 3", TEXT_DIM);
                        });
                    });
                    ui.add_space(6.0);

                    let steps = [
                        (
                            1u32,
                            true,
                            "Подключите Twitch",
                            "Публичный Client ID вашего приложения на dev.twitch.tv — это не пароль. Вход подтверждается кодом на сайте Twitch, токены хранятся только на этом компьютере.",
                        ),
                        (
                            2,
                            false,
                            "Выберите награду и привяжите звук",
                            "Награды Channel Points подтянутся с канала. Можно создать награду прямо здесь — и сразу выбрать для неё файл.",
                        ),
                        (
                            3,
                            false,
                            "Проверьте звук",
                            "Кнопка «Прослушать» на карточке играет файл так же, как при активации награды.",
                        ),
                    ];
                    for (index, (number, active, title, text)) in steps.iter().enumerate() {
                        if index > 0 {
                            ui.add_space(6.0);
                        }
                        ui.horizontal_top(|ui| {
                            let (circle, _) =
                                ui.allocate_exact_size(Vec2::splat(28.0), Sense::hover());
                            if *active {
                                ui.painter().circle_filled(circle.center(), 14.0, TEXT);
                                ui.painter().text(
                                    circle.center(),
                                    Align2::CENTER_CENTER,
                                    number.to_string(),
                                    FontId::new(13.0, semibold()),
                                    BG,
                                );
                            } else {
                                ui.painter().circle(
                                    circle.center(),
                                    13.0,
                                    with_alpha(Color32::WHITE, 4),
                                    Stroke::new(1.0_f32, with_alpha(Color32::WHITE, 40)),
                                );
                                ui.painter().text(
                                    circle.center(),
                                    Align2::CENTER_CENTER,
                                    number.to_string(),
                                    FontId::new(13.0, semibold()),
                                    TEXT_DIM,
                                );
                            }
                            ui.add_space(6.0);
                            ui.vertical(|ui| {
                                ui.label(
                                    RichText::new(*title)
                                        .family(semibold())
                                        .size(15.2)
                                        .color(TEXT),
                                );
                                ui.add(
                                    egui::Label::new(
                                        RichText::new(*text).size(12.8).color(TEXT_DIM),
                                    )
                                    .wrap(),
                                );
                                if *active {
                                    ui.add_space(8.0);
                                    ui.horizontal(|ui| {
                                        if accent_button(ui, "Подключить Twitch").clicked() {
                                            go_settings = true;
                                        }
                                        if ghost_button(ui, "Где взять Client ID?", TEXT_DIM)
                                            .clicked()
                                        {
                                            open_help = true;
                                        }
                                    });
                                }
                            });
                        });
                    }

                    ui.add_space(6.0);
                    ui.separator();
                    ui.add_space(4.0);
                    ui.horizontal(|ui| {
                        ui.label(RichText::new("●").size(9.6).color(SUCCESS));
                        ui.label(
                            RichText::new(format!(
                                "Аудиовыход в порядке · {}",
                                self.audio
                                    .device
                                    .clone()
                                    .unwrap_or_else(|| "устройство не найдено".to_string())
                            ))
                            .size(12.0)
                            .color(TEXT_DIM),
                        );
                        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                            if ghost_button(ui, "Проверить подключение", TEXT_DIM).clicked() {
                                self.refresh_twitch_now();
                                self.notify("Проверяем подключение…", ToastKind::Info);
                            }
                        });
                    });
                });
                },
            );

            ui.add_space(10.0);

            ui.allocate_ui_with_layout(
                Vec2::new(right_width, 402.0),
                Layout::top_down(Align::Min),
                |ui| {
                ui.vertical(|ui| {
                    card_frame().show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        ui.label(
                            RichText::new("Почему нужен Client ID?")
                                .family(semibold())
                                .size(15.0)
                                .color(TEXT),
                        );
                        ui.add_space(8.0);
                        for line in [
                            "Это идентификатор приложения, а не логин и не пароль.",
                            "Нужен один раз: приложение запоминает вход между запусками.",
                            "Понадобится 2FA на аккаунте Twitch — этого требует сам Twitch.",
                        ] {
                            ui.horizontal_top(|ui| {
                                ui.label(RichText::new("•").size(13.6).color(SUCCESS));
                                ui.add(
                                    egui::Label::new(
                                        RichText::new(line).size(12.2).color(TEXT_DIM),
                                    )
                                    .wrap(),
                                );
                            });
                            ui.add_space(4.0);
                        }
                        ui.add_space(4.0);
                        if secondary_button(ui, "Открыть инструкцию").clicked() {
                            open_help = true;
                        }
                    });

                    ui.add_space(10.0);
                    card_frame().show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        ui.horizontal(|ui| {
                            let (rect, _) =
                                ui.allocate_exact_size(Vec2::splat(38.0), Sense::hover());
                            ui.painter().rect_filled(
                                rect,
                                Rounding::same(12.0),
                                with_alpha(SUCCESS, 30),
                            );
                            for (index, height) in
                                [8.0_f32, 14.0, 20.0, 11.0].iter().enumerate()
                            {
                                let x = rect.left() + 10.0 + index as f32 * 6.0;
                                let bar = egui::Rect::from_min_max(
                                    egui::pos2(x, rect.center().y - height / 2.0),
                                    egui::pos2(x + 3.0, rect.center().y + height / 2.0),
                                );
                                ui.painter().rect_filled(
                                    bar,
                                    Rounding::same(1.5),
                                    SUCCESS,
                                );
                            }
                            ui.add_space(6.0);
                            ui.vertical(|ui| {
                                ui.label(
                                    RichText::new("Звук готов")
                                        .family(semibold())
                                        .size(13.6)
                                        .color(TEXT),
                                );
                                ui.add(
                                    egui::Label::new(
                                        RichText::new(
                                            "Можно проверить его без Twitch — ниже локальные привязки.",
                                        )
                                        .size(11.6)
                                        .color(TEXT_DIM),
                                    )
                                    .wrap(),
                                );
                            });
                        });
                    });
                });
                },
            );
        });

        ui.add_space(12.0);
        self.local_bindings_card(ui);

        if go_settings {
            self.tab = Tab::Settings;
            self.touch();
        }
        if open_help {
            let _ = webbrowser::open("https://dev.twitch.tv/console/apps");
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn quick_start_step(
        &mut self,
        ui: &mut egui::Ui,
        number: u32,
        active: bool,
        title: &str,
        text: &str,
        action: Option<(&str, &mut bool)>,
        secondary: Option<&str>,
        secondary_clicked: &mut bool,
    ) {
        ui.horizontal(|ui| {
            let (circle, _) = ui.allocate_exact_size(Vec2::splat(30.0), Sense::hover());
            let (fill, text_color) = if active {
                (TEXT, BG)
            } else {
                (Color32::TRANSPARENT, TEXT_DIM)
            };
            ui.painter().circle_filled(circle.center(), 15.0, fill);
            if !active {
                ui.painter().circle_stroke(
                    circle.center(),
                    14.0,
                    Stroke::new(1.0_f32, with_alpha(Color32::WHITE, 44)),
                );
            }
            ui.painter().text(
                circle.center(),
                Align2::CENTER_CENTER,
                number.to_string(),
                FontId::new(13.6, semibold()),
                text_color,
            );
            ui.add_space(6.0);
            ui.vertical(|ui| {
                ui.label(RichText::new(title).family(semibold()).size(15.6).color(TEXT));
                hint(ui, text);
                if let Some((label, clicked)) = action {
                    ui.add_space(8.0);
                    ui.horizontal(|ui| {
                        if accent_button(ui, label).clicked() {
                            *clicked = true;
                        }
                        if let Some(secondary) = secondary {
                            if ghost_button(ui, secondary, TEXT_DIM).clicked() {
                                *secondary_clicked = true;
                            }
                        }
                    });
                }
            });
        });
    }

    /// Локальные привязки звуков: доступны даже без Twitch.
    fn local_bindings_card(&mut self, ui: &mut egui::Ui) {
        let bindings = self.settings.twitch_rewards.clone();
        if bindings.is_empty() {
            return;
        }
        self.ensure_file_cache();
        let cache = self.file_cache.clone();
        let playing = self.playing.clone();
        let mut action: Option<RewardUiAction> = None;
        let mut toggle_all = false;
        let limit = if self.local_bindings_open {
            bindings.len()
        } else {
            3.min(bindings.len())
        };

        card_frame().show(ui, |ui| {
            ui.set_width(ui.available_width());
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(format!("Локальные привязки · {}", bindings.len()))
                        .family(semibold())
                        .size(15.0)
                        .color(TEXT),
                );
                ui.add_space(4.0);
                let chip = pill_button(ui, "работают без Twitch", TEXT_DIM);
                chip.on_hover_text("Файлы и громкость хранятся локально");
                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    let label = if self.local_bindings_open {
                        "Свернуть"
                    } else {
                        "Показать все"
                    };
                    if bindings.len() > 3 && ghost_button(ui, label, TEXT_DIM).clicked() {
                        toggle_all = true;
                    }
                });
            });
            ui.add_space(6.0);

            let columns = if ui.available_width() >= 820.0 { 3 } else { 2 };
            let chunk = limit.max(1);
            for row in bindings[..chunk].chunks(columns) {
                ui.columns(columns, |cols| {
                    for (index, binding) in row.iter().enumerate() {
                        if index >= cols.len() {
                            break;
                        }
                        let ui = &mut cols[index];
                        let cached = cache.get(&binding.path);
                        let exists = cached.map(|file| file.exists).unwrap_or(true);
                        let (meta, _) = sound_meta(&binding.path, cached);
                        egui::Frame::none()
                            .fill(blend_over(CARD, with_alpha(Color32::WHITE, 3)))
                            .stroke(Stroke::new(
                                1.0_f32,
                                blend_over(CARD, with_alpha(Color32::WHITE, 22)),
                            ))
                            .rounding(Rounding::same(12.0))
                            .inner_margin(egui::Margin::symmetric(10.0, 8.0))
                            .show(ui, |ui| {
                                ui.set_width(ui.available_width());
                                ui.horizontal(|ui| {
                                    ui.add(
                                        egui::Label::new(
                                            RichText::new(if binding.title.is_empty() {
                                                "Без названия"
                                            } else {
                                                &binding.title
                                            })
                                            .size(12.6)
                                            .color(TEXT),
                                        )
                                        .truncate(),
                                    )
                                    .on_hover_text(&binding.title);
                                    ui.with_layout(
                                        Layout::right_to_left(Align::Center),
                                        |ui| {
                                            ui.label(
                                                RichText::new(
                                                    meta.split('·')
                                                        .nth(1)
                                                        .map(str::trim)
                                                        .unwrap_or("—"),
                                                )
                                                .size(10.8)
                                                .color(TEXT_DIM),
                                            );
                                        },
                                    );
                                });
                                ui.add_space(4.0);
                                ui.horizontal(|ui| {
                                    if sound_play_button(ui, 22.0, exists).clicked() && exists {
                                        action = Some(RewardUiAction::Play {
                                            reward_id: binding.reward_id.clone(),
                                            path: binding.path.clone(),
                                        });
                                    }
                                    let mut volume = binding.volume as f32;
                                    let slider = fader(ui, &mut volume, 0.0, 2.0, 70.0);
                                    let mut volume = volume as f64;
                                    ui.label(
                                        RichText::new(format!(
                                            "{}%",
                                            (volume * 100.0).round() as i32
                                        ))
                                        .size(10.4)
                                        .color(TEXT_DIM),
                                    );
                                    if slider.changed() {
                                        action = Some(RewardUiAction::SetVolume {
                                            reward_id: binding.reward_id.clone(),
                                            volume,
                                        });
                                    }
                                    if self.local_bindings_open {
                                        ui.with_layout(
                                            Layout::right_to_left(Align::Center),
                                            |ui| {
                                                if ghost_button(
                                                    ui,
                                                    "Убрать",
                                                    with_alpha(DANGER, 210),
                                                )
                                                .clicked()
                                                {
                                                    action =
                                                        Some(RewardUiAction::Clear {
                                                            reward_id: binding
                                                                .reward_id
                                                                .clone(),
                                                        });
                                                }
                                            },
                                        );
                                    } else if playing.iter().any(|id| id == &binding.reward_id) {
                                        ui.label(
                                            RichText::new("играет")
                                                .size(10.4)
                                                .color(SUCCESS),
                                        );
                                    }
                                });
                            });
                    }
                });
                ui.add_space(8.0);
            }

            ui.add_space(2.0);
            hint(
                ui,
                "Файлы и громкость хранятся локально — их можно менять и слушать даже без подключения к Twitch.",
            );
        });

        if toggle_all {
            self.local_bindings_open = !self.local_bindings_open;
            self.touch();
        }
        if let Some(action) = action {
            self.apply_reward_action(action);
        }
    }

    // ---------- управление наградами ----------

    fn open_create_reward(&mut self) {
        self.reward_delete = None;
        self.reward_editor = Some(RewardEditor {
            id: None,
            title: String::new(),
            cost: 500,
            color: [0xA9, 0x70, 0xFF],
            sound: None,
            error: None,
            pending: false,
            focus_title: true,
        });
        self.touch();
    }

    fn open_edit_reward(&mut self, reward: twitch::RemoteReward) {
        let sound = self
            .settings
            .reward_sound(&reward.id)
            .map(|binding| binding.path.clone());
        self.reward_editor = Some(RewardEditor {
            id: Some(reward.id),
            title: reward.title,
            cost: reward.cost,
            color: parse_hex_color(&reward.color).map_or([0xA9, 0x70, 0xFF], |color| {
                [color.r(), color.g(), color.b()]
            }),
            sound,
            error: None,
            pending: false,
            focus_title: true,
        });
        self.touch();
    }

    fn twitch_auth(&self) -> Option<(String, String, String)> {
        let client_id = self.settings.twitch.client_id.trim().to_string();
        let access = self.settings.twitch.access_token()?;
        let broadcaster = self.settings.twitch.user_id.clone();
        if client_id.is_empty() || broadcaster.is_empty() {
            return None;
        }
        Some((client_id, access, broadcaster))
    }

    fn submit_reward_editor(&mut self) {
        let Some(editor) = self.reward_editor.clone() else {
            return;
        };
        let draft = twitch::RewardDraft {
            title: editor.title.clone(),
            cost: editor.cost,
            color: format!(
                "#{:02X}{:02X}{:02X}",
                editor.color[0], editor.color[1], editor.color[2]
            ),
            // Обычные награды создаются без требования ввода текста.
            requires_input: false,
        };
        if let Err(message) = draft.validate() {
            if let Some(editor) = &mut self.reward_editor {
                editor.error = Some(message);
                editor.pending = false;
            }
            return;
        }

        let Some((client_id, access, broadcaster)) = self.twitch_auth() else {
            if let Some(editor) = &mut self.reward_editor {
                editor.pending = false;
                editor.error = Some("Сначала подключите Twitch в настройках.".to_string());
            }
            return;
        };

        match editor.id.clone() {
            Some(reward_id) => {
                // Звук привязываем сразу: ID награды уже известен.
                self.apply_editor_sound(&reward_id, editor.sound.as_deref(), &editor.title);
                self.twitch_service.update_reward(
                    &client_id,
                    &access,
                    &broadcaster,
                    &reward_id,
                    draft,
                );
            }
            None => {
                self.pending_created_sound = editor.sound.clone();
                self.twitch_service
                    .create_reward(&client_id, &access, &broadcaster, draft);
            }
        }
        self.reward_busy = true;
        self.touch();
    }

    /// Привязывает выбранный в редакторе звук к награде (или отвязывает).
    fn apply_editor_sound(&mut self, reward_id: &str, sound: Option<&str>, title: &str) {
        match sound {
            Some(path) if !path.trim().is_empty() => {
                self.settings.set_reward_sound(reward_id, title, path);
                self.mark_dirty();
                log::info!("Награда {reward_id}: звук выбран в редакторе");
            }
            _ => {
                if self.settings.clear_reward_sound(reward_id) {
                    self.mark_dirty();
                    log::info!("Награда {reward_id}: звук отвязан в редакторе");
                }
            }
        }
    }

    fn confirm_reward_delete(&mut self, reward: twitch::RemoteReward) {
        let Some((client_id, access, broadcaster)) = self.twitch_auth() else {
            self.reward_delete = None;
            self.notify("Сначала подключите Twitch в настройках.", ToastKind::Error);
            return;
        };
        self.twitch_service.delete_reward(
            &client_id,
            &access,
            &broadcaster,
            &reward.id,
            &reward.title,
        );
        self.reward_busy = true;
        self.touch();
    }

    /// Окно создания/изменения награды.
    fn reward_editor_window(&mut self, ctx: &egui::Context) {
        let Some(mut editor) = self.reward_editor.take() else {
            return;
        };

        let is_edit = editor.id.is_some();
        let mut submit = false;
        let mut cancel = false;

        modal_scrim(ctx);
        if ctx.input(|input| input.key_pressed(egui::Key::Escape)) && !editor.pending {
            cancel = true;
        }
        let submit_on_enter = ctx.input(|input| input.key_pressed(egui::Key::Enter));

        let title = if is_edit {
            "Изменить награду"
        } else {
            "Новая награда"
        };
        let subtitle = if is_edit {
            "Изменения сразу уйдут на Twitch"
        } else {
            "Награда сразу появится у зрителей"
        };
        let master_volume = self.settings.effective_volume();
        let engine = self.engine.clone();

        let frame = egui::Frame::window(&ctx.style())
            .fill(PANEL)
            .rounding(Rounding::same(22.0))
            .stroke(Stroke::new(1.0_f32, BORDER))
            .inner_margin(egui::Margin::symmetric(28.0, 24.0));

        egui::Window::new(title)
            .id(egui::Id::new("reward_editor"))
            .title_bar(false)
            .collapsible(false)
            .resizable(false)
            .movable(false)
            .min_width(520.0)
            .max_width(520.0)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .frame(frame)
            .show(ctx, |ui| {
                ui.set_width(ui.available_width());

                ui.label(
                    RichText::new(title)
                        .family(semibold())
                        .size(28.8)
                        .color(TEXT),
                );
                ui.label(RichText::new(subtitle).size(15.0).color(TEXT_DIM));
                ui.add_space(20.0);

                ui.label(
                    RichText::new("НАЗВАНИЕ")
                        .size(12.0)
                        .color(with_alpha(TEXT_DIM, 200)),
                );
                ui.add_space(4.0);
                let title_edit = ui.add_sized(
                    [ui.available_width(), 40.0],
                    egui::TextEdit::singleline(&mut editor.title)
                        .char_limit(45)
                        .hint_text("Например, «Сменить игру»"),
                );
                if editor.focus_title {
                    title_edit.request_focus();
                    editor.focus_title = false;
                }

                ui.add_space(14.0);
                ui.horizontal(|ui| {
                    ui.vertical(|ui| {
                        ui.label(
                            RichText::new("СТОИМОСТЬ, БАЛЛОВ")
                                .size(12.0)
                                .color(with_alpha(TEXT_DIM, 200)),
                        );
                        ui.add_space(4.0);
                        ui.add(
                            egui::DragValue::new(&mut editor.cost)
                                .range(1..=1_000_000)
                                .speed(25.0),
                        );
                    });
                    ui.add_space(28.0);
                    ui.vertical(|ui| {
                        ui.label(
                            RichText::new("ЦВЕТ")
                                .size(12.0)
                                .color(with_alpha(TEXT_DIM, 200)),
                        );
                        ui.add_space(4.0);
                        ui.horizontal(|ui| {
                            ui.color_edit_button_srgb(&mut editor.color);
                            ui.label(
                                RichText::new(format!(
                                    "#{:02X}{:02X}{:02X}",
                                    editor.color[0], editor.color[1], editor.color[2]
                                ))
                                .size(13.2)
                                .monospace()
                                .color(TEXT_DIM),
                            );
                        });
                    });
                });

                ui.add_space(18.0);
                ui.label(
                    RichText::new("ЗВУК НАГРАДЫ")
                        .size(12.0)
                        .color(with_alpha(TEXT_DIM, 200)),
                );
                ui.add_space(6.0);
                egui::Frame::none()
                    .fill(CARD)
                    .rounding(Rounding::same(14.0))
                    .inner_margin(egui::Margin::symmetric(16.0, 14.0))
                    .show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        match &editor.sound {
                            Some(path) => {
                                ui.label(
                                    RichText::new(util::file_name(Path::new(path)))
                                        .size(15.6)
                                        .color(TEXT),
                                );
                                ui.add(
                                    egui::Label::new(
                                        RichText::new(path).size(12.0).color(TEXT_DIM),
                                    )
                                    .truncate(),
                                );
                            }
                            None => {
                                ui.label(
                                    RichText::new("Файл не выбран — награда будет без звука")
                                        .size(14.4)
                                        .color(TEXT_DIM),
                                );
                            }
                        }
                        ui.add_space(10.0);
                        ui.horizontal(|ui| {
                            if secondary_button(
                                ui,
                                if editor.sound.is_some() {
                                    "Заменить"
                                } else {
                                    "Выбрать звук"
                                },
                            )
                            .clicked()
                            {
                                if let Some(path) = pick_audio_file() {
                                    if !audio::is_supported_file(&path) {
                                        editor.error =
                                            Some(audio::unsupported_format_message(&path));
                                    } else if std::fs::metadata(&path)
                                        .map(|meta| meta.len() == 0)
                                        .unwrap_or(false)
                                    {
                                        editor.error = Some("Выбранный файл пустой.".to_string());
                                    } else {
                                        editor.sound = Some(path.display().to_string());
                                        editor.error = None;
                                    }
                                }
                            }
                            if let Some(path) = editor.sound.clone() {
                                if ghost_button(ui, "▶  Прослушать", with_alpha(ACCENT, 230))
                                    .clicked()
                                {
                                    let _ = engine.play(
                                        "__editor_preview__",
                                        PathBuf::from(&path),
                                        master_volume,
                                    );
                                }
                                if ghost_button(ui, "Убрать", with_alpha(DANGER, 220)).clicked() {
                                    editor.sound = None;
                                }
                            }
                        });
                    });

                if let Some(error) = &editor.error {
                    ui.add_space(14.0);
                    egui::Frame::none()
                        .fill(with_alpha(DANGER, 22))
                        .rounding(Rounding::same(10.0))
                        .inner_margin(egui::Margin::symmetric(14.0, 10.0))
                        .show(ui, |ui| {
                            ui.add(
                                egui::Label::new(RichText::new(error).size(13.8).color(DANGER))
                                    .wrap(),
                            );
                        });
                }

                ui.add_space(20.0);
                ui.horizontal(|ui| {
                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        if accent_button(ui, if is_edit { "Сохранить" } else { "Создать" })
                            .clicked()
                            && !editor.pending
                        {
                            submit = true;
                        }
                        if secondary_button(ui, "Отмена").clicked() && !editor.pending {
                            cancel = true;
                        }
                        if editor.pending {
                            ui.add(egui::Spinner::new().size(16.0));
                        }
                    });
                });
            });
        if submit_on_enter && !editor.pending && !cancel {
            submit = true;
        }
        if submit {
            editor.pending = true;
            editor.error = None;
            self.reward_editor = Some(editor);
            self.submit_reward_editor();
        } else if cancel {
            self.reward_editor = None;
        } else {
            self.reward_editor = Some(editor);
        }
    }

    /// Окно подтверждения удаления награды.
    fn reward_delete_window(&mut self, ctx: &egui::Context) {
        let Some(reward) = self.reward_delete.clone() else {
            return;
        };

        let mut confirm = false;
        let mut cancel = false;

        modal_scrim(ctx);
        if ctx.input(|input| input.key_pressed(egui::Key::Escape)) && !self.reward_busy {
            cancel = true;
        }

        egui::Window::new("Удалить награду?")
            .collapsible(false)
            .resizable(false)
            .movable(false)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .show(ctx, |ui| {
                ui.set_width(420.0);
                ui.add(
                    egui::Label::new(
                        RichText::new(format!("Удалить награду «{}» на Twitch?", reward.title))
                            .size(15.6)
                            .color(TEXT),
                    )
                    .wrap(),
                );
                ui.add_space(4.0);
                ui.label(
                    RichText::new("Действие необратимо: награда исчезнет у зрителей.")
                        .size(13.8)
                        .color(DANGER),
                );
                ui.add_space(6.0);
                paragraph(
                    ui,
                    "Локальная привязка звука останется в «Локальных привязках» — файл не удалится.",
                    TEXT_DIM,
                    13.2,
                );
                ui.add_space(12.0);
                ui.horizontal(|ui| {
                    if danger_button(ui, "Удалить").clicked() && !self.reward_busy {
                        confirm = true;
                    }
                    if secondary_button(ui, "Отмена").clicked() && !self.reward_busy {
                        cancel = true;
                    }
                    if self.reward_busy {
                        ui.add(egui::Spinner::new().size(14.0));
                    }
                });
            });

        if confirm {
            self.confirm_reward_delete(reward);
        } else if cancel {
            self.reward_delete = None;
        }
    }

    // ---------- раздел «Настройки» ----------

    fn settings_tab(&mut self, ui: &mut egui::Ui) {
        let (save_text, save_color) = if self.save_at.is_some() {
            ("Сохраняем…", WARN)
        } else if self
            .saved_at
            .map(|at| at.elapsed() < Duration::from_secs(4))
            .unwrap_or(false)
        {
            ("✓ Сохранено", SUCCESS)
        } else {
            ("Изменения сохраняются автоматически", TEXT_DIM)
        };

        ui.label(
            RichText::new("Настройки")
                .family(semibold())
                .size(36.0)
                .strong()
                .color(TEXT),
        );
        ui.label(RichText::new(save_text).size(14.4).color(save_color));
        ui.add_space(12.0);

        egui::ScrollArea::vertical()
            .id_source("settings-scroll")
            .auto_shrink([false, false])
            .show(ui, |ui| {
                self.twitch_card(ui);
                self.launch_card(ui);
                ui.add_space(10.0);
                ui.add_space(10.0);
                self.volume_card(ui);
                ui.add_space(10.0);
                self.audio_card(ui);
                ui.add_space(10.0);
                self.storage_card(ui);
                ui.add_space(10.0);
                self.about_card(ui);
            });
    }

    fn twitch_card(&mut self, ui: &mut egui::Ui) {
        section_card(ui, "Подключение к Twitch", |ui| match self.twitch_state {
            TwitchState::Disconnected => self.twitch_disconnected_view(ui),
            TwitchState::Busy => self.twitch_busy_view(ui),
            TwitchState::Waiting => self.twitch_waiting_view(ui),
            TwitchState::Connected => self.twitch_connected_view(ui),
        });
    }

    fn twitch_disconnected_view(&mut self, ui: &mut egui::Ui) {
        paragraph(
            ui,
            "Приложение подключится к Twitch, чтобы получать награды канала. Пароль вводится только на сайте Twitch — приложение его не видит. Client Secret не требуется.",
            TEXT_DIM,
            13.8,
        );
        ui.add_space(10.0);

        ui.horizontal(|ui| {
            ui.label(RichText::new("Client ID").size(14.4).strong().color(TEXT));
            let response = egui::Frame::none()
                .fill(egui::Color32::from_rgb(0x0B, 0x0D, 0x12))
                .stroke(Stroke::new(1.0_f32, with_alpha(BORDER, 160)))
                .rounding(Rounding::same(16.0))
                .inner_margin(egui::Margin::symmetric(8.0, 5.0))
                .show(ui, |ui| {
                    ui.add(
                        egui::TextEdit::singleline(&mut self.settings.twitch.client_id)
                            .frame(false)
                            .desired_width(340.0)
                            .hint_text("30 букв и цифр из Twitch Developer Console")
                            .font(egui::FontId::proportional(12.5)),
                    )
                })
                .inner;
            if response.changed() {
                self.twitch_error = None;
                self.mark_dirty();
            }
        });

        ui.add_space(8.0);
        let mut connect = false;
        let mut help = false;
        ui.horizontal(|ui| {
            let valid = self.settings.twitch.client_id_looks_valid();
            connect = ui
                .add_enabled_ui(valid, |ui| accent_button(ui, "Подключить Twitch"))
                .inner
                .clicked();
            help = secondary_button(ui, "Где взять Client ID?").clicked();
        });
        if connect {
            self.start_twitch_login();
        }
        if help {
            let _ = webbrowser::open("https://dev.twitch.tv/console/apps");
        }

        ui.add_space(8.0);
        hint(
            ui,
            "Создайте приложение на dev.twitch.tv/console/apps (тип Public), скопируйте Client ID и вставьте сюда. Подробная инструкция — в README.md, раздел «Подключение к Twitch».",
        );

        if let Some(error) = &self.twitch_error {
            ui.add_space(6.0);
            ui.add(egui::Label::new(RichText::new(error).size(13.8).color(DANGER)).wrap());
        }
    }

    fn twitch_busy_view(&mut self, ui: &mut egui::Ui) {
        let text = self
            .twitch_progress
            .clone()
            .unwrap_or_else(|| "Подключаемся к Twitch…".to_string());
        ui.horizontal(|ui| {
            ui.add(egui::Spinner::new().size(16.0));
            ui.label(RichText::new(text).size(15.0).color(TEXT));
        });
        ui.add_space(8.0);
        if secondary_button(ui, "Отмена").clicked() {
            self.cancel_twitch_login();
        }
        if let Some(error) = &self.twitch_error {
            ui.add_space(6.0);
            ui.add(egui::Label::new(RichText::new(error).size(13.8).color(DANGER)).wrap());
        }
    }

    fn twitch_waiting_view(&mut self, ui: &mut egui::Ui) {
        let Some((user_code, verification_uri, minutes_left)) = self.twitch_code.as_ref().map(|code| {
            (
                code.user_code.clone(),
                code.verification_uri.clone(),
                code.expires_at.saturating_duration_since(Instant::now()).as_secs() / 60,
            )
        }) else {
            return;
        };

        paragraph(
            ui,
            "Браузер уже открыт. Введите этот код на странице Twitch:",
            TEXT_DIM,
            13.8,
        );
        ui.add_space(8.0);

        egui::Frame::none()
            .fill(with_alpha(ACCENT, 26))
            .stroke(Stroke::new(1.0_f32, with_alpha(ACCENT, 90)))
            .rounding(Rounding::same(18.0))
            .inner_margin(egui::Margin::symmetric(18.0, 10.0))
            .show(ui, |ui| {
                ui.label(
                    RichText::new(&user_code)
                        .size(31.2)
                        .monospace()
                        .strong()
                        .color(ACCENT),
                );
            });

        ui.add_space(8.0);
        let mut open_page = false;
        let mut copy = false;
        let mut cancel = false;
        ui.horizontal(|ui| {
            open_page = accent_button(ui, "Открыть страницу Twitch").clicked();
            copy = secondary_button(ui, "Скопировать код").clicked();
            cancel = secondary_button(ui, "Отмена").clicked();
        });

        if open_page {
            if webbrowser::open(&verification_uri).is_err() {
                self.notify("Не удалось открыть браузер. Откройте twitch.tv/activate вручную.", ToastKind::Warning);
            }
        }
        if copy {
            ui.ctx().copy_text(user_code.clone());
            self.notify("Код скопирован в буфер обмена.", ToastKind::Info);
        }
        if cancel {
            self.cancel_twitch_login();
        }

        ui.add_space(6.0);
        hint(
            ui,
            &format!(
                "Код действует ещё примерно {minutes_left} мин. После подтверждения на Twitch окно обновится само."
            ),
        );

        if let Some(progress) = &self.twitch_progress {
            ui.add_space(4.0);
            ui.horizontal(|ui| {
                ui.add(egui::Spinner::new().size(12.0));
                ui.label(RichText::new(progress).size(13.2).color(TEXT_DIM));
            });
        }
        if let Some(error) = &self.twitch_error {
            ui.add_space(6.0);
            ui.add(egui::Label::new(RichText::new(error).size(13.8).color(DANGER)).wrap());
        }
    }

    fn twitch_connected_view(&mut self, ui: &mut egui::Ui) {
        let account = self.settings.twitch.account_label();
        let login = self.settings.twitch.login.clone();

        ui.horizontal(|ui| {
            ui.label(RichText::new("Аккаунт").size(13.8).color(TEXT_DIM));
            ui.label(RichText::new(account).size(16.8).strong().color(TEXT));
            ui.label(RichText::new(format!("@{login}")).size(13.8).color(TEXT_DIM));
            ui.label(RichText::new("подключён").size(13.8).color(SUCCESS));
        });
        ui.add_space(4.0);
        hint(
            ui,
            "Вход сохраняется между запусками, токен обновляется автоматически. Пароль и Client Secret приложение не хранит.",
        );

        ui.add_space(6.0);
        ui.horizontal(|ui| {
            ui.label(RichText::new("Активации наград").size(13.2).color(TEXT_DIM));
            let (listen_text, listen_color) = self.eventsub_status();
            ui.label(RichText::new(listen_text).size(13.8).color(listen_color));
        });
        if let Some(error) = &self.eventsub_error {
            ui.add(
                egui::Label::new(RichText::new(error).size(12.6).color(WARN)).wrap(),
            );
        }
        if self.eventsub_state != EventSubState::Listening {
            if secondary_button(ui, "Переподключить события").clicked() {
                self.start_eventsub();
            }
            ui.add_space(8.0);
        }
        ui.add_space(8.0);
        let mut refresh = false;
        let mut disconnect = false;
        ui.horizontal(|ui| {
            refresh = secondary_button(ui, "Обновить данные").clicked();
            disconnect = danger_button(ui, "Отключить Twitch").clicked();
        });
        if refresh {
            self.refresh_twitch_now();
        }
        if disconnect {
            self.confirm = Some(ConfirmDialog {
                title: "Отключить Twitch?".to_string(),
                text: "Приложение перестанет получать активации наград, пока вы снова не войдёте. Привязки звуков и локальные файлы останутся на месте.".to_string(),
                confirm_label: "Отключить".to_string(),
                action: ConfirmAction::DisconnectTwitch,
                danger: true,
            });
            self.touch();
        }

        if let Some(error) = &self.twitch_error {
            ui.add_space(6.0);
            ui.add(egui::Label::new(RichText::new(error).size(13.8).color(DANGER)).wrap());
        }
    }

    fn launch_card(&mut self, ui: &mut egui::Ui) {
        section_card(ui, "Запуск и системный трей", |ui| {
            ui.horizontal(|ui| {
                if toggle(ui, &mut self.settings.close_to_tray) {
                    self.mark_dirty();
                }
                ui.label("Закрывать окно в трей, не завершая программу");
            });

            ui.add_space(8.0);
            ui.horizontal(|ui| {
                if toggle(ui, &mut self.settings.start_minimized) {
                    self.mark_dirty();
                }
                ui.label("При запуске показывать только иконку в трее");
            });

            ui.add_space(8.0);
            ui.horizontal(|ui| {
                let mut autostart_flag = self.settings.autostart;
                if toggle(ui, &mut autostart_flag) {
                    match autostart::set_enabled(autostart_flag) {
                        Ok(()) => {
                            self.settings.autostart = autostart_flag;
                            self.mark_dirty();
                        }
                        Err(err) => {
                            log::error!("Автозапуск: {err}");
                            self.notify(format!("Автозапуск: {err}"), ToastKind::Error);
                        }
                    }
                }
                ui.label("Запускать вместе с Windows");
            });

            ui.add_space(6.0);
            let tray_ready = self.tray.is_available() || self.demo;
            ui.horizontal(|ui| {
                if ui
                    .add_enabled_ui(tray_ready, |ui| secondary_button(ui, "Свернуть в трей"))
                    .inner
                    .clicked()
                {
                    self.hide_to_tray(ui.ctx());
                }
                let (tray_text, tray_color) = if tray_ready {
                    ("трей доступен", SUCCESS)
                } else {
                    ("трей недоступен", WARN)
                };
                ui.label(RichText::new(tray_text).size(12.6).color(tray_color));
            });
            ui.add_space(6.0);
            hint(
                ui,
                "Иконка в трее: левый клик — открыть окно, правый клик — меню (открыть, включить/выключить звуки, остановить все звуки, выход).",
            );
        });
    }

    fn volume_card(&mut self, ui: &mut egui::Ui) {
        section_card(ui, "Громкость", |ui| {
            ui.horizontal(|ui| {
                let mut volume = self.settings.volume;
                let response = fader(ui, &mut volume, 0.0, 1.0, 240.0);
                if response.changed() {
                    self.settings.volume = volume;
                    self.settings.muted = false;
                    self.apply_volume();
                    self.mark_dirty();
                    self.touch();
                }
                ui.label(
                    RichText::new(self.settings.volume_label())
                        .size(15.6)
                        .monospace()
                        .color(TEXT),
                );

                ui.add_space(16.0);
                let mut muted = self.settings.muted;
                if toggle(ui, &mut muted) {
                    self.settings.muted = muted;
                    self.apply_volume();
                    self.mark_dirty();
                    self.touch();
                }
                ui.label(
                    RichText::new("Без звука")
                        .size(13.8)
                        .color(TEXT_DIM),
                );
            });

            ui.add_space(6.0);
            ui.horizontal(|ui| {
                let mut playback = self.settings.playback_enabled;
                if toggle(ui, &mut playback) {
                    self.set_playback_enabled(playback);
                }
                ui.label("Воспроизводить звуки наград");
            });

            if self.settings.muted {
                ui.add_space(4.0);
                ui.add(
                    egui::Label::new(
                        RichText::new("Включён режим «Без звука»: награды будут запускаться без звука.")
                            .size(13.2)
                            .color(WARN),
                    )
                    .wrap(),
                );
            }
            ui.add_space(6.0);
            hint(
                ui,
                "Громкость действует только на звуки Reward Sounds. Громкость Windows не меняется.",
            );
        });
    }

    fn audio_card(&mut self, ui: &mut egui::Ui) {
        let device = self.audio.device.clone();

        section_card(ui, "Аудиовыход", |ui| {
            ui.horizontal(|ui| {
                ui.label(RichText::new("Устройство").size(13.8).color(TEXT_DIM));
                match &device {
                    Some(name) => ui.label(RichText::new(name).size(15.0).color(TEXT)),
                    None => ui.label(
                        RichText::new("недоступно — проверьте колонки или наушники")
                            .size(15.0)
                            .color(DANGER),
                    ),
                };
            });

            ui.add_space(8.0);
            ui.horizontal(|ui| {
                if secondary_button(ui, "Проверить звук").clicked() {
                    match self.engine.play_test_tone(self.settings.effective_volume()) {
                        Ok(()) => {
                            self.touch();
                            self.notify(
                                "Тестовый сигнал отправлен на устройство вывода.",
                                ToastKind::Info,
                            );
                        }
                        Err(err) => self.notify(err, ToastKind::Error),
                    }
                }
                if secondary_button(ui, "Перезапустить аудио").clicked() {
                    self.restart_audio();
                }
                if secondary_button(ui, "Остановить все звуки").clicked() {
                    if let Err(err) = self.engine.stop_all() {
                        self.notify(err, ToastKind::Error);
                    }
                    self.touch();
                }
            });

            ui.add_space(10.0);
            ui.horizontal(|ui| {
                let ready = !self.normalizing && !self.settings.twitch_rewards.is_empty();
                if ui
                    .add_enabled_ui(ready, |ui| {
                        secondary_button(ui, "Выровнять громкость звуков")
                    })
                    .inner
                    .clicked()
                {
                    self.confirm = Some(ConfirmDialog {
                        title: "Выровнять громкость звуков?".to_string(),
                        text: "Приложение измерит громкость каждого файла и перезапишет индивидуальные ползунки громкости. Текущие значения можно будет вернуть только вручную.".to_string(),
                        confirm_label: "Выровнять".to_string(),
                        action: ConfirmAction::NormalizeVolumes,
                        danger: false,
                    });
                    self.touch();
                }
                if self.normalizing {
                    ui.add(egui::Spinner::new().size(14.0));
                    ui.label(RichText::new("Измеряем громкость…").size(13.2).color(TEXT_DIM));
                }
            });

            ui.add_space(6.0);
            hint(
                ui,
                "Выравнивание измеряет громкость каждого файла и подстраивает индивидуальные ползунки, чтобы звуки наград звучали ровно относительно друг друга.",
            );
            ui.add_space(4.0);
            hint(
                ui,
                "Используется текущее устройство вывода Windows. Если вы переключите звук в системе, приложение подхватит новое устройство автоматически (в течение нескольких секунд).",
            );
        });
    }

    /// Запускает фоновое измерение громкости всех привязанных звуков.
    fn start_normalize(&mut self) {
        if self.normalizing {
            return;
        }

        let files: Vec<(String, PathBuf)> = self
            .settings
            .twitch_rewards
            .iter()
            .filter(|reward| !reward.path.trim().is_empty())
            .map(|reward| (reward.reward_id.clone(), PathBuf::from(&reward.path)))
            .filter(|(_, path)| path.is_file())
            .collect();

        if files.is_empty() {
            self.notify(
                "Нет привязанных звуков для выравнивания.",
                ToastKind::Warning,
            );
            return;
        }

        self.normalizing = true;
        let (sender, receiver) = std::sync::mpsc::channel();
        self.normalize_rx = Some(receiver);

        std::thread::Builder::new()
            .name("reward-sounds-normalize".to_string())
            .spawn(move || {
                let mut result = Vec::new();
                for (reward_id, path) in files {
                    match audio::measure_loudness(&path) {
                        Ok(loudness) => {
                            let volume =
                                audio::normalization_volume(loudness, audio::NORMALIZE_TARGET_RMS);
                            result.push((reward_id, volume as f64));
                        }
                        Err(err) => log::warn!(
                            "Не удалось измерить громкость {}: {err}",
                            path.display()
                        ),
                    }
                }
                let _ = sender.send(result);
            })
            .ok();

        self.touch();
    }

    /// Забирает результат выравнивания громкости.
    fn poll_normalize(&mut self) {
        let Some(receiver) = &self.normalize_rx else {
            return;
        };

        match receiver.try_recv() {
            Ok(result) => {
                self.normalize_rx = None;
                self.normalizing = false;

                if result.is_empty() {
                    self.notify(
                        "Не удалось измерить громкость звуков.",
                        ToastKind::Error,
                    );
                } else {
                    let count = result.len();
                    for (reward_id, volume) in &result {
                        self.settings.set_sound_volume(reward_id, *volume);
                    }
                    self.mark_dirty();
                    self.touch();
                    self.notify(
                        format!(
                            "Громкость выровнена по {count} {}.",
                            util::plural_ru(count, "звуку", "звукам", "звукам")
                        ),
                        ToastKind::Success,
                    );
                }
            }
            Err(std::sync::mpsc::TryRecvError::Empty) => {}
            Err(std::sync::mpsc::TryRecvError::Disconnected) => {
                self.normalize_rx = None;
                self.normalizing = false;
            }
        }
    }

    fn restart_audio(&mut self) {
        log::info!("Перезапуск аудиодвижка по запросу пользователя");
        self.engine = AudioEngine::spawn();
        self.audio = AudioStatus::default();
        self.playing.clear();
        self.touch();
        self.notify("Аудиовыход перезапущен.", ToastKind::Info);
    }

    fn storage_card(&mut self, ui: &mut egui::Ui) {
        let config = self.paths.config_file.display().to_string();
        let log = self.paths.log_file.display().to_string();
        let data_dir = self.paths.data_dir.clone();
        let log_dir = self.paths.log_dir.clone();

        section_card(ui, "Данные приложения", |ui| {
            ui.label(RichText::new("Настройки").size(13.2).color(TEXT_DIM));
            ui.label(RichText::new(&config).size(13.2).monospace().color(TEXT));
            ui.add_space(6.0);
            ui.label(RichText::new("Журнал").size(13.2).color(TEXT_DIM));
            ui.label(RichText::new(&log).size(13.2).monospace().color(TEXT));
            ui.add_space(10.0);
            ui.horizontal(|ui| {
                if secondary_button(ui, "Открыть папку настроек").clicked() {
                    util::open_in_explorer(&data_dir);
                }
                if secondary_button(ui, "Открыть папку журнала").clicked() {
                    util::open_in_explorer(&log_dir);
                }
            });
        });
    }

    fn about_card(&mut self, ui: &mut egui::Ui) {
        section_card(ui, "О программе", |ui| {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(format!("Reward Sounds {}", crate::VERSION))
                        .size(15.0)
                        .color(TEXT),
                );
                ui.label(
                    RichText::new("· Windows · один EXE")
                        .size(13.2)
                        .color(TEXT_DIM),
                );
            });
            ui.add_space(6.0);
            paragraph(
                ui,
                "Приложение воспроизводит ваши локальные аудиофайлы при активации наград Twitch Channel Points. \
                 Работает без Streamer.bot и Speaker.bot, звуки не загружаются в интернет.",
                TEXT_DIM,
                13.8,
            );
        });
    }

    // ---------- раздел «Журнал» ----------

    fn log_tab(&mut self, ui: &mut egui::Ui) {
        let entries = self.logs.clone();
        let log_dir = self.paths.log_dir.clone();
        let log_file = self.paths.log_file.clone();
        let mut refresh = false;
        let mut open_dir = false;

        ui.horizontal(|ui| {
            ui.vertical(|ui| {
                ui.label(
                    RichText::new("Журнал")
                        .family(semibold())
                        .size(36.0)
                        .color(TEXT),
                );
                ui.label(
                    RichText::new("Последние события и ошибки приложения")
                        .size(14.4)
                        .color(TEXT_DIM),
                );
            });
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                if secondary_button(ui, "Открыть папку журнала").clicked() {
                    open_dir = true;
                }
                if secondary_button(ui, "Обновить").clicked() {
                    refresh = true;
                }
            });
        });

        ui.add_space(6.0);
        ui.horizontal_wrapped(|ui| {
            let mut show_debug = self.log_show_debug;
            if toggle(ui, &mut show_debug) {
                self.log_show_debug = show_debug;
                self.touch();
            }
            ui.label(RichText::new("Показывать отладку").size(13.0).color(TEXT_DIM));
            ui.add_space(10.0);
            let mut errors_only = self.log_errors_only;
            if toggle(ui, &mut errors_only) {
                self.log_errors_only = errors_only;
                self.touch();
            }
            ui.label(RichText::new("Только ошибки и предупреждения").size(13.0).color(TEXT_DIM));
            ui.add_space(10.0);
            let filtered_count = entries
                .iter()
                .filter(|entry| {
                    (!self.log_errors_only
                        || matches!(entry.level, log::Level::Error | log::Level::Warn))
                        && (self.log_show_debug || entry.level != log::Level::Debug)
                })
                .count();
            ui.label(
                RichText::new(format!("Записей: {filtered_count}"))
                    .size(12.6)
                    .color(TEXT_DIM),
            );
        });

        ui.add_space(6.0);
        ui.add(
            egui::Label::new(
                RichText::new(format!("Файл: {}", log_file.display()))
                    .size(13.2)
                    .monospace()
                    .color(TEXT_DIM),
            )
            .truncate(),
        )
        .on_hover_text(log_file.display().to_string());
        ui.add_space(10.0);

        egui::Frame::none()
            .fill(CARD)
            .stroke(Stroke::new(1.0_f32, with_alpha(BORDER, 160)))
            .rounding(Rounding::same(18.0))
            .inner_margin(egui::Margin::symmetric(12.0, 10.0))
            .show(ui, |ui| {
                egui::ScrollArea::vertical()
                    .id_source("log-scroll")
                    .auto_shrink([false, false])
                    .stick_to_bottom(true)
                    .show(ui, |ui| {
                        let visible: Vec<&LogEntry> = entries
                            .iter()
                            .filter(|entry| {
                                (!self.log_errors_only
                                    || matches!(
                                        entry.level,
                                        log::Level::Error | log::Level::Warn
                                    ))
                                    && (self.log_show_debug
                                        || entry.level != log::Level::Debug)
                            })
                            .collect();
                        if visible.is_empty() {
                            ui.label(
                                RichText::new("Под этот фильтр записей нет.")
                                    .size(14.4)
                                    .color(TEXT_DIM),
                            );
                            return;
                        }

                        for entry in visible {
                            // В памяти хранится полная метка «2026-11-16 22:15:35.123»:
                            // показываем дату и время, чтобы журнал читался после перезапуска.
                            let stamp = entry.time.get(..19).unwrap_or(&entry.time);
                            ui.horizontal_top(|ui| {
                                ui.label(
                                    RichText::new(stamp)
                                        .size(12.8)
                                        .monospace()
                                        .color(TEXT_DIM),
                                );
                                ui.add_sized(
                                    [86.0, 16.0],
                                    egui::Label::new(
                                        RichText::new(entry.level_label())
                                            .size(12.4)
                                            .color(level_color(entry.level)),
                                    ),
                                );
                                ui.add(
                                    egui::Label::new(
                                        RichText::new(&entry.message)
                                            .size(13.8)
                                            .monospace()
                                            .color(TEXT),
                                    )
                                    .wrap()
                                    .sense(Sense::click()),
                                );
                            });
                        }
                    });
            });

        if refresh {
            self.logs = self.logger.entries();
            self.log_refresh_at = Instant::now() + Duration::from_millis(800);
            self.touch();
        }
        if open_dir {
            util::open_in_explorer(&log_dir);
        }
    }
}

impl RewardSoundsApp {
    // ---------- вкладка «Музыка» ----------

    fn music_tab(&mut self, ui: &mut egui::Ui) {
        let snapshot = self.music_snapshot.clone();
        let connected =
            self.settings.twitch.is_connected() || self.twitch_state == TwitchState::Connected;
        let listening = self.eventsub_state == EventSubState::Listening;
        let reward_ok = self.settings.music.has_reward()
            && self
                .remote_rewards
                .iter()
                .any(|reward| reward.id == self.settings.music.reward_id);
        let ytdlp_ok = snapshot.ytdlp_version.is_some();
        let enabled = self.settings.music.enabled;
        let ready = enabled && connected && listening && reward_ok && ytdlp_ok;

        let (status_label, status_color) = if !enabled {
            ("Приём выключен", TEXT_DIM)
        } else if !connected {
            ("Нужен Twitch", WARN)
        } else if !listening {
            ("Награды не слушаются", WARN)
        } else if !reward_ok {
            ("Не выбрана награда", WARN)
        } else if !ytdlp_ok {
            ("Нет yt-dlp", DANGER)
        } else {
            ("Принимаем заявки", SUCCESS)
        };
        let mut missing: Vec<&str> = Vec::new();
        if !connected {
            missing.push("Twitch не подключён");
        } else if !listening {
            missing.push("активации наград не слушаются");
        }
        if !reward_ok {
            missing.push("не выбрана награда");
        }
        if !ytdlp_ok {
            missing.push("не найден yt-dlp");
        }
        if !enabled {
            missing.push("приём заявок выключен");
        }

        let mut go_settings = false;
        let mut go_rewards = false;
        let mut open_obs = false;
        let mut open_price = false;
        let mut open_music_settings = false;
        let mut open_log = false;
        let mut recheck = false;
        let mut copy_overlay = false;
        let mut show_overlay = false;
        let mut open_overlay = false;
        let mut clear_queue = false;
        let mut replay: Option<String> = None;
        let mut remove: Option<String> = None;
        let mut move_up: Option<String> = None;
        let mut add_manual = false;
        let mut toggle_enabled = false;

        // ---- Шапка: заголовок и действия справа ----
        ui.horizontal(|ui| {
            ui.vertical(|ui| {
                ui.label(
                    RichText::new("Музыка")
                        .family(semibold())
                        .size(36.0)
                        .color(TEXT),
                );
                ui.label(
                    RichText::new("Треки по заявке: зритель присылает ссылку на YouTube в чат")
                        .size(15.0)
                        .color(TEXT_DIM),
                );
            });
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                let pill = status_pill(ui, status_label, status_color);
                let pill = pill.on_hover_text("Нажмите, чтобы включить или выключить приём заявок");
                if pill.clicked() {
                    toggle_enabled = true;
                }
                ui.add_space(4.0);
                if secondary_icon_button(ui, UiIcon::Eye, "Оверлей OBS").clicked() {
                    open_obs = true;
                }
                ui.add_space(4.0);
                ui.scope(|ui| {
                    ui.spacing_mut().button_padding = Vec2::new(8.0, 7.0);
                    ui.menu_button(
                        RichText::new("•••").size(13.0).color(TEXT_DIM),
                        |ui| {
                            ui.set_min_width(210.0);
                            if ui.button("Награда и цена").clicked() {
                                open_price = true;
                                ui.close_menu();
                            }
                            if ui.button("Настройки музыки").clicked() {
                                open_music_settings = true;
                                ui.close_menu();
                            }
                            if ui.button("Открыть журнал").clicked() {
                                open_log = true;
                                ui.close_menu();
                            }
                        },
                    );
                });
            });
        });

        // ---- Строка готовности: награда + yt-dlp ----
        ui.add_space(10.0);
        ui.horizontal_wrapped(|ui| {
            let reward_text = if reward_ok {
                format!(
                    "Награда: {} · {} {}",
                    self.settings.music.reward_title, self.settings.music.reward_cost,
                    util::plural_ru(
                        self.settings.music.reward_cost as usize,
                        "балл",
                        "балла",
                        "баллов"
                    )
                )
            } else {
                "Награда не выбрана".to_string()
            };
            let pill_color = if reward_ok { TEXT } else { WARN };
            if pill_button(ui, &reward_text, pill_color)
                .on_hover_text("Награда, из которой приходят заявки")
                .clicked()
            {
                open_price = true;
            }
            if ghost_button(ui, "Изменить", TEXT_DIM).clicked() {
                open_price = true;
            }
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                if let Some(version) = snapshot.ytdlp_version.as_ref() {
                    ok_chip(ui, &format!("yt-dlp {version}"))
                        .on_hover_text("Найден и готов к загрузке треков");
                } else {
                    ui.add(egui::Label::new(
                        RichText::new("yt-dlp не найден").size(12.2).color(DANGER),
                    ));
                    if secondary_button(ui, "Проверить").clicked() {
                        recheck = true;
                    }
                }
            });
        });

        // ---- Если что-то не готово — короткая плашка ----
        if !ready {
            ui.add_space(8.0);
            egui::Frame::none()
                .fill(blend_over(CARD, with_alpha(WARN, 14)))
                .stroke(Stroke::new(1.0_f32, blend_over(CARD, with_alpha(WARN, 70))))
                .rounding(Rounding::same(10.0))
                .inner_margin(egui::Margin::symmetric(12.0, 8.0))
                .show(ui, |ui| {
                    ui.horizontal_wrapped(|ui| {
                        ui.label(RichText::new("●").size(10.8).color(WARN));
                        ui.add(
                            egui::Label::new(
                                RichText::new(format!(
                                    "Заявки пока не принимаются: {}.",
                                    missing.join(", ")
                                ))
                                .size(13.2)
                                .color(TEXT),
                            )
                            .wrap(),
                        );
                        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                            if secondary_button(ui, "Настроить").clicked() {
                                if !connected || !listening {
                                    go_settings = true;
                                } else if !reward_ok {
                                    go_rewards = true;
                                } else {
                                    recheck = true;
                                }
                            }
                        });
                    });
                });
        }

        ui.add_space(5.0);
        self.music_player_card(ui, &snapshot);
        ui.add_space(5.0);

        // ---- Очередь ----
        let pending: Vec<music::QueueItem> = snapshot
            .items
            .iter()
            .filter(|item| !item.state.is_final())
            .cloned()
            .collect();
        let max_queue = self.settings.music.max_queue;
        let current_id = snapshot
            .current
            .as_ref()
            .map(|item| item.redemption_id.clone());
        let prefetched_title = snapshot.prefetched.as_ref().and_then(|prefetched| {
            snapshot
                .items
                .iter()
                .find(|item| &item.video_id == prefetched)
                .map(|item| item.label())
        });

        egui::Frame::none()
            .fill(CARD)
            .stroke(Stroke::new(1.0_f32, BORDER))
            .rounding(Rounding::same(18.0))
            .inner_margin(egui::Margin::symmetric(16.0, 10.0))
            .show(ui, |ui| {
            ui.set_width(ui.available_width());
            ui.spacing_mut().item_spacing = Vec2::ZERO;

            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(format!("Очередь · {} из {}", pending.len(), max_queue))
                        .family(semibold())
                        .size(15.4)
                        .color(TEXT),
                );
                let playing = pending
                    .iter()
                    .filter(|item| item.state == ItemState::Playing)
                    .count();
                let loading = pending
                    .iter()
                    .filter(|item| item.state == ItemState::Loading)
                    .count();
                if playing > 0 {
                    ui.add_space(4.0);
                    queue_count_chip(ui, playing, ItemState::Playing);
                }
                if loading > 0 {
                    ui.add_space(4.0);
                    queue_count_chip(ui, loading, ItemState::Loading);
                }
                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    if !pending.is_empty()
                        && ghost_button(ui, "Очистить", with_alpha(DANGER, 220)).clicked()
                    {
                        clear_queue = true;
                    }
                    if snapshot.prefetched.is_some() {
                        ui.add_space(6.0);
                        ui.label(
                            RichText::new("✓ следующий загружен")
                                .size(10.6)
                                .color(with_alpha(SUCCESS, 200)),
                        )
                        .on_hover_text(
                            prefetched_title
                                .as_ref()
                                .map(|title| format!("«{title}» уже в памяти — начнётся без задержки"))
                                .unwrap_or_else(|| "Следующий трек уже в памяти".to_string()),
                        );
                    }
                });
            });

            ui.add_space(4.0);

            if pending.is_empty() {
                ui.add_space(2.0);
                hint(
                    ui,
                    "Очередь пуста. Ссылка из активации награды появится здесь.",
                );
                ui.add_space(4.0);
            }

            for (index, item) in pending.iter().enumerate() {
                let active = current_id.as_deref() == Some(item.redemption_id.as_str());
                let is_prefetched = snapshot
                    .prefetched
                    .as_ref()
                    .map(|prefetched| &item.video_id == prefetched)
                    .unwrap_or(false);
                egui::Frame::none()
                    .fill(if active {
                        blend_over(CARD, with_alpha(SUCCESS, 18))
                    } else {
                        Color32::TRANSPARENT
                    })
                    .rounding(Rounding::same(10.0))
                    .inner_margin(egui::Margin::symmetric(10.0, 0.0))
                    .show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        ui.spacing_mut().item_spacing = Vec2::ZERO;
                        ui.set_min_height(if item.state == ItemState::Loading {
                            36.0
                        } else {
                            36.0
                        });
                        ui.horizontal(|ui| {
                            let (bar_rect, _) =
                                ui.allocate_exact_size(Vec2::new(3.0, 20.0), Sense::hover());
                            if active {
                                ui.painter().rect_filled(
                                    bar_rect,
                                    Rounding::same(2.0),
                                    SUCCESS,
                                );
                            }
                            ui.add_space(9.0);
                            ui.allocate_ui_with_layout(
                                Vec2::new(14.0, 24.0),
                                Layout::left_to_right(Align::Center),
                                |ui| {
                                    ui.label(
                                        RichText::new(format!("{}", index + 1))
                                            .size(12.6)
                                            .color(TEXT_DIM),
                                    );
                                },
                            );
                            ui.add_space(12.0);
                            ui.vertical(|ui| {
                                ui.spacing_mut().item_spacing.y = 1.0;
                                ui.add(
                                    egui::Label::new(
                                        RichText::new(item.label()).size(13.8).color(TEXT),
                                    )
                                    .truncate(),
                                );
                                if item.state == ItemState::Loading {
                                    ui.horizontal(|ui| {
                                        ui.label(
                                            RichText::new("загружается")
                                                .size(11.4)
                                                .color(WARN),
                                        );
                                        ui.add_space(6.0);
                                        let (rect, _) = ui.allocate_exact_size(
                                            Vec2::new(110.0, 12.0),
                                            Sense::hover(),
                                        );
                                        let track = egui::Rect::from_center_size(
                                            rect.center(),
                                            Vec2::new(rect.width(), 3.0),
                                        );
                                        ui.painter().rect_filled(
                                            track,
                                            Rounding::same(1.5),
                                            with_alpha(Color32::WHITE, 34),
                                        );
                                        let time = ui.input(|input| input.time) as f32;
                                        let phase = (time * 0.65) % 1.0;
                                        let segment = rect.width() * 0.42;
                                        let travel = rect.width() - segment;
                                        let start = rect.left() + travel * phase;
                                        ui.painter().rect_filled(
                                            egui::Rect::from_min_max(
                                                egui::pos2(start, track.top()),
                                                egui::pos2(start + segment, track.bottom()),
                                            ),
                                            Rounding::same(1.5),
                                            WARN,
                                        );
                                        ui.ctx().request_repaint_after(
                                            std::time::Duration::from_millis(70),
                                        );
                                    });
                                } else {
                                    let mut meta = format!("@{}", item.user_login);
                                    if item.duration_sec > 0 {
                                        meta.push_str(&format!(
                                            " · {}",
                                            music::ytdlp::format_duration(item.duration_sec)
                                        ));
                                    }
                                    if active && !item.channel.trim().is_empty() {
                                        meta.push_str(&format!(" · {}", item.channel));
                                    }
                                    ui.label(RichText::new(meta).size(11.4).color(TEXT_DIM));
                                }
                            });
                            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                                if queue_action_button(ui, UiIcon::X, "Убрать из очереди").clicked()
                                {
                                    remove = Some(item.redemption_id.clone());
                                }
                                if item.state == ItemState::Queued && index > 0 {
                                    if queue_action_button(ui, UiIcon::ChevronUp, "Поднять выше")
                                        .clicked()
                                    {
                                        move_up = Some(item.redemption_id.clone());
                                    }
                                }
                                if is_prefetched {
                                    ui.add_space(2.0);
                                    tiny_chip(ui, "загружен", SUCCESS);
                                }
                                let chip = queue_state_chip(ui, item.state);
                                if let Some(error) = item.error.as_ref() {
                                    chip.on_hover_text(error);
                                }
                            });
                        });
                    });
            }

            ui.add_space(4.0);
            let (line_rect, _) = ui.allocate_exact_size(
                Vec2::new(ui.available_width(), 1.0),
                Sense::hover(),
            );
            ui.painter().rect_filled(
                line_rect,
                Rounding::ZERO,
                with_alpha(Color32::WHITE, 18),
            );
            ui.add_space(6.0);

            ui.horizontal(|ui| {
                ui.spacing_mut().item_spacing.x = 0.0;
                let (plus_rect, _) = ui.allocate_exact_size(Vec2::new(18.0, 18.0), Sense::hover());
                let stroke = Stroke::new(1.8_f32, with_alpha(TEXT_DIM, 220));
                ui.painter().line_segment(
                    [
                        egui::pos2(plus_rect.left() + 3.0, plus_rect.center().y),
                        egui::pos2(plus_rect.right() - 3.0, plus_rect.center().y),
                    ],
                    stroke,
                );
                ui.painter().line_segment(
                    [
                        egui::pos2(plus_rect.center().x, plus_rect.top() + 3.0),
                        egui::pos2(plus_rect.center().x, plus_rect.bottom() - 3.0),
                    ],
                    stroke,
                );
                ui.add_space(6.0);
                let button_width = 128.0;
                let width = (ui.available_width() - button_width - 40.0).max(200.0);
                egui::Frame::none()
                    .fill(BG)
                    .stroke(Stroke::new(1.0_f32, with_alpha(BORDER, 200)))
                    .rounding(Rounding::same(17.0))
                    .inner_margin(egui::Margin::symmetric(14.0, 4.0))
                    .show(ui, |ui| {
                        let response = ui.add(
                            egui::TextEdit::singleline(&mut self.music_manual_input)
                                .frame(false)
                                .desired_width(width)
                                .font(FontId::proportional(13.2)),
                        );
                        if self.music_manual_input.is_empty() {
                            let hint_pos = response.rect.left_center() + Vec2::new(1.0, 0.0);
                            ui.painter().text(
                                hint_pos,
                                Align2::LEFT_CENTER,
                                "Вставьте ссылку YouTube и нажмите Enter — трек встанет в очередь",
                                FontId::proportional(13.2),
                                with_alpha(TEXT_DIM, 185),
                            );
                        }
                        if response.lost_focus()
                            && ui.input(|input| input.key_pressed(egui::Key::Enter))
                        {
                            add_manual = true;
                        }
                    });
                ui.add_space(8.0);
                if secondary_button(ui, "В очередь").clicked()
                    && !self.music_manual_input.trim().is_empty()
                {
                    add_manual = true;
                }
            });
            ui.add_space(4.0);
            ui.label(
                RichText::new("Ручная очередь не тратит баллы зрителей — удобно для проверки.")
                    .size(11.0)
                    .color(with_alpha(TEXT_DIM, 180)),
            );
        });

        ui.add_space(7.0);

        // ---- Нижний ряд: OBS и состояние ----
        ui.horizontal_top(|ui| {
            let total = ui.available_width();
            let obs_width = (total * 0.55).floor();
            let state_width = total - obs_width - 12.0;

            ui.allocate_ui_with_layout(
                Vec2::new(obs_width, 128.0),
                Layout::top_down(Align::Min),
                |ui| {
                egui::Frame::none()
                    .fill(CARD)
                    .stroke(Stroke::new(1.0_f32, BORDER))
                    .rounding(Rounding::same(18.0))
                    .inner_margin(egui::Margin::symmetric(16.0, 14.0))
                    .show(ui, |ui| {
                    ui.set_width(ui.available_width());
                    ui.spacing_mut().item_spacing.y = 6.0;
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new("OBS — строка «Сейчас играет»")
                                .family(semibold())
                                .size(14.4)
                                .color(TEXT),
                        );
                        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                            if ghost_button(ui, "Настроить", TEXT_DIM).clicked() {
                                open_obs = true;
                            }
                        });
                    });
                    ui.add_space(10.0);
                    ui.horizontal(|ui| {
                        egui::Frame::none()
                            .fill(blend_over(CARD, with_alpha(Color32::WHITE, 6)))
                            .rounding(Rounding::same(8.0))
                            .inner_margin(egui::Margin::symmetric(10.0, 5.0))
                            .show(ui, |ui| {
                                ui.label(
                                    RichText::new("http://127.0.0.1:8770/overlay")
                                        .size(11.4)
                                        .monospace()
                                        .color(Color32::from_rgb(0xCF, 0xCF, 0xCF)),
                                );
                            });
                        ui.add_space(2.0);
                        if icon_button(ui, UiIcon::Copy, "Скопировать ссылку", 28.0).clicked() {
                            copy_overlay = true;
                        }
                        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                            let show = ui
                                .add_enabled_ui(snapshot.current.is_some(), |ui| {
                                    compact_secondary_button(ui, "Показать сейчас")
                                })
                                .inner;
                            if show.clicked() {
                                show_overlay = true;
                            }
                        });
                    });
                    ui.add_space(8.0);
                    let preview = snapshot.current.as_ref();
                    egui::Frame::none()
                        .fill(blend_over(CARD, with_alpha(Color32::WHITE, 4)))
                        .rounding(Rounding::same(10.0))
                        .inner_margin(egui::Margin::symmetric(12.0, 7.0))
                        .show(ui, |ui| {
                            ui.set_width(ui.available_width());
                            ui.horizontal(|ui| {
                                for height in [7.0_f32, 12.0, 16.0, 9.0] {
                                    let (rect, _) =
                                        ui.allocate_exact_size(Vec2::new(3.0, 16.0), Sense::hover());
                                    let bar = egui::Rect::from_center_size(
                                        rect.center(),
                                        Vec2::new(3.0, height),
                                    );
                                    ui.painter().rect_filled(
                                        bar,
                                        Rounding::same(2.0),
                                        with_alpha(SUCCESS, 220),
                                    );
                                }
                                ui.add_space(4.0);
                                ui.label(
                                    RichText::new(
                                        preview
                                            .map(|item| item.label())
                                            .unwrap_or_else(|| "ДИНАСТИЯ — Земляк".to_string()),
                                    )
                                    .family(semibold())
                                    .size(11.4)
                                    .color(TEXT),
                                );
                                if let Some(item) = preview {
                                    ui.label(
                                        RichText::new(format!("· заказал @{}", item.user_login))
                                            .size(10.8)
                                            .color(TEXT_DIM),
                                    );
                                }
                            });
                        });
                });
                },
            );

            ui.add_space(12.0);

            ui.allocate_ui_with_layout(
                Vec2::new(state_width, 128.0),
                Layout::top_down(Align::Min),
                |ui| {
                egui::Frame::none()
                    .fill(CARD)
                    .stroke(Stroke::new(1.0_f32, BORDER))
                    .rounding(Rounding::same(18.0))
                    .inner_margin(egui::Margin::symmetric(14.0, 12.0))
                    .show(ui, |ui| {
                    ui.set_width(ui.available_width());
                    ui.spacing_mut().item_spacing.y = 3.0;
                    ui.label(
                        RichText::new("Состояние")
                            .family(semibold())
                            .size(14.4)
                            .color(TEXT),
                    );
                    ui.add_space(7.0);
                    let row = |ui: &mut egui::Ui, text: String| {
                        ui.horizontal(|ui| {
                            ui.label(RichText::new("✓").size(11.0).color(SUCCESS));
                            ui.label(
                                RichText::new(text)
                                    .size(11.4)
                                    .color(Color32::from_rgb(0xB9, 0xB9, 0xB9)),
                            );
                        });
                    };
                    match snapshot.ytdlp_version.as_ref() {
                        Some(version) => row(ui, format!("yt-dlp {version} — готов")),
                        None => row(ui, "yt-dlp не найден".to_string()),
                    }
                    row(
                        ui,
                        if connected {
                            "Чат: команда !трек работает".to_string()
                        } else {
                            "Чат: нужен Twitch".to_string()
                        },
                    );
                    row(ui, "Порт оверлея 8770 — свободен".to_string());
                });
                },
            );
        });

        // ---- Действия ----
        // ---- Действия ----
        if toggle_enabled {
            self.settings.music.enabled = !self.settings.music.enabled;
            self.music.set_paused(!self.settings.music.enabled);
            self.apply_music_config();
            self.mark_dirty();
            self.notify(
                if self.settings.music.enabled {
                    "Приём заявок включён."
                } else {
                    "Приём заявок выключен."
                },
                ToastKind::Info,
            );
            self.touch();
        }
        if copy_overlay {
            ui.output_mut(|output| {
                output.copied_text = "http://127.0.0.1:8770/overlay".to_string()
            });
            self.notify("Ссылка на оверлей скопирована", ToastKind::Success);
        }
        if show_overlay {
            self.music.show_overlay();
            self.notify("Строка «Сейчас играет» показана в оверлее", ToastKind::Info);
        }
        if open_overlay {
            let _ = webbrowser::open("http://127.0.0.1:8770/overlay");
        }
        if recheck {
            self.music.recheck();
            self.notify("Ищу yt-dlp заново", ToastKind::Info);
        }
        if open_obs {
            self.music_price_open = false;
            self.music_settings_open = false;
            self.obs_window_open = true;
            self.touch();
        }
        if open_price {
            self.music_settings_open = false;
            self.music_price_open = true;
            self.touch();
        }
        if open_music_settings {
            self.music_price_open = false;
            self.music_settings_open = true;
            self.touch();
        }
        if open_log {
            self.tab = Tab::Log;
            self.logs = self.logger.entries();
            self.log_refresh_at = Instant::now() + Duration::from_millis(800);
            self.touch();
        }
        if go_settings {
            self.tab = Tab::Settings;
            self.touch();
        }
        if go_rewards {
            self.tab = Tab::Rewards;
            self.reward_filter = RewardFilter::All;
            self.touch();
        }
        if add_manual && !self.music_manual_input.trim().is_empty() {
            let url = self.music_manual_input.trim().to_string();
            self.music_manual_input.clear();
            self.music.add_manual(&url);
            self.notify("Проверяем ссылку и ставим трек в очередь…", ToastKind::Info);
            self.touch();
        }
        if clear_queue {
            self.confirm = Some(ConfirmDialog {
                title: "Очистить очередь?".to_string(),
                text: "Все заявки, которые ждут очереди, будут сняты, а баллы зрителей вернутся. Текущий трек продолжит играть.".to_string(),
                confirm_label: "Очистить".to_string(),
                action: ConfirmAction::ClearMusicQueue,
                danger: true,
            });
            self.touch();
        }
        if let Some(id) = move_up {
            self.music.move_up(&id);
            self.touch();
        }
        if let Some(id) = remove {
            self.music.remove_item(&id);
            self.touch();
        }
        if let Some(id) = replay {
            self.music.replay(&id);
            self.touch();
        }
    }

    /// Окно «Награда и цена» на вкладке «Музыка».
    fn music_price_window(&mut self, ctx: &egui::Context) {
        if !self.music_price_open {
            return;
        }
        modal_scrim(ctx);
        let mut open = true;
        let mut close = false;
        let mut picked: Option<String> = None;

        let rewards: Vec<(String, String)> = self
            .remote_rewards
            .iter()
            .map(|reward| {
                (
                    reward.id.clone(),
                    format!(
                        "{} · {} {}",
                        reward.title,
                        reward.cost,
                        util::plural_ru(
                            reward.cost.max(0) as usize,
                            "балл",
                            "балла",
                            "баллов"
                        )
                    ),
                )
            })
            .collect();
        let current_label = rewards
            .iter()
            .find(|(id, _)| id == &self.settings.music.reward_id)
            .map(|(_, label)| label.clone())
            .unwrap_or_else(|| "Награда не выбрана".to_string());

        egui::Window::new("music-price")
            .id(egui::Id::new("music-price-window"))
            .title_bar(false)
            .collapsible(false)
            .resizable(false)
            .movable(false)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .min_width(500.0)
            .max_width(500.0)
            .frame(
                egui::Frame::window(&ctx.style())
                    .fill(PANEL)
                    .rounding(Rounding::same(22.0))
                    .stroke(Stroke::new(1.0_f32, BORDER))
                    .inner_margin(egui::Margin::symmetric(26.0, 22.0)),
            )
            .open(&mut open)
            .show(ctx, |ui| {
                ui.set_width(ui.available_width());
                ui.label(
                    RichText::new("Награда и цена")
                        .family(semibold())
                        .size(21.6)
                        .color(TEXT),
                );
                hint(
                    ui,
                    "Из какой награды приходят заявки и сколько баллов платит зритель.",
                );
                ui.add_space(14.0);

                ui.label(RichText::new("НАГРАДА").size(11.6).color(TEXT_DIM));
                ui.add_space(4.0);
                egui::ComboBox::from_id_salt("music-reward-modal")
                    .width(440.0)
                    .selected_text(current_label.clone())
                    .show_ui(ui, |ui| {
                        for (id, label) in &rewards {
                            let selected = id == &self.settings.music.reward_id;
                            if ui.selectable_label(selected, label).clicked() {
                                picked = Some(id.clone());
                            }
                        }
                    });
                if rewards.is_empty() {
                    hint(ui, "Список наград пуст — обновите его на вкладке «Награды».");
                }

                ui.add_space(12.0);
                ui.horizontal(|ui| {
                    ui.label(RichText::new("ЦЕНА").size(11.6).color(TEXT_DIM));
                    ui.add_space(8.0);
                    ui.add(
                        egui::TextEdit::singleline(&mut self.music_cost_input)
                            .desired_width(90.0),
                    );
                    ui.label(RichText::new("баллов").size(12.4).color(TEXT_DIM));
                });
                hint(
                    ui,
                    "«Применить цену» меняет награду на Twitch: зритель платит её за заявку.",
                );

                ui.add_space(16.0);
                ui.horizontal(|ui| {
                    if secondary_button(ui, "Отмена").clicked() {
                        close = true;
                    }
                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        if accent_button(ui, "Применить цену").clicked() {
                            self.apply_music_price();
                            close = true;
                        }
                    });
                });
            });

        if let Some(id) = picked {
            self.set_music_reward(&id);
        }
        if close
            || !open
            || ctx.input(|input| input.key_pressed(egui::Key::Escape))
        {
            self.music_price_open = false;
            self.touch();
        }
    }

    /// Окно «Настройки музыки»: лимиты, поведение плеера, восстановление очереди.
    fn music_settings_window(&mut self, ctx: &egui::Context) {
        if !self.music_settings_open {
            return;
        }
        modal_scrim(ctx);
        let mut open = true;
        let mut close = false;
        let mut dirty = false;

        egui::Window::new("music-settings")
            .id(egui::Id::new("music-settings-window"))
            .title_bar(false)
            .collapsible(false)
            .resizable(false)
            .movable(false)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .min_width(480.0)
            .max_width(480.0)
            .frame(
                egui::Frame::window(&ctx.style())
                    .fill(PANEL)
                    .rounding(Rounding::same(22.0))
                    .stroke(Stroke::new(1.0_f32, BORDER))
                    .inner_margin(egui::Margin::symmetric(26.0, 22.0)),
            )
            .open(&mut open)
            .show(ctx, |ui| {
                ui.set_width(ui.available_width());
                ui.label(
                    RichText::new("Настройки музыки")
                        .family(semibold())
                        .size(21.6)
                        .color(TEXT),
                );
                ui.add_space(12.0);

                ui.horizontal(|ui| {
                    ui.label(RichText::new("Заявок в очереди").size(13.6).color(TEXT_DIM));
                    ui.add_space(8.0);
                    let mut value = self.settings.music.max_queue as u32;
                    if ui
                        .add(egui::DragValue::new(&mut value).range(1..=50).speed(1.0))
                        .changed()
                    {
                        self.settings.music.max_queue = value as usize;
                        dirty = true;
                    }
                });
                ui.add_space(6.0);
                ui.horizontal(|ui| {
                    ui.label(RichText::new("Максимум, минут").size(13.6).color(TEXT_DIM));
                    ui.add_space(8.0);
                    let mut minutes = (self.settings.music.max_duration_sec / 60).max(1) as u32;
                    if ui
                        .add(egui::DragValue::new(&mut minutes).range(1..=120).speed(1.0))
                        .changed()
                    {
                        self.settings.music.max_duration_sec = minutes as u64 * 60;
                        dirty = true;
                    }
                });
                ui.add_space(10.0);
                let mut pause_yandex = self.settings.music.pause_yandex;
                if toggle(ui, &mut pause_yandex) {
                    self.settings.music.pause_yandex = pause_yandex;
                    dirty = true;
                }
                ui.label(
                    RichText::new("Ставить Яндекс Музыку на паузу и возвращать после")
                        .size(13.0)
                        .color(TEXT),
                );
                ui.add_space(6.0);
                let mut restore = self.settings.music.restore_queue;
                if toggle(ui, &mut restore) {
                    self.settings.music.restore_queue = restore;
                    dirty = true;
                }
                ui.label(
                    RichText::new("Восстанавливать очередь после перезапуска")
                        .size(13.0)
                        .color(TEXT),
                );
                ui.add_space(6.0);
                hint(
                    ui,
                    "Длительность и лимит применяются сразу. Очередь хранится в queue.json рядом с настройками.",
                );

                ui.add_space(16.0);
                ui.horizontal(|ui| {
                    if secondary_button(ui, "Закрыть").clicked() {
                        close = true;
                    }
                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        if secondary_button(ui, "Оверлей OBS").clicked() {
                            self.music_settings_open = false;
                            self.obs_window_open = true;
                            close = true;
                        }
                    });
                });
            });

        if dirty {
            self.apply_music_config();
            self.mark_dirty();
            self.touch();
        }
        if close || !open || ctx.input(|input| input.key_pressed(egui::Key::Escape)) {
            self.music_settings_open = false;
            self.touch();
        }
    }

    /// Окно настроек оверлея для OBS: ссылка и параметры показа.
    fn obs_window(&mut self, ctx: &egui::Context) {
        if !self.obs_window_open {
            return;
        }
        modal_scrim(ctx);

        let mut close = false;
        let mut copy_url = false;
        let mut show_now = false;
        let mut open_browser = false;
        let url = "http://127.0.0.1:8770/overlay";

        egui::Window::new("obs-overlay")
            .id(egui::Id::new("obs-overlay-window"))
            .title_bar(false)
            .collapsible(false)
            .resizable(false)
            .movable(false)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .min_width(520.0)
            .max_width(520.0)
            .frame(
                egui::Frame::window(&ctx.style())
                    .fill(PANEL)
                    .rounding(Rounding::same(22.0))
                    .stroke(Stroke::new(1.0_f32, BORDER))
                    .inner_margin(egui::Margin::symmetric(26.0, 22.0)),
            )
            .show(ctx, |ui| {
                ui.set_width(ui.available_width());
                ui.horizontal(|ui| {
                    ui.label(
                        RichText::new("OBS — строка «Сейчас играет»")
                            .family(semibold())
                            .size(21.6)
                            .color(TEXT),
                    );
                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        if icon_button(ui, UiIcon::X, "Закрыть", 30.0).clicked() {
                            close = true;
                        }
                    });
                });
                ui.add_space(6.0);
                hint(
                    ui,
                    "Добавьте ссылку в OBS как источник «Браузер». Строка показывается, когда играет трек.",
                );

                ui.add_space(14.0);
                ui.label(
                    RichText::new("ССЫЛКА ДЛЯ ИСТОЧНИКА")
                        .size(11.2)
                        .color(with_alpha(TEXT_DIM, 210)),
                );
                ui.add_space(5.0);
                egui::Frame::none()
                    .fill(CARD)
                    .stroke(Stroke::new(1.0_f32, BORDER))
                    .rounding(Rounding::same(10.0))
                    .inner_margin(egui::Margin::symmetric(12.0, 7.0))
                    .show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        ui.horizontal(|ui| {
                            ui.label(
                                RichText::new(url)
                                    .size(12.6)
                                    .monospace()
                                    .color(TEXT),
                            );
                            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                                if icon_button(ui, UiIcon::Copy, "Скопировать", 26.0).clicked() {
                                    copy_url = true;
                                }
                            });
                        });
                    });

                ui.add_space(12.0);
                egui::Grid::new("obs-params")
                    .num_columns(2)
                    .spacing(Vec2::new(16.0, 10.0))
                    .show(ui, |ui| {
                        ui.label(
                            RichText::new("Показывать, секунд")
                                .size(13.2)
                                .color(TEXT_DIM),
                        );
                        ui.horizontal(|ui| {
                            let mut seconds = self.settings.music.overlay_seconds;
                            if ui
                                .add(
                                    egui::DragValue::new(&mut seconds)
                                        .range(0..=600)
                                        .speed(1.0),
                                )
                                .changed()
                            {
                                self.settings.music.overlay_seconds = seconds;
                                self.apply_music_config();
                                self.save_at =
                                    Some(Instant::now() + Duration::from_millis(350));
                            }
                            ui.label(
                                RichText::new("0 — показывать всё время, пока играет трек")
                                    .size(11.4)
                                    .color(with_alpha(TEXT_DIM, 180)),
                            );
                        });
                        ui.end_row();

                        ui.label(
                            RichText::new("Размер шрифта")
                                .size(13.2)
                                .color(TEXT_DIM),
                        );
                        ui.horizontal(|ui| {
                            let mut font = self.settings.music.overlay_font;
                            if ui
                                .add(
                                    egui::DragValue::new(&mut font)
                                        .range(12..=48)
                                        .speed(1.0),
                                )
                                .changed()
                            {
                                self.settings.music.overlay_font = font;
                                self.apply_music_config();
                                self.save_at =
                                    Some(Instant::now() + Duration::from_millis(350));
                            }
                            ui.label(RichText::new("px").size(11.6).color(TEXT_DIM));
                        });
                        ui.end_row();

                        ui.label(
                            RichText::new("Положение")
                                .size(13.2)
                                .color(TEXT_DIM),
                        );
                        ui.horizontal(|ui| {
                            let top = self.settings.music.overlay_position != "bottom";
                            if position_button(ui, "Сверху", top) {
                                self.settings.music.overlay_position = "top".to_string();
                                self.apply_music_config();
                                self.save_at =
                                    Some(Instant::now() + Duration::from_millis(350));
                            }
                            if position_button(ui, "Снизу", !top) {
                                self.settings.music.overlay_position = "bottom".to_string();
                                self.apply_music_config();
                                self.save_at =
                                    Some(Instant::now() + Duration::from_millis(350));
                            }
                        });
                        ui.end_row();
                    });

                ui.add_space(10.0);
                hint(
                    ui,
                    "Источник: ширина 1920, высота 200–300. «Обновлять при активации» и «Выключать, когда не виден» — выключить. Команда !трек в чате показывает строку ещё раз.",
                );

                ui.add_space(16.0);
                ui.horizontal(|ui| {
                    if secondary_button(ui, "Открыть в браузере").clicked() {
                        open_browser = true;
                    }
                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        if accent_button(ui, "Закрыть").clicked() {
                            close = true;
                        }
                        ui.add_space(8.0);
                        let show = ui
                            .add_enabled_ui(self.music_snapshot.current.is_some(), |ui| {
                                secondary_button(ui, "Показать сейчас")
                            })
                            .inner;
                        if show.clicked() {
                            show_now = true;
                        }
                    });
                });
            });

        if copy_url {
            ctx.output_mut(|output| output.copied_text = url.to_string());
            self.notify("Ссылка на оверлей скопирована", ToastKind::Success);
        }
        if show_now {
            self.music.show_overlay();
            self.notify("Строка показана в оверлее", ToastKind::Info);
        }
        if open_browser {
            let _ = webbrowser::open(url);
        }
        if close || ctx.input(|input| input.key_pressed(egui::Key::Escape)) {
            self.obs_window_open = false;
            self.touch();
        }
    }

    /// Карточка плеера по макету (156 px): обложка 102, инфо-колонка,
    /// строка прогресса с временем, кнопки 32/40/32 и «Пропустить трек»,
    /// справа — громкость и следующий трек.
    fn music_player_card(&mut self, ui: &mut egui::Ui, snapshot: &music::Snapshot) {
        let mut restart = false;
        let mut toggle_pause = false;
        let mut skip = false;
        let current = snapshot.current.as_ref();
        let playing = current.is_some();
        let loading = current
            .map(|item| matches!(item.state, ItemState::Loading))
            .unwrap_or(false);

        egui::Frame::none()
            .fill(CARD)
            .stroke(Stroke::new(1.0_f32, BORDER))
            .rounding(Rounding::same(18.0))
            .inner_margin(egui::Margin::symmetric(16.0, 11.0))
            .show(ui, |ui| {
            ui.set_width(ui.available_width());
            ui.spacing_mut().item_spacing = Vec2::ZERO;
            let total_width = ui.available_width();
            ui.horizontal_top(|ui| {
                let right_width = 196.0;
                let info_width =
                    (total_width - 102.0 - 16.0 - right_width - 33.0).max(300.0);

                let (art_rect, _) = ui.allocate_exact_size(Vec2::splat(102.0), Sense::hover());
                ui.painter().rect_filled(
                    art_rect,
                    Rounding::same(14.0),
                    blend_over(CARD, with_alpha(Color32::WHITE, 8)),
                );
                {
                    let scale = art_rect.width() / 86.0;
                    let ink = Color32::from_rgb(110, 110, 110);
                    let stroke = Stroke::new(1.5 * scale, ink);
                    let c = art_rect.center();
                    let left = egui::pos2(c.x - 18.0 * scale, c.y + 18.0 * scale);
                    let right = egui::pos2(c.x + 8.0 * scale, c.y + 12.0 * scale);
                    ui.painter().circle_stroke(left, 5.0 * scale, stroke);
                    ui.painter().circle_stroke(right, 5.0 * scale, stroke);
                    ui.painter().line_segment(
                        [
                            egui::pos2(left.x + 4.5 * scale, left.y),
                            egui::pos2(left.x + 4.5 * scale, left.y - 33.0 * scale),
                        ],
                        stroke,
                    );
                    ui.painter().line_segment(
                        [
                            egui::pos2(right.x + 4.5 * scale, right.y),
                            egui::pos2(right.x + 4.5 * scale, right.y - 29.0 * scale),
                        ],
                        stroke,
                    );
                    ui.painter().line_segment(
                        [
                            egui::pos2(left.x + 4.5 * scale, left.y - 33.0 * scale),
                            egui::pos2(right.x + 4.5 * scale, right.y - 29.0 * scale),
                        ],
                        stroke,
                    );
                }
                ui.add_space(16.0);

                ui.allocate_ui_with_layout(
                    Vec2::new(info_width, 132.0),
                    Layout::top_down(Align::Min),
                    |ui| {
                    ui.spacing_mut().item_spacing.y = 2.0;
                    if playing {
                        let label = if loading {
                            "ЗАГРУЖАЕМ ТРЕК"
                        } else if snapshot.player.paused {
                            "ПАУЗА"
                        } else {
                            "СЕЙЧАС ИГРАЕТ"
                        };
                        ui.label(
                            RichText::new(label)
                                .size(10.6)
                                .color(if loading { WARN } else { SUCCESS }),
                        );
                        ui.add_space(1.0);
                        ui.add(
                            egui::Label::new(
                                RichText::new(current.map(|i| i.label()).unwrap_or_default())
                                    .family(semibold())
                                    .size(19.0)
                                    .color(TEXT),
                            )
                            .truncate(),
                        );
                        ui.add_space(1.0);
                        let mut meta = String::new();
                        if let Some(item) = current {
                            if !item.user_login.trim().is_empty() && item.user_login != "manual" {
                                meta.push_str(&format!("заказал @{}", item.user_login));
                                meta.push_str(" · ");
                            }
                            meta.push_str(if item.channel.trim().is_empty() {
                                "YouTube"
                            } else {
                                &item.channel
                            });
                            if item.duration_sec > 0 {
                                meta.push_str(&format!(
                                    " · {}",
                                    music::ytdlp::format_duration(item.duration_sec)
                                ));
                            }
                        }
                        ui.label(RichText::new(meta).size(12.8).color(TEXT_DIM));
                    } else {
                        ui.label(
                            RichText::new("Ничего не играет")
                                .family(semibold())
                                .size(19.0)
                                .color(TEXT),
                        );
                        ui.add_space(3.0);
                        hint(
                            ui,
                            if snapshot.ytdlp_version.is_some() {
                                "Активируйте награду на канале — трек встанет в очередь"
                            } else {
                                "yt-dlp не найден — заявки пока не принимаются"
                            },
                        );
                    }

                    ui.add_space(4.0);
                    let total = if playing { snapshot.player.duration_sec } else { 0 };
                    let position = if playing {
                        snapshot.player.position_sec.min(total.max(1))
                    } else {
                        0
                    };
                    ui.horizontal(|ui| {
                        ui.allocate_ui_with_layout(
                            Vec2::new(30.0, 14.0),
                            Layout::left_to_right(Align::Center),
                            |ui| {
                                ui.label(
                                    RichText::new(music::ytdlp::format_duration(position))
                                        .size(11.0)
                                        .color(TEXT_DIM),
                                );
                            },
                        );
                        ui.add_space(10.0);
                        let bar_width = (ui.available_width() - 46.0).max(120.0);
                        if total > 0 {
                            if let Some(target) =
                                music_progress_width(ui, position, total, bar_width)
                            {
                                self.music.seek(target);
                                self.touch();
                            }
                        } else {
                            let (rect, _) =
                                ui.allocate_exact_size(Vec2::new(bar_width, 14.0), Sense::hover());
                            ui.painter().rect_filled(
                                egui::Rect::from_center_size(
                                    rect.center(),
                                    Vec2::new(rect.width(), 2.0),
                                ),
                                Rounding::same(1.0),
                                with_alpha(Color32::WHITE, 40),
                            );
                        }
                        ui.add_space(10.0);
                        ui.label(
                            RichText::new(music::ytdlp::format_duration(total))
                                .size(11.0)
                                .color(TEXT_DIM),
                        );
                    });

                    ui.add_space(5.0);
                    ui.horizontal(|ui| {
                        ui.spacing_mut().item_spacing.x = 9.0;
                        if ui
                            .add_enabled_ui(playing, |ui| {
                                player_icon_button(ui, PlayerIcon::Restart)
                            })
                            .inner
                            .on_hover_text("Сначала")
                            .clicked()
                        {
                            restart = true;
                        }
                        let icon = if snapshot.player.paused {
                            PlayerIcon::Play
                        } else {
                            PlayerIcon::Pause
                        };
                        if ui
                            .add_enabled_ui(playing, |ui| player_icon_button(ui, icon))
                            .inner
                            .on_hover_text(if snapshot.player.paused {
                                "Продолжить"
                            } else {
                                "Пауза"
                            })
                            .clicked()
                        {
                            toggle_pause = true;
                        }
                        if ui
                            .add_enabled_ui(playing, |ui| player_icon_button(ui, PlayerIcon::Skip))
                            .inner
                            .on_hover_text("Пропустить трек")
                            .clicked()
                        {
                            skip = true;
                        }
                        ui.add_space(3.0);
                        if ghost_button(ui, "Пропустить трек", TEXT_DIM).clicked() {
                            skip = true;
                        }
                    });
                    },
                );

                ui.add_space(14.0);
                let (line_rect, _) = ui.allocate_exact_size(
                    Vec2::new(1.0, 116.0),
                    Sense::hover(),
                );
                ui.painter().rect_filled(
                    line_rect,
                    Rounding::ZERO,
                    with_alpha(Color32::WHITE, 18),
                );
                ui.add_space(14.0);

                ui.allocate_ui_with_layout(
                    Vec2::new(right_width, 120.0),
                    Layout::top_down(Align::Min),
                    |ui| {
                    ui.spacing_mut().item_spacing.y = 2.0;
                    ui.label(
                        RichText::new("Громкость музыки")
                            .size(11.0)
                            .color(TEXT_DIM),
                    );
                    ui.add_space(6.0);
                    ui.horizontal(|ui| {
                        let mut volume = self.settings.music.music_volume as f32;
                        let changed = fader(ui, &mut volume, 0.0, 1.0, 120.0).changed();
                        let volume = volume as f64;
                        ui.add_space(6.0);
                        ui.label(
                            RichText::new(util::format_volume(
                                self.settings.music.music_volume as f32,
                            ))
                            .size(12.0)
                            .color(Color32::from_rgb(0xDA, 0xDA, 0xDA)),
                        );
                        if changed {
                            self.settings.music.music_volume = volume;
                            self.music.set_volume(volume as f32);
                            self.mark_dirty();
                        }
                    });
                    ui.add_space(6.0);
                    ui.label(
                        RichText::new("Не меняет громкость Windows — только очередь.")
                            .size(11.2)
                            .color(with_alpha(TEXT_DIM, 190)),
                    );
                    ui.add_space(8.0);
                    if let Some(next) = snapshot
                        .items
                        .iter()
                        .find(|item| item.state == ItemState::Queued)
                    {
                        ui.add(
                            egui::Label::new(
                                RichText::new(format!("Следующий: {}", next.label()))
                                    .size(10.8)
                                    .color(TEXT_DIM),
                            )
                            .truncate(),
                        );
                    } else {
                        ui.label(RichText::new("Следующий: —").size(10.8).color(TEXT_DIM));
                    }
                    },
                );
            });

            if let Some(error) = snapshot.player.error.as_ref() {
                ui.add_space(6.0);
                paragraph(ui, error, DANGER, 12.6);
            }
        });

        if restart {
            self.music.seek(0);
            self.touch();
        }
        if toggle_pause {
            self.music.set_paused(!snapshot.player.paused);
            self.touch();
        }
        if skip {
            self.music.skip("без причины");
            self.touch();
        }
    }

    fn apply_music_price(&mut self) {
        let reward_id = self.settings.music.reward_id.clone();
        if reward_id.trim().is_empty() {
            self.notify("Сначала выберите награду", ToastKind::Warning);
            return;
        }
        let Ok(cost) = self.music_cost_input.trim().parse::<i64>() else {
            self.notify("Цена должна быть числом", ToastKind::Warning);
            return;
        };
        if !(1..=1_000_000).contains(&cost) {
            self.notify("Цена — от 1 до 1 000 000 баллов", ToastKind::Warning);
            return;
        }

        let Some(reward) = self
            .remote_rewards
            .iter()
            .find(|reward| reward.id == reward_id)
            .cloned()
        else {
            self.notify(
                "Награда не найдена в списке — обновите его на вкладке «Награды»",
                ToastKind::Warning,
            );
            return;
        };

        let Some(access_token) = self.settings.twitch.access_token() else {
            self.notify("Нужно заново войти в Twitch", ToastKind::Warning);
            return;
        };

        let draft = twitch::RewardDraft::new(reward.title.clone(), cost, reward.color.clone())
            .with_input(true);
        self.twitch_service.update_reward(
            &self.settings.twitch.client_id,
            &access_token,
            &self.settings.twitch.user_id,
            &reward_id,
            draft,
        );

        self.settings.music.reward_cost = cost as u32;
        self.save_at = Some(Instant::now() + Duration::from_millis(350));
        self.notify(
            format!("Новая цена награды: {cost} баллов"),
            ToastKind::Success,
        );
    }

    /// Запоминает выбранную награду для заявок.
    fn set_music_reward(&mut self, reward_id: &str) {
        self.settings.music.reward_id = reward_id.to_string();
        let mut updated = None;
        if let Some(reward) = self.remote_rewards.iter().find(|reward| reward.id == reward_id) {
            self.settings.music.reward_title = reward.title.clone();
            self.settings.music.reward_cost = reward.cost.clamp(1, 1_000_000) as u32;
            self.music_cost_input = reward.cost.clamp(1, 1_000_000).to_string();
            updated = Some(reward.clone());
        }

        // Награда должна требовать текст: именно туда зритель вставляет ссылку.
        if let (Some(reward), Some(access_token)) =
            (updated, self.settings.twitch.access_token())
        {
            let draft = twitch::RewardDraft::new(reward.title.clone(), reward.cost, reward.color.clone())
                .with_input(true);
            self.twitch_service.update_reward(
                &self.settings.twitch.client_id,
                &access_token,
                &self.settings.twitch.user_id,
                reward_id,
                draft,
            );
            self.notify(
                "У награды включён обязательный ввод ссылки",
                ToastKind::Success,
            );
        }

        self.apply_music_config();
        self.save_at = Some(Instant::now() + Duration::from_millis(350));
    }

}

impl eframe::App for RewardSoundsApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        // Своя шапка вместо системной рамки.
        if !self.decorations_removed {
            ctx.send_viewport_cmd(egui::ViewportCommand::Decorations(false));
            self.decorations_removed = true;
        }
        self.resize_edges(ctx);
        if ctx.input(|input| input.viewport().close_requested()) {
            if self.allow_close {
                self.save_now();
            } else if self.settings.close_to_tray && self.tray.is_available() {
                ctx.send_viewport_cmd(egui::ViewportCommand::CancelClose);
                self.hide_to_tray(ctx);
            } else {
                self.save_now();
            }
        }

        self.poll_tray(ctx);
        if self.hide_on_start {
            self.hide_on_start = false;
            self.hide_to_tray(ctx);
        }


        // Если запустились свёрнутыми, а трей недоступен (например, нет проводника),
        // показываем окно, чтобы приложение не «потерялось».
        if let Some(deadline) = self.tray_check_at {
            if Instant::now() >= deadline {
                self.tray_check_at = None;
                if !self.window_visible && !self.tray.is_available() {
                    log::warn!("Трей недоступен — показываем окно");
                    self.show_window(ctx);
                    self.notify(
                        "Системный трей недоступен, поэтому окно открыто. Проверьте, что проводник Windows запущен.",
                        ToastKind::Warning,
                    );
                }
            }
        }

        self.poll_audio();
        self.poll_normalize();
        self.poll_twitch();
        self.poll_eventsub();
        self.poll_music();
        if let Ok(mut state) = self.playback_state.lock() {
            state.sync(&self.settings);
        }
        self.maybe_save();

        if self.tab == Tab::Log && Instant::now() >= self.log_refresh_at {
            self.logs = self.logger.entries();
            self.log_refresh_at = Instant::now() + Duration::from_millis(800);
        }

        self.sidebar(ctx);
        self.title_bar(ctx);
        self.header(ctx);
        self.footer(ctx);

        let tab = self.tab;
        egui::CentralPanel::default()
            .frame(
                egui::Frame::none()
                    .fill(BG)
                    .inner_margin(egui::Margin::symmetric(24.0, 20.0)),
            )
            .show(ctx, |ui| match tab {

                Tab::Rewards => self.rewards_tab(ui),
                Tab::Music => {
                    // Без прокрутки нижние карточки недоступны на низких окнах.
                    egui::ScrollArea::vertical()
                        .id_source("music-tab-scroll")
                        .auto_shrink([false, false])
                        .show(ui, |ui| self.music_tab(ui));
                }
                Tab::Settings => self.settings_tab(ui),
                Tab::Log => self.log_tab(ui),
            });


        if self.obs_window_open {
            self.obs_window(ctx);
        }
        self.reward_editor_window(ctx);
        self.reward_delete_window(ctx);
        self.confirm_dialog_window(ctx);
        self.music_price_window(ctx);
        self.music_settings_window(ctx);

        if self.busy() {
            // Быстрая перерисовка нужна только когда что-то меняется:
            // воспроизведение, тост, сохранение, подключение.
            ctx.request_repaint_after(Duration::from_millis(150));
        } else if self.tab == Tab::Music {
            // Прогресс трека и очередь: обновляем несколько раз в секунду.
            ctx.request_repaint_after(Duration::from_millis(250));
        } else if self.tab == Tab::Log {
            ctx.request_repaint_after(Duration::from_millis(800));
        } else if !self.window_visible {
            // Страховка на случай, если событие из трея/сервисов не разбудило UI.
            ctx.request_repaint_after(Duration::from_millis(1000));
        }
    }
}

impl Drop for RewardSoundsApp {
    fn drop(&mut self) {
        let _ = self.settings.save(&self.paths.config_file);
        log::info!("Reward Sounds закрыт");
    }
}

// ---------- вспомогательные элементы интерфейса ----------

fn pick_audio_file() -> Option<PathBuf> {
    rfd::FileDialog::new()
        .set_title("Выберите аудиофайл")
        .add_filter(
            "Аудиофайлы (MP3, WAV, OGG, FLAC)",
            &["mp3", "wav", "ogg", "flac"],
        )
        .add_filter("Все файлы", &["*"])
        .pick_file()
}

/// Разбирает цвет вида `#RRGGBB`.
fn parse_hex_color(text: &str) -> Option<Color32> {
    let text = text.trim().trim_start_matches('#');
    if text.len() != 6 {
        return None;
    }
    let red = u8::from_str_radix(&text[0..2], 16).ok()?;
    let green = u8::from_str_radix(&text[2..4], 16).ok()?;
    let blue = u8::from_str_radix(&text[4..6], 16).ok()?;
    Some(Color32::from_rgb(red, green, blue))
}

/// Иконки навигации в левой панели.
#[derive(Clone, Copy)]
enum NavIcon {
    Rewards,
    Music,
    Settings,
    Log,
}

/// Пункт бокового меню: иконка слева, подпись справа.
fn nav_item(ui: &mut egui::Ui, icon: NavIcon, label: &str, selected: bool) -> egui::Response {
    let (rect, response) = ui.allocate_exact_size(
        Vec2::new(ui.available_width(), 38.0),
        Sense::click(),
    );
    let rounding = Rounding::same(10.0);

    let hovered = response.hovered();
    // При наведении пункт «заливается» светлым, а текст становится тёмным.
    let (fill, fg) = if selected {
        (CARD_ACTIVE, TEXT)
    } else if hovered {
        (TEXT, BG)
    } else {
        (Color32::TRANSPARENT, TEXT_DIM)
    };

    if fill.a() > 0 {
        ui.painter().rect_filled(rect, rounding, fill);
    }

    let icon_rect = egui::Rect::from_center_size(
        egui::pos2(rect.left() + 22.0, rect.center().y),
        Vec2::splat(17.0),
    );
    paint_nav_icon(ui.painter(), icon_rect, icon, fg);

    ui.painter().text(
        egui::pos2(rect.left() + 44.0, rect.center().y),
        Align2::LEFT_CENTER,
        label,
        FontId::new(
            14.4,
            if selected {
                semibold()
            } else {
                egui::FontFamily::Proportional
            },
        ),
        fg,
    );

    response
}

fn paint_nav_icon(painter: &egui::Painter, rect: egui::Rect, icon: NavIcon, color: Color32) {
    let stroke = Stroke::new(1.6_f32, color);
    match icon {
        NavIcon::Rewards => {
            let gap = 3.0;
            let cell = (rect.width() - gap) / 2.0;
            for (dx, dy) in [(0.0, 0.0), (cell + gap, 0.0), (0.0, cell + gap), (cell + gap, cell + gap)] {
                let square =
                    egui::Rect::from_min_size(rect.min + Vec2::new(dx, dy), Vec2::splat(cell));
                painter.rect_filled(square, Rounding::same(3.0), color);
            }
        }
        NavIcon::Music => {
            // Две ноты: головки внизу и ножки вверх.
            for offset in [0.0_f32, rect.width() * 0.42] {
                let center = egui::pos2(rect.left() + 3.0 + offset, rect.bottom() - 3.2);
                painter.circle_filled(center, 2.7, color);
                painter.line_segment(
                    [
                        egui::pos2(center.x + 2.7, center.y),
                        egui::pos2(center.x + 2.7, rect.top() + 1.6),
                    ],
                    stroke,
                );
            }
            painter.line_segment(
                [
                    egui::pos2(rect.left() + 5.7, rect.top() + 1.6),
                    egui::pos2(rect.left() + 3.0 + rect.width() * 0.42 + 2.7, rect.top() + 4.4),
                ],
                stroke,
            );
        }
        NavIcon::Settings => {
            for (index, fraction) in [0.28_f32, 0.55, 0.82].iter().enumerate() {
                let y = rect.top() + rect.height() * fraction;
                painter.line_segment(
                    [egui::pos2(rect.left(), y), egui::pos2(rect.right(), y)],
                    stroke,
                );
                let x = rect.left() + rect.width() * (0.26 + 0.22 * index as f32);
                painter.circle_filled(egui::pos2(x, y), 2.6, color);
            }
        }
        NavIcon::Log => {
            for index in 0..3 {
                let y = rect.top() + 4.0 + index as f32 * 6.0;
                painter.circle_filled(egui::pos2(rect.left() + 2.0, y), 1.6, color);
                painter.line_segment(
                    [egui::pos2(rect.left() + 8.0, y), egui::pos2(rect.right(), y)],
                    stroke,
                );
            }
        }
    }
}

/// Иконки кнопок в своей шапке окна.
#[derive(Clone, Copy)]
enum TitleBarIcon {
    Minimize,
    Maximize,
    Restore,
    Close,
}

/// Кнопка шапки: тонкий рисунок, при наведении заливается цветом.
fn title_bar_button(
    ui: &mut egui::Ui,
    icon: TitleBarIcon,
    hover_color: Color32,
) -> egui::Response {
    let (rect, response) = ui.allocate_exact_size(Vec2::new(38.0, 26.0), Sense::click());
    let hovered = response.hovered();
    if hovered {
        ui.painter().rect_filled(rect, Rounding::same(7.0), hover_color);
    }

    let color = if hovered { BG } else { TEXT_DIM };
    let stroke = Stroke::new(1.4_f32, color);
    let center = rect.center();

    match icon {
        TitleBarIcon::Minimize => {
            ui.painter().line_segment(
                [
                    egui::pos2(center.x - 5.0, center.y),
                    egui::pos2(center.x + 5.0, center.y),
                ],
                stroke,
            );
        }
        TitleBarIcon::Maximize => {
            ui.painter().rect_stroke(
                egui::Rect::from_center_size(center, Vec2::splat(9.0)),
                Rounding::same(2.0),
                stroke,
            );
        }
        TitleBarIcon::Restore => {
            ui.painter().rect_stroke(
                egui::Rect::from_center_size(center + Vec2::new(1.5, 1.5), Vec2::splat(8.0)),
                Rounding::same(2.0),
                stroke,
            );
            ui.painter().rect_stroke(
                egui::Rect::from_center_size(center - Vec2::new(1.5, 1.5), Vec2::splat(8.0)),
                Rounding::same(2.0),
                stroke,
            );
        }
        TitleBarIcon::Close => {
            ui.painter().line_segment(
                [
                    egui::pos2(center.x - 5.0, center.y - 5.0),
                    egui::pos2(center.x + 5.0, center.y + 5.0),
                ],
                stroke,
            );
            ui.painter().line_segment(
                [
                    egui::pos2(center.x - 5.0, center.y + 5.0),
                    egui::pos2(center.x + 5.0, center.y - 5.0),
                ],
                stroke,
            );
        }
    }

    response
}

/// Иконки кнопок плеера.
#[derive(Clone, Copy)]
enum PlayerIcon {
    Restart,
    Play,
    Pause,
    Skip,
}

/// Круглая кнопка плеера: назад/дальше — тёмные, пауза/плей — белая.
fn player_icon_button(ui: &mut egui::Ui, icon: PlayerIcon) -> egui::Response {
    let primary = matches!(icon, PlayerIcon::Play | PlayerIcon::Pause);
    let size = if primary { 40.0 } else { 32.0 };
    let (rect, response) = ui.allocate_exact_size(Vec2::splat(size), Sense::click());
    let rect = snap_rect(ui, rect);
    let hovered = response.hovered() && ui.is_enabled();
    let painter = ui.painter();

    let (fill, glyph) = if primary {
        (if hovered { with_alpha(TEXT, 220) } else { TEXT }, BG)
    } else if hovered {
        (with_alpha(Color32::WHITE, 16), TEXT)
    } else {
        (with_alpha(Color32::WHITE, 8), TEXT_DIM)
    };
    painter.circle_filled(rect.center(), size * 0.5, fill);

    let stroke = Stroke::new(1.8_f32, glyph);
    let center = rect.center();
    let point = |dx: f32, dy: f32| egui::pos2(center.x + dx, center.y + dy);

    match icon {
        PlayerIcon::Restart => {
            painter.line_segment([point(-5.0, -4.5), point(-5.0, 4.5)], stroke);
            painter.add(egui::Shape::convex_polygon(
                vec![point(5.0, -4.5), point(5.0, 4.5), point(-3.5, 0.0)],
                glyph,
                Stroke::NONE,
            ));
        }
        PlayerIcon::Play => {
            painter.add(egui::Shape::convex_polygon(
                vec![point(-3.5, -5.5), point(-3.5, 5.5), point(5.5, 0.0)],
                glyph,
                Stroke::NONE,
            ));
        }
        PlayerIcon::Pause => {
            for dx in [-3.0_f32, 3.0] {
                painter.rect_filled(
                    egui::Rect::from_center_size(point(dx, 0.0), Vec2::new(3.4, 11.0)),
                    Rounding::same(1.5),
                    glyph,
                );
            }
        }
        PlayerIcon::Skip => {
            painter.add(egui::Shape::convex_polygon(
                vec![point(-5.0, -4.5), point(-5.0, 4.5), point(3.0, 0.0)],
                glyph,
                Stroke::NONE,
            ));
            painter.line_segment([point(4.5, -4.5), point(4.5, 4.5)], stroke);
        }
    }

    response
}

fn card_frame() -> egui::Frame {
    egui::Frame::none()
        .fill(CARD)
        .stroke(Stroke::new(1.0_f32, BORDER))
        .rounding(Rounding::same(14.0))
        .inner_margin(egui::Margin::symmetric(18.0, 16.0))
}

/// Карточка награды со звуком.
/// Меню управления наградой: изменение и удаление.
fn reward_menu(ui: &mut egui::Ui, reward: &twitch::RemoteReward) -> Option<RewardUiAction> {
    let mut action = None;
    ui.scope(|ui| {
        // Крупнее зона нажатия, чем сам текст «···».
        ui.spacing_mut().button_padding = Vec2::new(8.0, 6.0);
        ui.menu_button(
            RichText::new("•••")
                .size(12.0)
                .color(with_alpha(TEXT_DIM, 220)),
            |ui| {
                ui.set_min_width(180.0);
                if ui.button("Изменить награду").clicked() {
                    action = Some(RewardUiAction::Edit {
                        reward: reward.clone(),
                    });
                    ui.close_menu();
                }
                if ui.button("Удалить награду").clicked() {
                    action = Some(RewardUiAction::Delete {
                        reward: reward.clone(),
                    });
                    ui.close_menu();
                }
            },
        );
    });
    action
}

/// Рисует награды плиткой.
fn draw_reward_grid(
    ui: &mut egui::Ui,
    rewards: &[&twitch::RemoteReward],
    bindings: &[crate::config::RewardSound],
    playing: &[String],
    file_cache: &HashMap<String, CachedFile>,
    columns: usize,
) -> Vec<RewardUiAction> {
    let mut actions = Vec::new();
    let columns = columns.max(1);
    ui.spacing_mut().item_spacing.x = 12.0;
    for row in rewards.chunks(columns) {
        ui.columns(columns, |cols| {
            for (index, reward) in row.iter().enumerate() {
                if index >= cols.len() {
                    break;
                }
                let binding = bindings
                    .iter()
                    .find(|binding| binding.reward_id == reward.id);
                let instances = playing
                    .iter()
                    .filter(|id| id.as_str() == reward.id.as_str())
                    .count();
                if let Some(action) = reward_card_grid(
                    &mut cols[index],
                    reward,
                    binding,
                    instances,
                    file_cache,
                ) {
                    actions.push(action);
                }
            }
        });
        ui.add_space(12.0);
    }
    actions
}

/// Компактная карточка награды для режима «плитка».
fn reward_card_grid(
    ui: &mut egui::Ui,
    reward: &twitch::RemoteReward,
    binding: Option<&crate::config::RewardSound>,
    instances: usize,
    file_cache: &HashMap<String, CachedFile>,
) -> Option<RewardUiAction> {
    let mut action = None;
    let color = parse_hex_color(&reward.color).unwrap_or(ACCENT);
    let available = reward.is_available();
    let (state, _) = reward.state_label();
    let fill = tinted(CARD, color, if available { 0.13 } else { 0.05 });
    let border = tinted(BORDER, color, if available { 0.22 } else { 0.08 });

    egui::Frame::none()
        .fill(fill)
        .stroke(Stroke::new(1.0_f32, border))
        .rounding(Rounding::same(18.0))
        .inner_margin(egui::Margin::symmetric(16.0, 14.0))
        .show(ui, |ui| {
            ui.set_width(ui.available_width());
            ui.spacing_mut().item_spacing.y = 0.0;

            ui.horizontal(|ui| {
                let (tile, _) = ui.allocate_exact_size(Vec2::splat(38.0), Sense::hover());
                ui.painter().rect_filled(
                    tile,
                    Rounding::same(11.0),
                    with_alpha(color, if available { 235 } else { 120 }),
                );
                let letter = reward
                    .title
                    .chars()
                    .next()
                    .map(|c| c.to_uppercase().to_string())
                    .unwrap_or_else(|| "R".to_string());
                ui.painter().text(
                    tile.center(),
                    Align2::CENTER_CENTER,
                    letter,
                    FontId::new(18.0, semibold()),
                    Color32::from_rgb(0x12, 0x13, 0x22),
                );
                ui.add_space(10.0);

                ui.vertical(|ui| {
                    ui.spacing_mut().item_spacing.y = 2.0;
                    ui.set_max_width((ui.available_width() - 52.0).max(80.0));
                    ui.add(
                        egui::Label::new(
                            RichText::new(&reward.title)
                                .family(semibold())
                                .size(15.0)
                                .color(if available { TEXT } else { TEXT_DIM }),
                        )
                        .truncate(),
                    )
                    .on_hover_text(&reward.title);
                    ui.label(
                        RichText::new(format!(
                            "{} {} · {}",
                            reward.cost,
                            util::plural_ru(
                                reward.cost.max(0) as usize,
                                "БАЛЛ",
                                "БАЛЛА",
                                "БАЛЛОВ"
                            ),
                            state.to_uppercase()
                        ))
                        .size(10.8)
                        .color(with_alpha(TEXT_DIM, 230)),
                    );
                });

                ui.with_layout(Layout::right_to_left(Align::Min), |ui| {
                    if let Some(chosen) = reward_menu(ui, reward) {
                        action = Some(chosen);
                    }
                });
            });

            ui.add_space(13.0);

            let (meta, exists) = match binding {
                Some(binding) => sound_meta(&binding.path, file_cache.get(&binding.path)),
                None => (String::new(), true),
            };

            egui::Frame::none()
                .fill(blend_over(fill, with_alpha(Color32::WHITE, 7)))
                .rounding(Rounding::same(10.0))
                .inner_margin(egui::Margin::symmetric(11.0, 4.0))
                .show(ui, |ui| {
                    ui.set_width(ui.available_width());
                    ui.set_min_height(34.0);
                    ui.horizontal(|ui| match binding {
                        Some(binding) => {
                            if sound_play_button(ui, 18.0, exists).clicked() && exists {
                                action = Some(RewardUiAction::Play {
                                    reward_id: reward.id.clone(),
                                    path: binding.path.clone(),
                                });
                            }
                            ui.add(
                                egui::Label::new(
                                    RichText::new(util::file_name(Path::new(&binding.path)))
                                        .size(11.4)
                                        .color(if exists { TEXT } else { DANGER }),
                                )
                                .truncate(),
                            )
                            .on_hover_text(&binding.path);
                            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                                ui.label(
                                    RichText::new(meta)
                                        .size(9.8)
                                        .color(if exists {
                                            with_alpha(TEXT_DIM, 220)
                                        } else {
                                            DANGER
                                        }),
                                );
                            });
                        }
                        None => {
                            ui.label(
                                RichText::new("Звук не выбран")
                                    .size(11.4)
                                    .color(with_alpha(TEXT_DIM, 200)),
                            );
                            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                                ui.label(
                                    RichText::new("нажмите «Выбрать»")
                                        .size(9.6)
                                        .color(with_alpha(TEXT_DIM, 150)),
                                );
                            });
                        }
                    });
                });

            ui.add_space(11.0);

            match binding {
                Some(binding) => {
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new("ГРОМКОСТЬ")
                                .size(9.0)
                                .color(with_alpha(TEXT_DIM, 220)),
                        );
                        let mut volume = binding.volume as f32;
                        let slider = fader(ui, &mut volume, 0.0, 2.0, 90.0);
                        let volume = volume as f64;
                        ui.label(
                            RichText::new(format!("{}%", (volume * 100.0).round() as i32))
                                .size(10.8)
                                .color(TEXT_DIM),
                        );
                        if instances > 0 {
                            ui.label(
                                RichText::new(format!("×{instances}"))
                                    .size(10.8)
                                    .color(SUCCESS),
                            );
                        }
                        if slider.changed() {
                            action = Some(RewardUiAction::SetVolume {
                                reward_id: reward.id.clone(),
                                volume,
                            });
                        }
                    });
                }
                None => {
                    ui.add_space(20.0);
                }
            }

            ui.add_space(12.0);
            ui.spacing_mut().item_spacing.x = 6.0;
            ui.horizontal(|ui| match binding {
                Some(_) => {
                    if compact_secondary_button(ui, "Заменить").clicked() {
                        action = Some(RewardUiAction::Bind {
                            reward_id: reward.id.clone(),
                            title: reward.title.clone(),
                        });
                    }
                    if ghost_button(ui, "Убрать", with_alpha(DANGER, 220)).clicked() {
                        action = Some(RewardUiAction::Clear {
                            reward_id: reward.id.clone(),
                        });
                    }
                }
                None => {
                    if compact_primary_button(ui, "Выбрать звук").clicked() {
                        action = Some(RewardUiAction::Bind {
                            reward_id: reward.id.clone(),
                            title: reward.title.clone(),
                        });
                    }
                }
            });
        });

    action
}

fn reward_card(
    ui: &mut egui::Ui,
    reward: &twitch::RemoteReward,
    binding: Option<&crate::config::RewardSound>,
    instances: usize,
    file_cache: &HashMap<String, CachedFile>,
) -> Option<RewardUiAction> {
    let mut action = None;
    let color = parse_hex_color(&reward.color).unwrap_or(ACCENT);
    let available = reward.is_available();
    let fill = tinted(CARD, color, if available { 0.13 } else { 0.05 });
    let border = tinted(BORDER, color, if available { 0.22 } else { 0.08 });
    let (state, _) = reward.state_label();

    egui::Frame::none()
        .fill(fill)
        .stroke(Stroke::new(1.0_f32, border))
        .rounding(Rounding::same(16.0))
        .inner_margin(egui::Margin::symmetric(16.0, 12.0))
        .show(ui, |ui| {
            ui.set_width(ui.available_width());

            ui.horizontal(|ui| {
                let (tile, _) = ui.allocate_exact_size(Vec2::splat(38.0), Sense::hover());
                ui.painter().rect_filled(
                    tile,
                    Rounding::same(11.0),
                    with_alpha(color, if available { 235 } else { 120 }),
                );
                let letter = reward
                    .title
                    .chars()
                    .next()
                    .map(|c| c.to_uppercase().to_string())
                    .unwrap_or_else(|| "R".to_string());
                ui.painter().text(
                    tile.center(),
                    Align2::CENTER_CENTER,
                    letter,
                    FontId::new(18.0, semibold()),
                    Color32::from_rgb(0x12, 0x13, 0x22),
                );
                ui.add_space(12.0);

                ui.vertical(|ui| {
                    ui.label(
                        RichText::new(&reward.title)
                            .family(semibold())
                            .size(17.0)
                            .color(if available { TEXT } else { TEXT_DIM }),
                    );
                    ui.label(
                        RichText::new(format!(
                            "{} {} · {}",
                            reward.cost,
                            util::plural_ru(
                                reward.cost.max(0) as usize,
                                "БАЛЛ",
                                "БАЛЛА",
                                "БАЛЛОВ"
                            ),
                            state.to_uppercase()
                        ))
                        .size(11.0)
                        .color(with_alpha(TEXT_DIM, 230)),
                    );
                });

                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    match binding {
                        Some(_) => {
                            if ghost_button(ui, "Убрать", with_alpha(DANGER, 220)).clicked() {
                                action = Some(RewardUiAction::Clear {
                                    reward_id: reward.id.clone(),
                                });
                            }
                            if secondary_button(ui, "Заменить").clicked() {
                                action = Some(RewardUiAction::Bind {
                                    reward_id: reward.id.clone(),
                                    title: reward.title.clone(),
                                });
                            }
                        }
                        None => {
                            if accent_button(ui, "Выбрать звук").clicked() {
                                action = Some(RewardUiAction::Bind {
                                    reward_id: reward.id.clone(),
                                    title: reward.title.clone(),
                                });
                            }
                        }
                    }
                    if let Some(chosen) = reward_menu(ui, reward) {
                        action = Some(chosen);
                    }
                });
            });

            ui.add_space(8.0);

            match binding {
                Some(binding) => {
                    let (meta, exists) = sound_meta(&binding.path, file_cache.get(&binding.path));
                    ui.horizontal(|ui| {
                        if sound_play_button(ui, 26.0, exists).clicked() && exists {
                            action = Some(RewardUiAction::Play {
                                reward_id: reward.id.clone(),
                                path: binding.path.clone(),
                            });
                        }
                        ui.add(
                            egui::Label::new(
                                RichText::new(util::file_name(Path::new(&binding.path)))
                                    .size(13.2)
                                    .color(if exists { TEXT } else { DANGER }),
                            )
                            .truncate(),
                        )
                        .on_hover_text(&binding.path);
                        ui.label(
                            RichText::new(format!("· {meta}"))
                                .size(11.4)
                                .color(if exists { TEXT_DIM } else { DANGER }),
                        );
                        if instances > 0 {
                            ui.label(
                                RichText::new(format!("играет ×{instances}"))
                                    .size(11.0)
                                    .color(SUCCESS),
                            );
                        }

                        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                            let mut volume = binding.volume as f32;
                            let slider = fader(ui, &mut volume, 0.0, 2.0, 110.0);
                            let volume = volume as f64;
                            ui.label(
                                RichText::new(format!("{}%", (volume * 100.0).round() as i32))
                                    .size(11.4)
                                    .color(TEXT_DIM),
                            );
                            ui.label(
                                RichText::new("Громкость")
                                    .size(11.4)
                                    .color(with_alpha(TEXT_DIM, 210)),
                            );
                            if slider.changed() {
                                action = Some(RewardUiAction::SetVolume {
                                    reward_id: reward.id.clone(),
                                    volume,
                                });
                            }
                        });
                    });
                }
                None => {
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new("Звук не выбран — награда сработает без звука")
                                .size(12.2)
                                .color(with_alpha(TEXT_DIM, 200)),
                        );
                    });
                }
            }
        });

    action
}

/// Карточка привязки, для которой награда больше не существует на Twitch.
fn orphan_reward_card(
    ui: &mut egui::Ui,
    binding: &crate::config::RewardSound,
) -> Option<RewardUiAction> {
    let mut action = None;
    card_frame().show(ui, |ui| {
        ui.horizontal(|ui| {
            ui.vertical(|ui| {
                ui.label(
                    RichText::new(if binding.title.is_empty() {
                        "Награда без названия"
                    } else {
                        &binding.title
                    })
                    .size(16.2)
                    .strong()
                    .color(TEXT),
                );
                ui.label(
                    RichText::new("Награда не найдена на Twitch — возможно, удалена")
                        .size(13.2)
                        .color(WARN),
                );
            });
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                if danger_button(ui, "Убрать звук").clicked() {
                    action = Some(RewardUiAction::Clear {
                        reward_id: binding.reward_id.clone(),
                    });
                }
            });
        });
        ui.add_space(4.0);
        ui.horizontal(|ui| {
            if secondary_button(ui, "Прослушать").clicked() && Path::new(&binding.path).is_file() {
                action = Some(RewardUiAction::Play {
                    reward_id: binding.reward_id.clone(),
                    path: binding.path.clone(),
                });
            }
            ui.add(
                egui::Label::new(
                    RichText::new(util::file_name(Path::new(&binding.path)))
                        .size(13.2)
                        .color(TEXT_DIM),
                )
                .truncate(),
            )
            .on_hover_text(&binding.path);
        });
    });
    action
}

/// Полоса прогресса с перемоткой.
///
/// Возвращает новую позицию в секундах, если пользователь щёлкнул по полосе
/// или отпустил ползунок.
fn music_progress(ui: &mut egui::Ui, position: u64, duration: u64) -> Option<u64> {
    let width = ui.available_width().max(120.0);
    music_progress_width(ui, position, duration, width)
}

fn music_progress_width(
    ui: &mut egui::Ui,
    position: u64,
    duration: u64,
    width: f32,
) -> Option<u64> {
    let (rect, response) = ui.allocate_exact_size(Vec2::new(width, 14.0), Sense::click_and_drag());
    let painter = ui.painter();

    let track = egui::Rect::from_center_size(rect.center(), Vec2::new(rect.width(), 2.0));
    painter.rect_filled(track, Rounding::same(1.0), blend_over(CARD, with_alpha(Color32::WHITE, 22)));

    let duration_f = duration.max(1) as f32;
    let mut fraction = (position as f32 / duration_f).clamp(0.0, 1.0);
    if let Some(pointer) = response.interact_pointer_pos() {
        fraction = ((pointer.x - rect.left()) / rect.width()).clamp(0.0, 1.0);
    }

    let knob_x = rect.left() + rect.width() * fraction;
    let fill = egui::Rect::from_min_max(
        track.min,
        egui::pos2(knob_x.max(track.left()), track.max.y),
    );
    painter.rect_filled(fill, Rounding::same(1.0), Color32::WHITE);
    painter.circle_filled(egui::pos2(knob_x, rect.center().y), 7.0, Color32::WHITE);

    if response.drag_stopped() || response.clicked() {
        return Some((fraction * duration_f).round() as u64);
    }
    None
}

fn section_card(ui: &mut egui::Ui, title: &str, body: impl FnOnce(&mut egui::Ui)) {
    card_frame().show(ui, |ui| {
        ui.set_width(ui.available_width());
        ui.label(RichText::new(title).family(semibold()).size(16.2).color(TEXT));
        ui.add_space(8.0);
        body(ui);
    });
}

fn paragraph(ui: &mut egui::Ui, text: &str, color: Color32, size: f32) {
    ui.add(egui::Label::new(RichText::new(text).size(size).color(color)).wrap());
}

fn hint(ui: &mut egui::Ui, text: &str) {
    paragraph(ui, text, TEXT_DIM, 13.6);
}


/// «Таблетка»-кнопка (используется для статуса Twitch в шапке).
fn pill_button(ui: &mut egui::Ui, text: &str, color: Color32) -> egui::Response {
    let font = FontId::new(13.8, egui::FontFamily::Proportional);
    let width = ui
        .painter()
        .layout_no_wrap(text.to_owned(), font.clone(), TEXT)
        .size()
        .x;

    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(width + 34.0, 32.0), Sense::click());
    let rect = snap_rect(ui, rect);
    let enabled = ui.is_enabled();
    let hovered = response.hovered() && enabled;
    let painter = ui.painter();
    // Только заливка: обводка на скруглениях 1× выглядела «лесенкой».
    painter.rect_filled(
        rect,
        Rounding::same(16.0),
        blend_over(
            BG,
            if !enabled {
                with_alpha(color, 8)
            } else if hovered {
                color
            } else {
                with_alpha(color, 24)
            },
        ),
    );
    painter.text(
        rect.center(),
        Align2::CENTER_CENTER,
        text,
        font,
        if !enabled {
            with_alpha(color, 110)
        } else if hovered {
            BG
        } else {
            color
        },
    );

    response
}

fn styled_button(
    ui: &mut egui::Ui,
    label: &str,
    base: Color32,
    _hover: Color32,
    text_color: Color32,
    border: Color32,
) -> egui::Response {
    let font = FontId::new(15.0, egui::FontFamily::Proportional);
    let text_width = ui
        .painter()
        .layout_no_wrap(label.to_owned(), font.clone(), TEXT)
        .size()
        .x;

    let (rect, response) = ui.allocate_exact_size(
        Vec2::new(text_width + 34.0, 34.0),
        Sense::click(),
    );

    let enabled = ui.is_enabled();
    let rect = snap_rect(ui, rect);
    // Инверсия: при наведении фон и текст меняются местами.
    let hovered = response.hovered() && enabled;
    let (fill, text, edge) = if !enabled {
        (
            Color32::TRANSPARENT,
            with_alpha(text_color, 80),
            with_alpha(border, 26),
        )
    } else if hovered {
        (text_color, if base.a() >= 200 { base } else { BG }, text_color)
    } else {
        (base, text_color, border)
    };

    let painter = ui.painter();
    // Прозрачный фон у secondary/ghost — как в макете: сквозь кнопку видна
    // карточка. Никаких подмен на CARD.
    let stroke = if edge.a() == 0 {
        Stroke::NONE
    } else {
        Stroke::new(2.0_f32, blend_over(CARD, edge))
    };
    painter.rect(rect, Rounding::same(17.0), fill, stroke);
    painter.text(
        rect.center(),
        Align2::CENTER_CENTER,
        label,
        font,
        text,
    );

    response
}

fn ghost_button(ui: &mut egui::Ui, label: &str, color: Color32) -> egui::Response {
    let font = FontId::new(13.8, egui::FontFamily::Proportional);
    let enabled = ui.is_enabled();
    let width = ui
        .painter()
        .layout_no_wrap(label.to_owned(), font.clone(), TEXT)
        .size()
        .x;
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(width + 10.0, 30.0), Sense::click());
    let rect = snap_rect(ui, rect);
    let hovered = response.hovered() && enabled;
    let tint = if enabled { color } else { with_alpha(color, 80) };
    if hovered {
        ui.painter().rect_filled(
            rect,
            Rounding::same(8.0),
            blend_over(CARD, with_alpha(color, 26)),
        );
    }
    ui.painter().text(
        rect.center(),
        Align2::CENTER_CENTER,
        label,
        font,
        tint,
    );
    response
}

/// Иконки, которые рисуются кодом: без внешних картинок и эмодзи, чтобы
/// одинаково выглядеть на любой Windows и в любом DPI.
#[derive(Clone, Copy, PartialEq, Eq)]
enum UiIcon {
    Refresh,
    Search,
    Dots,
    Play,
    Pause,
    Stop,
    Grid,
    List,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    Eye,
    X,
    Plus,
    Volume,
    VolumeMuted,
    Folder,
    External,
    Trash,
    Edit,
    Check,
    Copy,
}

fn paint_ui_icon(painter: &egui::Painter, rect: egui::Rect, icon: UiIcon, color: Color32) {
    let stroke = Stroke::new(1.6_f32, color);
    let center = rect.center();
    let w = rect.width();
    let h = rect.height();
    match icon {
        UiIcon::Refresh => {
            let stroke = Stroke::new(2.0_f32, color);
            let radius = w * 0.40;
            let mut points = Vec::new();
            // Дуга примерно на 300°: рисуем сегментами, край остаётся гладким.
            for step in 0..24 {
                let angle = -0.35 + step as f32 * (std::f32::consts::TAU * 0.82 / 23.0);
                points.push(egui::pos2(
                    center.x + radius * angle.cos(),
                    center.y + radius * angle.sin(),
                ));
            }
            painter.add(egui::Shape::line(points, stroke));
            // Стрелка на конце дуги.
            let tip = egui::pos2(center.x + radius * 0.98, center.y - h * 0.28);
            painter.add(egui::Shape::convex_polygon(
                vec![
                    egui::pos2(tip.x + w * 0.04, tip.y - h * 0.08),
                    egui::pos2(tip.x - w * 0.22, tip.y + h * 0.02),
                    egui::pos2(tip.x + w * 0.06, tip.y + h * 0.16),
                ],
                color,
                Stroke::NONE,
            ));
        }
        UiIcon::Search => {
            painter.circle_stroke(
                egui::pos2(center.x - w * 0.06, center.y - h * 0.06),
                w * 0.26,
                stroke,
            );
            painter.line_segment(
                [
                    egui::pos2(center.x + w * 0.14, center.y + h * 0.14),
                    egui::pos2(center.x + w * 0.32, center.y + h * 0.32),
                ],
                stroke,
            );
        }
        UiIcon::Dots => {
            let radius = (w * 0.085).max(1.8);
            for dx in [-0.26_f32, 0.0, 0.26] {
                painter.circle_filled(
                    egui::pos2(center.x + w * dx, center.y),
                    radius,
                    color,
                );
            }
        }
        UiIcon::Play => {
            // Крупнее и с отступом от края: в 24–28 px треугольник больше не «пикселит».
            let left = center.x - w * 0.16;
            let right = center.x + w * 0.34;
            painter.add(egui::Shape::convex_polygon(
                vec![
                    egui::pos2(left, center.y - h * 0.36),
                    egui::pos2(right, center.y),
                    egui::pos2(left, center.y + h * 0.36),
                ],
                color,
                Stroke::NONE,
            ));
        }
        UiIcon::Pause => {
            painter.rect_filled(
                egui::Rect::from_center_size(
                    egui::pos2(center.x - w * 0.13, center.y),
                    Vec2::new(w * 0.16, h * 0.5),
                ),
                Rounding::same(1.5),
                color,
            );
            painter.rect_filled(
                egui::Rect::from_center_size(
                    egui::pos2(center.x + w * 0.13, center.y),
                    Vec2::new(w * 0.16, h * 0.5),
                ),
                Rounding::same(1.5),
                color,
            );
        }
        UiIcon::Stop => {
            painter.rect_filled(
                egui::Rect::from_center_size(center, Vec2::splat(w * 0.48)),
                Rounding::same(3.0),
                color,
            );
        }
        UiIcon::Grid => {
            let cell = w * 0.30;
            let gap = w * 0.12;
            for (dx, dy) in [(-1.0_f32, -1.0_f32), (1.0, -1.0), (-1.0, 1.0), (1.0, 1.0)] {
                let c = egui::pos2(
                    center.x + dx * (cell + gap) / 2.0,
                    center.y + dy * (cell + gap) / 2.0,
                );
                painter.rect_filled(
                    egui::Rect::from_center_size(c, Vec2::splat(cell)),
                    Rounding::same(2.0),
                    color,
                );
            }
        }
        UiIcon::List => {
            for i in 0..3 {
                let y = center.y + (i as f32 - 1.0) * h * 0.22;
                painter.circle_filled(egui::pos2(rect.left() + w * 0.18, y), w * 0.035, color);
                painter.line_segment(
                    [egui::pos2(rect.left() + w * 0.34, y), egui::pos2(rect.right() - w * 0.12, y)],
                    Stroke::new(1.5_f32, color),
                );
            }
        }
        UiIcon::ChevronDown => {
            painter.line_segment(
                [egui::pos2(center.x - w * 0.25, center.y - h * 0.12), egui::pos2(center.x, center.y + h * 0.15)],
                stroke,
            );
            painter.line_segment(
                [egui::pos2(center.x + w * 0.25, center.y - h * 0.12), egui::pos2(center.x, center.y + h * 0.15)],
                stroke,
            );
        }
        UiIcon::ChevronRight => {
            painter.text(
                center,
                Align2::CENTER_CENTER,
                "›",
                FontId::new((h * 1.5).max(14.0), egui::FontFamily::Proportional),
                color,
            );
        }
        UiIcon::ChevronUp => {
            let stroke = Stroke::new(2.0_f32, color);
            painter.line_segment(
                [
                    egui::pos2(center.x - w * 0.22, center.y + h * 0.10),
                    egui::pos2(center.x, center.y - h * 0.18),
                ],
                stroke,
            );
            painter.line_segment(
                [
                    egui::pos2(center.x + w * 0.22, center.y + h * 0.10),
                    egui::pos2(center.x, center.y - h * 0.18),
                ],
                stroke,
            );
        }
        UiIcon::Eye => {
            let stroke = Stroke::new(1.6_f32, color);
            let mut top = Vec::new();
            let mut bottom = Vec::new();
            for step in 0..9 {
                let x = -0.44 + step as f32 * (0.88 / 8.0);
                let bend = 1.0 - (x / 0.44).powi(2);
                top.push(egui::pos2(center.x + x * w, center.y - 0.30 * h * bend));
                bottom.push(egui::pos2(center.x + x * w, center.y + 0.30 * h * bend));
            }
            painter.add(egui::Shape::line(top, stroke));
            painter.add(egui::Shape::line(bottom, stroke));
            painter.circle_filled(center, w * 0.13, color);
        }
        UiIcon::X => {
            painter.text(
                center,
                Align2::CENTER_CENTER,
                "×",
                FontId::new((h * 1.25).max(12.0), egui::FontFamily::Proportional),
                color,
            );
        }
        UiIcon::Plus => {
            painter.line_segment(
                [egui::pos2(center.x - w * 0.26, center.y), egui::pos2(center.x + w * 0.26, center.y)],
                stroke,
            );
            painter.line_segment(
                [egui::pos2(center.x, center.y - h * 0.26), egui::pos2(center.x, center.y + h * 0.26)],
                stroke,
            );
        }
        UiIcon::Volume | UiIcon::VolumeMuted => {
            painter.add(egui::Shape::convex_polygon(
                vec![
                    egui::pos2(rect.left() + w * 0.12, center.y - h * 0.16),
                    egui::pos2(rect.left() + w * 0.32, center.y - h * 0.16),
                    egui::pos2(rect.left() + w * 0.56, center.y - h * 0.36),
                    egui::pos2(rect.left() + w * 0.56, center.y + h * 0.36),
                    egui::pos2(rect.left() + w * 0.32, center.y + h * 0.16),
                    egui::pos2(rect.left() + w * 0.12, center.y + h * 0.16),
                ],
                color,
                Stroke::NONE,
            ));
            if icon == UiIcon::VolumeMuted {
                painter.line_segment(
                    [egui::pos2(center.x + w * 0.10, center.y - h * 0.20), egui::pos2(center.x + w * 0.38, center.y + h * 0.20)],
                    stroke,
                );
                painter.line_segment(
                    [egui::pos2(center.x + w * 0.38, center.y - h * 0.20), egui::pos2(center.x + w * 0.10, center.y + h * 0.20)],
                    stroke,
                );
            } else {
                painter.circle_stroke(egui::pos2(center.x + w * 0.10, center.y), w * 0.22, stroke);
            }
        }
        UiIcon::Folder => {
            let body = egui::Rect::from_center_size(center, Vec2::new(w * 0.62, h * 0.44));
            painter.rect_stroke(body, Rounding::same(2.0), stroke);
            painter.line_segment(
                [egui::pos2(rect.left() + w * 0.20, body.top() - h * 0.12), egui::pos2(rect.left() + w * 0.42, body.top())],
                stroke,
            );
        }
        UiIcon::External => {
            let box_rect = egui::Rect::from_min_max(
                egui::pos2(rect.left() + w * 0.16, rect.top() + h * 0.34),
                egui::pos2(rect.left() + w * 0.66, rect.bottom() - h * 0.14),
            );
            painter.rect_stroke(box_rect, Rounding::same(2.0), stroke);
            painter.line_segment(
                [egui::pos2(rect.left() + w * 0.52, rect.top() + h * 0.18), egui::pos2(rect.right() - w * 0.14, rect.top() + h * 0.18)],
                stroke,
            );
            painter.line_segment(
                [egui::pos2(rect.right() - w * 0.14, rect.top() + h * 0.18), egui::pos2(rect.right() - w * 0.14, rect.top() + h * 0.52)],
                stroke,
            );
        }
        UiIcon::Trash => {
            painter.line_segment(
                [egui::pos2(rect.left() + w * 0.22, rect.top() + h * 0.26), egui::pos2(rect.right() - w * 0.22, rect.top() + h * 0.26)],
                stroke,
            );
            painter.rect_stroke(
                egui::Rect::from_min_max(
                    egui::pos2(rect.left() + w * 0.28, rect.top() + h * 0.26),
                    egui::pos2(rect.right() - w * 0.28, rect.bottom() - h * 0.16),
                ),
                Rounding::same(1.0),
                stroke,
            );
        }
        UiIcon::Edit => {
            painter.line_segment(
                [egui::pos2(rect.left() + w * 0.22, rect.bottom() - h * 0.20), egui::pos2(rect.right() - w * 0.16, rect.top() + h * 0.26)],
                stroke,
            );
            painter.line_segment(
                [egui::pos2(rect.left() + w * 0.22, rect.bottom() - h * 0.20), egui::pos2(rect.left() + w * 0.32, rect.bottom() - h * 0.34)],
                stroke,
            );
        }
        UiIcon::Copy => {
            let back = egui::Rect::from_min_max(
                egui::pos2(rect.left() + w * 0.16, rect.top() + h * 0.30),
                egui::pos2(rect.right() - w * 0.30, rect.bottom() - h * 0.14),
            );
            painter.rect_stroke(back, Rounding::same(2.0), stroke);
            let front = egui::Rect::from_min_max(
                egui::pos2(rect.left() + w * 0.32, rect.top() + h * 0.14),
                egui::pos2(rect.right() - w * 0.14, rect.bottom() - h * 0.30),
            );
            painter.rect_filled(front, Rounding::same(2.0), color);
        }
        UiIcon::Check => {
            painter.line_segment(
                [egui::pos2(center.x - w * 0.24, center.y + h * 0.02), egui::pos2(center.x - w * 0.06, center.y + h * 0.20)],
                stroke,
            );
            painter.line_segment(
                [egui::pos2(center.x - w * 0.06, center.y + h * 0.20), egui::pos2(center.x + w * 0.26, center.y - h * 0.20)],
                stroke,
            );
        }
    }
}

/// Кнопка прослушивания звука: круг с треугольником, как в макете.
fn sound_play_button(ui: &mut egui::Ui, size: f32, enabled: bool) -> egui::Response {
    let (rect, response) = ui.allocate_exact_size(Vec2::splat(size), Sense::click());
    let hovered = response.hovered();
    ui.painter().circle_filled(
        rect.center(),
        size * 0.5,
        if hovered {
            with_alpha(Color32::WHITE, 22)
        } else {
            with_alpha(Color32::WHITE, 10)
        },
    );
    paint_ui_icon(
        ui.painter(),
        rect.shrink(size * 0.22),
        UiIcon::Play,
        if enabled { TEXT } else { with_alpha(TEXT_DIM, 120) },
    );
    response.on_hover_text(if enabled { "Прослушать" } else { "Файл не найден" })
}

/// Круглая кнопка-иконка с подсказкой (34×34 по умолчанию).
fn icon_button(ui: &mut egui::Ui, icon: UiIcon, tooltip: &str, size: f32) -> egui::Response {
    let (rect, response) = ui.allocate_exact_size(Vec2::splat(size), Sense::click());
    let enabled = ui.is_enabled();
    let hovered = response.hovered() && enabled;
    if hovered {
        ui.painter().rect_filled(
            rect,
            Rounding::same(9.0),
            blend_over(CARD, with_alpha(Color32::WHITE, 12)),
        );
    }
    let color = if !enabled {
        with_alpha(TEXT_DIM, 90)
    } else if hovered {
        TEXT
    } else {
        TEXT_DIM
    };
    paint_ui_icon(ui.painter(), rect.shrink(size * 0.13), icon, color);
    response.on_hover_text(tooltip)
}

/// Кнопка выбора положения в OBS-окне.
fn position_button(ui: &mut egui::Ui, label: &str, active: bool) -> bool {
    let font = FontId::new(13.0, egui::FontFamily::Proportional);
    let text_width = ui
        .painter()
        .layout_no_wrap(label.to_owned(), font.clone(), TEXT)
        .size()
        .x;
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(text_width + 28.0, 30.0), Sense::click());
    let rect = snap_rect(ui, rect);
    let hovered = response.hovered();
    if active {
        ui.painter().rect_filled(rect, Rounding::same(9.0), TEXT);
    } else if hovered {
        ui.painter()
            .rect_filled(rect, Rounding::same(9.0), with_alpha(Color32::WHITE, 7));
    }
    ui.painter().text(
        rect.center(),
        Align2::CENTER_CENTER,
        label,
        font,
        if active { BG } else { TEXT_DIM },
    );
    response.clicked()
}

/// Статусная «таблетка» с точкой, как в макете.
fn status_pill(ui: &mut egui::Ui, text: &str, color: Color32) -> egui::Response {
    let font = FontId::new(13.8, egui::FontFamily::Proportional);
    let width = ui
        .painter()
        .layout_no_wrap(text.to_owned(), font.clone(), TEXT)
        .size()
        .x;
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(width + 44.0, 32.0), Sense::click());
    let rect = snap_rect(ui, rect);
    let enabled = ui.is_enabled();
    let hovered = response.hovered() && enabled;
    ui.painter().rect_filled(
        rect,
        Rounding::same(16.0),
        blend_over(
            BG,
            if !enabled {
                with_alpha(color, 8)
            } else if hovered {
                color
            } else {
                with_alpha(color, 22)
            },
        ),
    );
    let dot_color = if hovered && enabled { BG } else { color };
    ui.painter().circle_filled(
        egui::pos2(rect.left() + 17.0, rect.center().y),
        4.0,
        dot_color,
    );
    ui.painter().text(
        egui::pos2(rect.left() + 27.0, rect.center().y),
        Align2::LEFT_CENTER,
        text,
        font,
        if !enabled {
            with_alpha(color, 110)
        } else if hovered {
            BG
        } else {
            color
        },
    );
    response
}

/// Маленький зелёный чип «готово» с галочкой.
fn ok_chip(ui: &mut egui::Ui, text: &str) -> egui::Response {
    let font = FontId::new(11.6, egui::FontFamily::Proportional);
    let width = ui
        .painter()
        .layout_no_wrap(text.to_owned(), font.clone(), SUCCESS)
        .size()
        .x;
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(width + 34.0, 26.0), Sense::hover());
    let rect = snap_rect(ui, rect);
    ui.painter().rect_filled(
        rect,
        Rounding::same(13.0),
        blend_over(BG, with_alpha(SUCCESS, 22)),
    );
    ui.painter().text(
        egui::pos2(rect.left() + 12.0, rect.center().y),
        Align2::LEFT_CENTER,
        "✓",
        FontId::new(11.0, egui::FontFamily::Proportional),
        SUCCESS,
    );
    ui.painter().text(
        egui::pos2(rect.left() + 24.0, rect.center().y),
        Align2::LEFT_CENTER,
        text,
        font,
        SUCCESS,
    );
    response
}

/// Чип со счётчиком (например, «1 играет»).
fn queue_count_chip(ui: &mut egui::Ui, count: usize, state: ItemState) -> egui::Response {
    let color = match state {
        ItemState::Loading => WARN,
        ItemState::Playing => SUCCESS,
        _ => TEXT_DIM,
    };
    let text = format!("{count} {}", state.label());
    let font = FontId::new(11.0, egui::FontFamily::Proportional);
    let width = ui
        .painter()
        .layout_no_wrap(text.clone(), font.clone(), color)
        .size()
        .x;
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(width + 18.0, 22.0), Sense::hover());
    ui.painter().rect_filled(
        rect,
        Rounding::same(11.0),
        blend_over(CARD, with_alpha(color, 24)),
    );
    ui.painter().text(
        rect.center(),
        Align2::CENTER_CENTER,
        text,
        font,
        color,
    );
    response
}

/// Маленькая кнопка действия в строке очереди (крестик/вверх).
fn queue_action_button(ui: &mut egui::Ui, icon: UiIcon, tooltip: &str) -> egui::Response {
    let (rect, response) = ui.allocate_exact_size(Vec2::splat(26.0), Sense::click());
    let rect = snap_rect(ui, rect);
    let hovered = response.hovered();
    ui.painter().rect_filled(
        rect,
        Rounding::same(8.0),
        if hovered {
            with_alpha(Color32::WHITE, 11)
        } else {
            with_alpha(Color32::WHITE, 5)
        },
    );
    paint_ui_icon(
        ui.painter(),
        rect.shrink(6.0),
        icon,
        if hovered { TEXT } else { TEXT_DIM },
    );
    response.on_hover_text(tooltip)
}

/// Крошечный цветной чип (для «загружен» и подобных пометок).
fn tiny_chip(ui: &mut egui::Ui, text: &str, color: Color32) -> egui::Response {
    let font = FontId::new(10.4, egui::FontFamily::Proportional);
    let width = ui
        .painter()
        .layout_no_wrap(text.to_owned(), font.clone(), color)
        .size()
        .x;
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(width + 16.0, 20.0), Sense::hover());
    ui.painter().rect_filled(
        rect,
        Rounding::same(10.0),
        blend_over(CARD, with_alpha(color, 22)),
    );
    ui.painter().text(rect.center(), Align2::CENTER_CENTER, text, font, color);
    response
}

/// Вторичная кнопка с иконкой слева (например, «Оверлей OBS»).
fn secondary_icon_button(ui: &mut egui::Ui, icon: UiIcon, label: &str) -> egui::Response {
    let font = FontId::new(15.0, egui::FontFamily::Proportional);
    let text_width = ui
        .painter()
        .layout_no_wrap(label.to_owned(), font.clone(), TEXT)
        .size()
        .x;
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(text_width + 52.0, 34.0), Sense::click());
    let rect = snap_rect(ui, rect);
    let hovered = response.hovered();
    ui.painter().rect(
        rect,
        Rounding::same(17.0),
        if hovered { TEXT } else { Color32::TRANSPARENT },
        Stroke::new(2.0_f32, if hovered { TEXT } else { with_alpha(Color32::WHITE, 64) }),
    );
    let color = if hovered { BG } else { TEXT };
    let icon_rect = egui::Rect::from_center_size(
        egui::pos2(rect.left() + 20.0, rect.center().y),
        Vec2::splat(15.0),
    );
    paint_ui_icon(ui.painter(), icon_rect, icon, color);
    ui.painter().text(
        egui::pos2(rect.left() + 32.0, rect.center().y),
        Align2::LEFT_CENTER,
        label,
        font,
        color,
    );
    response
}

/// Чип-фильтр с числом: заменяет стат-карточки и работает как фильтр.
fn filter_chip(
    ui: &mut egui::Ui,
    label: &str,
    count: usize,
    active: bool,
    dot_color: Option<Color32>,
) -> egui::Response {
    let font = FontId::new(13.2, egui::FontFamily::Proportional);
    let text = format!("{label} {count}");
    let text_width = ui
        .painter()
        .layout_no_wrap(text.clone(), font.clone(), TEXT)
        .size()
        .x;
    let dot_space = if dot_color.is_some() { 18.0 } else { 0.0 };
    let width = text_width + dot_space + if active { 34.0 } else { 28.0 };
    let (rect, response) = ui.allocate_exact_size(Vec2::new(width, 30.0), Sense::click());
    let rect = snap_rect(ui, rect);
    let hovered = response.hovered();
    let bg = if active {
        with_alpha(Color32::WHITE, 16)
    } else if hovered {
        with_alpha(Color32::WHITE, 9)
    } else {
        with_alpha(Color32::WHITE, 4)
    };
    // Только заливка: у тонких обводок на 1× заметна «лесенка».
    ui.painter().rect_filled(
        rect,
        Rounding::same(15.0),
        blend_over(BG, bg),
    );
    let mut text_x = rect.left() + if active { 16.0 } else { 14.0 };
    if let Some(color) = dot_color {
        ui.painter()
            .circle_filled(egui::pos2(text_x + 3.0, rect.center().y), 3.0, color);
        text_x += dot_space;
    }
    ui.painter().text(
        egui::pos2(text_x, rect.center().y),
        Align2::LEFT_CENTER,
        text,
        font,
        if active { TEXT } else { TEXT_DIM },
    );
    response
}


/// Смешивает полупрозрачный цвет с фоном и возвращает непрозрачный:
/// так две альфа-заливки (рамка + тело чипа) не складываются в светлое пятно.
fn blend_over(base: Color32, overlay: Color32) -> Color32 {
    let a = overlay.a() as f32 / 255.0;
    let mix = |fg: u8, bg: u8| (fg as f32 * a + bg as f32 * (1.0 - a)).round() as u8;
    Color32::from_rgb(
        mix(overlay.r(), base.r()),
        mix(overlay.g(), base.g()),
        mix(overlay.b(), base.b()),
    )
}

/// Привязка прямоугольника к пиксельной сетке: тонкие контуры без «лесенки».
fn snap_rect(ui: &egui::Ui, rect: egui::Rect) -> egui::Rect {
    let ppp = ui.ctx().pixels_per_point();
    let snap = |value: f32| (value * ppp).round() / ppp;
    egui::Rect::from_min_max(
        egui::pos2(snap(rect.min.x), snap(rect.min.y)),
        egui::pos2(snap(rect.max.x), snap(rect.max.y)),
    )
}

/// Тонкий фейдер в стиле макета: светлая заполненная часть, серая дорожка и
/// круглый ползунок без обводки.
fn fader<N: egui::emath::Numeric>(
    ui: &mut egui::Ui,
    value: &mut N,
    min: N,
    max: N,
    width: f32,
) -> egui::Response {
    let (rect, mut response) =
        ui.allocate_exact_size(Vec2::new(width.max(40.0), 20.0), Sense::click_and_drag());
    let rect = snap_rect(ui, rect);
    let enabled = ui.is_enabled();
    let min_f = min.to_f64();
    let max_f = max.to_f64();
    let span = (max_f - min_f).max(f64::EPSILON);

    if enabled {
        if let Some(pos) = response.interact_pointer_pos() {
            if response.dragged() || response.clicked() {
                let fraction = ((pos.x - rect.left()) / rect.width()).clamp(0.0, 1.0);
                let new_value = min_f + fraction as f64 * span;
                if (new_value - value.to_f64()).abs() > 1e-5 {
                    *value = N::from_f64(new_value);
                    response.mark_changed();
                }
            }
        }
    }

    let fraction = ((value.to_f64() - min_f) / span).clamp(0.0, 1.0) as f32;
    let center_y = rect.center().y;
    let track = egui::Rect::from_center_size(
        egui::pos2(rect.center().x, center_y),
        Vec2::new(rect.width(), 2.0),
    );
    ui.painter().rect_filled(
        track,
        1.5,
        if enabled {
            with_alpha(Color32::WHITE, 22)
        } else {
            with_alpha(Color32::WHITE, 10)
        },
    );
    let knob = egui::pos2(rect.left() + rect.width() * fraction, center_y);
    let fill = egui::Rect::from_min_max(
        track.min,
        egui::pos2(knob.x.max(track.left()), track.max.y),
    );
    ui.painter().rect_filled(
        fill,
        1.5,
        if enabled { TEXT } else { with_alpha(TEXT_DIM, 120) },
    );
    let radius = if response.hovered() || response.dragged() {
        7.5
    } else {
        7.0
    };
    ui.painter().circle_filled(
        knob,
        radius,
        if enabled { Color32::WHITE } else { with_alpha(TEXT_DIM, 160) },
    );

    response
}

/// Кнопка внутри сегментированного переключателя (Плитка / Список).
fn seg_button(ui: &mut egui::Ui, icon: UiIcon, label: &str, active: bool) -> bool {
    let font = FontId::new(13.2, egui::FontFamily::Proportional);
    let text_width = ui
        .painter()
        .layout_no_wrap(label.to_owned(), font.clone(), TEXT)
        .size()
        .x;
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(text_width + 44.0, 28.0), Sense::click());
    let rect = snap_rect(ui, rect);
    let hovered = response.hovered();
    if active {
        ui.painter().rect_filled(rect, Rounding::same(14.0), TEXT);
    } else if hovered {
        ui.painter()
            .rect_filled(rect, Rounding::same(14.0), with_alpha(Color32::WHITE, 10));
    }
    let color = if active {
        BG
    } else if hovered {
        TEXT
    } else {
        TEXT_DIM
    };
    let icon_center = egui::pos2(rect.left() + 16.0, rect.center().y);
    paint_ui_icon(
        ui.painter(),
        egui::Rect::from_center_size(icon_center, Vec2::splat(13.0)),
        icon,
        color,
    );
    ui.painter().text(
        egui::pos2(rect.left() + 27.0, rect.center().y),
        Align2::LEFT_CENTER,
        label,
        font,
        color,
    );
    response.clicked()
}

/// Постоянная плашка ошибки с кнопкой «Повторить».
fn error_banner(ui: &mut egui::Ui, text: &str, retry: &mut bool) {
    egui::Frame::none()
        .fill(with_alpha(DANGER, 22))
        .stroke(Stroke::new(1.0_f32, with_alpha(DANGER, 80)))
        .rounding(Rounding::same(10.0))
        .inner_margin(egui::Margin::symmetric(12.0, 9.0))
        .show(ui, |ui| {
            ui.horizontal(|ui| {
                ui.add(egui::Label::new(RichText::new(text).size(13.6).color(DANGER)).wrap());
                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    if secondary_button(ui, "Повторить").clicked() {
                        *retry = true;
                    }
                });
            });
        });
}

/// Подпись формата/длительности файла на карточке.
fn sound_meta(path: &str, cached: Option<&CachedFile>) -> (String, bool) {
    let format = audio::format_label(Path::new(path));
    match cached {
        Some(file) if file.exists => (
            format!("{format} · {}", file.duration_label()),
            true,
        ),
        Some(_) => ("файл не найден".to_string(), false),
        None => (format, true),
    }
}


/// Цветной чип состояния заявки в очереди.
fn queue_state_chip(ui: &mut egui::Ui, state: ItemState) -> egui::Response {
    let color = match state {
        ItemState::Queued => TEXT_DIM,
        ItemState::Loading => WARN,
        ItemState::Playing => SUCCESS,
        ItemState::Done => SUCCESS,
        ItemState::Failed => DANGER,
        ItemState::Refunded => WARN,
        ItemState::Skipped => TEXT_DIM,
    };
    let (bg, fg) = (blend_over(CARD, with_alpha(color, 24)), color);
    let font = FontId::new(11.2, egui::FontFamily::Proportional);
    let width = ui
        .painter()
        .layout_no_wrap(state.label().to_string(), font.clone(), fg)
        .size()
        .x;
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(width + 18.0, 24.0), Sense::hover());
    ui.painter().rect_filled(rect, Rounding::same(12.0), bg);
    ui.painter().text(
        rect.center(),
        Align2::CENTER_CENTER,
        state.label(),
        font,
        fg,
    );
    response
}

fn duration_label(seconds: u64) -> String {
    format!("{}:{:02}", seconds / 60, seconds % 60)
}

/// Затемняет фон и перехватывает клики, пока открыт модальный диалог.
///
/// Вызывается непосредственно перед окном диалога: слой `Middle` создаётся
/// раньше окна, поэтому окно рисуется поверх затемнения.
fn modal_scrim(ctx: &egui::Context) {
    egui::Area::new(egui::Id::new("modal-scrim"))
        .order(egui::Order::Middle)
        .fixed_pos(egui::Pos2::ZERO)
        .interactable(true)
        .show(ctx, |ui| {
            let screen = ctx.screen_rect();
            let (rect, _) =
                ui.allocate_exact_size(screen.size(), Sense::click_and_drag());
            ui.painter()
                .rect_filled(rect, Rounding::ZERO, Color32::from_black_alpha(160));
        });
}

fn toggle(ui: &mut egui::Ui, value: &mut bool) -> bool {
    let (rect, response) = ui.allocate_exact_size(Vec2::new(44.0, 24.0), Sense::click());
    let enabled = ui.is_enabled();
    let changed = response.clicked() && enabled;
    if changed {
        *value = !*value;
    }
    response.widget_info(|| {
        egui::WidgetInfo::selected(egui::WidgetType::Checkbox, enabled, *value, "")
    });

    let progress = ui.ctx().animate_bool(response.id, *value);
    let (background, knob) = if !enabled {
        (with_alpha(Color32::WHITE, 10), with_alpha(Color32::WHITE, 70))
    } else if *value {
        (ACCENT, BG)
    } else {
        (with_alpha(Color32::WHITE, 24), TEXT)
    };
    ui.painter()
        .rect_filled(rect, Rounding::same(12.0), background);
    let x = rect.left() + 12.0 + progress * (rect.width() - 24.0);
    ui.painter()
        .circle_filled(egui::pos2(x, rect.center().y), 9.0, knob);

    changed
}

fn accent_button(ui: &mut egui::Ui, label: &str) -> egui::Response {
    styled_button(
        ui,
        label,
        TEXT,
        tinted(TEXT, Color32::BLACK, 0.12),
        BG,
        Color32::TRANSPARENT,
    )
}

fn secondary_button(ui: &mut egui::Ui, label: &str) -> egui::Response {
    styled_button(
        ui,
        label,
        Color32::TRANSPARENT,
        with_alpha(Color32::WHITE, 12),
        TEXT,
        with_alpha(Color32::WHITE, 64),
    )
}

/// Уменьшенная основная кнопка (высота 30, как btn-sm в макете).
fn compact_primary_button(ui: &mut egui::Ui, label: &str) -> egui::Response {
    let font = FontId::new(13.0, egui::FontFamily::Proportional);
    let width = ui
        .painter()
        .layout_no_wrap(label.to_owned(), font.clone(), TEXT)
        .size()
        .x;
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(width + 26.0, 30.0), Sense::click());
    let rect = snap_rect(ui, rect);
    let hovered = response.hovered();
    ui.painter().rect_filled(
        rect,
        Rounding::same(15.0),
        if hovered {
            Color32::WHITE
        } else {
            Color32::from_rgb(0xED, 0xED, 0xED)
        },
    );
    ui.painter().text(
        rect.center(),
        Align2::CENTER_CENTER,
        label,
        font,
        BG,
    );
    response
}

/// Уменьшенная вторичная кнопка для нижних карточек (высота 30).
fn compact_secondary_button(ui: &mut egui::Ui, label: &str) -> egui::Response {
    let font = FontId::new(13.0, egui::FontFamily::Proportional);
    let width = ui
        .painter()
        .layout_no_wrap(label.to_owned(), font.clone(), TEXT)
        .size()
        .x;
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(width + 26.0, 30.0), Sense::click());
    let rect = snap_rect(ui, rect);
    let hovered = response.hovered();
    ui.painter().rect(
        rect,
        Rounding::same(15.0),
        if hovered { TEXT } else { Color32::TRANSPARENT },
        Stroke::new(
            2.0_f32,
            if hovered {
                TEXT
            } else {
                with_alpha(Color32::WHITE, 64)
            },
        ),
    );
    ui.painter().text(
        rect.center(),
        Align2::CENTER_CENTER,
        label,
        font,
        if hovered { BG } else { TEXT },
    );
    response
}

fn danger_button(ui: &mut egui::Ui, label: &str) -> egui::Response {

    styled_button(
        ui,
        label,
        Color32::TRANSPARENT,
        with_alpha(DANGER, 32),
        DANGER,
        Color32::TRANSPARENT,
    )
}

// ---------- демо-данные для скриншотов ----------

/// Создаёт короткие WAV-файлы для демонстрационного режима.
fn ensure_demo_sounds(dir: &Path) -> Vec<PathBuf> {
    let _ = std::fs::create_dir_all(dir);
    let specs = [
        ("newbie.wav", 2.0_f32, 659.25_f32),
        ("like.wav", 3.0, 523.25),
        ("shiza.wav", 1.4, 392.0),
        ("run.wav", 2.6, 440.0),
        ("shot.wav", 0.8, 196.0),
    ];
    let mut created = Vec::new();
    for (name, seconds, freq) in specs {
        let path = dir.join(name);
        if !path.is_file() {
            let _ = write_demo_wav(&path, seconds, freq);
        }
        created.push(path);
    }
    created
}

/// Простейший PCM WAV: 22050 Гц, моно, 16 бит, плавное затухание.
fn write_demo_wav(path: &Path, seconds: f32, freq: f32) -> Option<()> {
    let sample_rate = 22050u32;
    let samples = (seconds * sample_rate as f32).round() as u32;
    let data_len = samples * 2;
    let mut bytes = Vec::with_capacity(44 + data_len as usize);
    bytes.extend_from_slice(b"RIFF");
    bytes.extend_from_slice(&(36 + data_len).to_le_bytes());
    bytes.extend_from_slice(b"WAVEfmt ");
    bytes.extend_from_slice(&16u32.to_le_bytes());
    bytes.extend_from_slice(&1u16.to_le_bytes()); // PCM
    bytes.extend_from_slice(&1u16.to_le_bytes()); // моно
    bytes.extend_from_slice(&sample_rate.to_le_bytes());
    bytes.extend_from_slice(&(sample_rate * 2).to_le_bytes());
    bytes.extend_from_slice(&2u16.to_le_bytes());
    bytes.extend_from_slice(&16u16.to_le_bytes());
    bytes.extend_from_slice(b"data");
    bytes.extend_from_slice(&data_len.to_le_bytes());
    for index in 0..samples {
        let t = index as f32 / sample_rate as f32;
        let envelope = (1.0 - index as f32 / samples as f32).min(1.0);
        let value = (t * freq * std::f32::consts::TAU).sin() * envelope * 0.25;
        bytes.extend_from_slice(&((value * i16::MAX as f32) as i16).to_le_bytes());
    }
    std::fs::write(path, bytes).ok()?;
    Some(())
}

