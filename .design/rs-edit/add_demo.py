# -*- coding: utf-8 -*-
"""Демо-режим для скриншотов и визуальной проверки без Twitch."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
src = P.read_text(encoding="utf-8")


def sub_once(old: str, new: str) -> None:
    global src
    assert old in src, "NOT FOUND: " + old[:90]
    src = src.replace(old, new, 1)


# Поле demo.
sub_once(
    """    /// Поле ручной ссылки на вкладке «Музыка».
    music_manual_input: String,
}""",
    """    /// Поле ручной ссылки на вкладке «Музыка».
    music_manual_input: String,
    /// Демо-режим для скриншотов: подставляет примеры вместо живого Twitch.
    demo: bool,
}""",
)
sub_once(
    """            music_manual_input: String::new(),
        };""",
    """            music_manual_input: String::new(),
            demo: std::env::var_os("REWARD_SOUNDS_DEMO").is_some(),
        };""",
)

# Пропускаем сетевые/фоновые обновления в демо-режиме.
sub_once(
    """    fn poll_music(&mut self) {
        if Instant::now() < self.music_poll_at {
""",
    """    fn poll_music(&mut self) {
        if self.demo {
            return;
        }
        if Instant::now() < self.music_poll_at {
""",
)
sub_once(
    """    fn poll_twitch(&mut self) {
        for event in self.twitch_service.poll() {
""",
    """    fn poll_twitch(&mut self) {
        if self.demo {
            return;
        }
        for event in self.twitch_service.poll() {
""",
)
sub_once(
    """    fn poll_eventsub(&mut self) {
""",
    """    fn poll_eventsub(&mut self) {
        if self.demo {
            return;
        }
""",
)
sub_once(
    """        if let Some(warning) = warning {
            app.notify(warning, ToastKind::Warning);
        }
        app.restore_twitch_session();
""",
    """        if let Some(warning) = warning {
            app.notify(warning, ToastKind::Warning);
        }
        if app.demo {
            app.apply_demo();
        } else {
            app.restore_twitch_session();
        }
""",
)

# Метод apply_demo + генератор демо-звуков.
DEMO = r'''
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
        };
        log::info!("Включён демо-режим: данные для скриншотов");
    }
'''

anchor = "    fn notify(&mut self, text: impl Into<String>, kind: ToastKind) {"
assert anchor in src
src = src.replace(anchor, DEMO + "\n" + anchor, 1)

# Генератор демо-WAV в конец файла.
TAIL = r'''

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
'''
src = src.rstrip() + TAIL + "\n"
P.write_text(src, encoding="utf-8")
print("demo mode added, length", len(src))
