# -*- coding: utf-8 -*-
"""Подключает реальный MusicService к Tauri-ядру и командам."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\core.rs")
s = P.read_text(encoding="utf-8")


def sub(old, new):
    global s
    assert old in s, "NOT FOUND: " + old[:120]
    s = s.replace(old, new, 1)


sub("use reward_sounds::config::{AppPaths, Settings};",
    "use reward_sounds::config::{AppPaths, Settings};\nuse reward_sounds::music::{self, ItemState};")

# --- DTO музыки ---
sub("""/// Полный снимок состояния для вкладки «Награды» и шапки.
#[derive(Serialize)]
pub struct CoreView {""",
"""/// Одна заявка в очереди музыки.
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
    pub max_queue: usize,
}

/// Полный снимок состояния для вкладки «Награды» и шапки.
#[derive(Serialize)]
pub struct CoreView {""")

sub("""    pub music_enabled: bool,
    pub music_reward_title: String,
    pub music_reward_cost: u32,
}""",
"""    pub music_enabled: bool,
    pub music_reward_title: String,
    pub music_reward_cost: u32,
    pub music: MusicView,
}""")

# --- Inner + конструктор ---
sub("""struct Inner {
    settings: Settings,
    twitch: twitch::Service,
    audio: audio::AudioEngine,""",
"""struct Inner {
    settings: Settings,
    twitch: twitch::Service,
    audio: audio::AudioEngine,
    music: music::MusicService,""")

sub("""        let files = build_file_cache(&settings);
        let inner = Inner {
            settings,
            twitch: twitch::Service::spawn(),
            audio: audio::AudioEngine::spawn(),""",
"""        let files = build_file_cache(&settings);
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
        let inner = Inner {
            settings,
            twitch: twitch::Service::spawn(),
            audio: audio::AudioEngine::spawn(),
            music: music_service,""")

# --- view: добавить музыку ---
sub("""            music_enabled: settings.music.enabled,
            music_reward_title: settings.music.reward_title.clone(),
            music_reward_cost: settings.music.reward_cost,
        }
    }
}""",
"""            music_enabled: settings.music.enabled,
            music_reward_title: settings.music.reward_title.clone(),
            music_reward_cost: settings.music.reward_cost,
            music: music_view(&inner.music.snapshot(), settings),
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
        max_queue: settings.music.max_queue,
    }
}""")

# --- команды музыки ---
sub("""#[tauri::command]
pub fn stop_all_sounds(core: State<'_, Arc<AppCore>>) -> Result<(), String> {
    let inner = core.lock();
    inner.audio.stop_all()?;
    Ok(())
}""",
"""#[tauri::command]
pub fn stop_all_sounds(core: State<'_, Arc<AppCore>>) -> Result<(), String> {
    let inner = core.lock();
    inner.audio.stop_all()?;
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
}""")

P.write_text(s, encoding="utf-8")
print("music backend wired")
