# -*- coding: utf-8 -*-
"""EventSub и воспроизведение звуков наград в Tauri-ядре."""
import pathlib

# 1) headless-запуск EventSub без окна egui
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\eventsub.rs")
s = p.read_text(encoding="utf-8")
anchor = """impl Service {
    pub fn spawn(playback: Playback, ctx: eframe::egui::Context) -> Self {"""
assert anchor in s
s = s.replace(anchor, """impl Service {
    /// Запускает сервис без окна egui — для Tauri/фонового режима.
    /// Контекст нужен только для `request_repaint`, здесь он пустой.
    pub fn spawn_headless(playback: Playback) -> Self {
        Self::spawn(playback, eframe::egui::Context::default())
    }

    pub fn spawn(playback: Playback, ctx: eframe::egui::Context) -> Self {""")
p.write_text(s, encoding="utf-8")

# 2) Tauri core
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\core.rs")
s = p.read_text(encoding="utf-8")


def sub(old, new):
    global s
    assert old in s, "NOT FOUND: " + old[:120]
    s = s.replace(old, new, 1)


sub("""use std::time::{Duration, Instant};

use reward_sounds::audio;""",
"""use std::thread;
use std::time::{Duration, Instant};

use reward_sounds::audio;
use reward_sounds::eventsub;
use reward_sounds::playback::{Playback, PlaybackState};""")

sub("""    pub music: MusicView,
    pub client_id: String,""",
"""    pub music: MusicView,
    pub eventsub: String,
    pub eventsub_error: Option<String>,
    pub client_id: String,""")

sub("""    audio: audio::AudioEngine,
    music: music::MusicService,""",
"""    audio: audio::AudioEngine,
    music: music::MusicService,
    eventsub: eventsub::Service,
    playback_state: Arc<Mutex<PlaybackState>>,
    eventsub_state: String,
    eventsub_error: Option<String>,""")

sub("""        let music_temp = paths.data_dir.join("tmp");
        let music_service = music::MusicService::spawn(
            music_config,
            settings.music.ytdlp_path.clone(),
            music_temp,
        );
        let inner = Inner {
            settings,
            twitch: twitch::Service::spawn(),
            audio: audio::AudioEngine::spawn(),
            music: music_service,""",
"""        let music_temp = paths.data_dir.join("tmp");
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
            eventsub_error: None,""")

sub("""        core.bootstrap();
        core
    }""",
"""        core.bootstrap();
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
    }""")

# save синхронизирует playback state
sub("""        if let Err(err) = inner.settings.save(&self.paths.config_file) {
            log::warn!("Не удалось сохранить настройки: {err}");
        }
    }""",
"""        if let Err(err) = inner.settings.save(&self.paths.config_file) {
            log::warn!("Не удалось сохранить настройки: {err}");
        }
        if let Ok(mut state) = self.playback_state.lock() {
            state.sync(&inner.settings);
        }
    }""")

# drain_events: все источники, без раннего return
sub("""    fn drain_events(&self) {
        let events = {
            let inner = self.lock();
            inner.twitch.poll()
        };
        if events.is_empty() {
            return;
        }
        log::info!("Tauri core: событий Twitch — {}", events.len());
        for event in events {
            self.handle_event(event);
        }
    }""",
"""    fn drain_events(&self) {
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
    }""")

# view: поля EventSub
sub("""            music: music_view(&inner.music.snapshot(), settings),
            client_id: settings.twitch.client_id.clone(),""",
"""            music: music_view(&inner.music.snapshot(), settings),
            eventsub: inner.eventsub_state.clone(),
            eventsub_error: inner.eventsub_error.clone(),
            client_id: settings.twitch.client_id.clone(),""")

# после успешной авторизации/refresh — запускаем EventSub
sub("""                self.save();
                {
                    let mut inner = self.lock();
                    self.fetch_rewards(&mut inner);
                }
            }
            twitch::Event::RewardsLoaded""",
"""                self.save();
                self.start_eventsub();
                {
                    let mut inner = self.lock();
                    self.fetch_rewards(&mut inner);
                }
            }
            twitch::Event::RewardsLoaded""")

# disconnect — остановить EventSub
sub("""        inner.settings.twitch.clear_session();
        inner.rewards.clear();
        inner.loading = false;
        inner.error = None;
        inner.auth = AuthView {""",
"""        inner.settings.twitch.clear_session();
        inner.rewards.clear();
        inner.loading = false;
        inner.error = None;
        inner.eventsub.stop();
        inner.eventsub_state = "stopped".to_string();
        inner.eventsub_error = None;
        inner.auth = AuthView {""")

p.write_text(s, encoding="utf-8")
print("eventsub integrated")
