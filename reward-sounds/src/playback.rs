//! Проигрывание звуков наград в фоновом потоке EventSub.
//!
//! Раньше звук запускался из потока интерфейса: если окно было скрыто и
//! перерисовка останавливалась, активации «ждали» открытия окна. Теперь
//! воспроизведением занимается сам сервис EventSub — оно не зависит от UI.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use crate::audio::{self, AudioEngine};
use crate::config::{ImageRewardSettings, Settings};
use crate::eventsub::Redemption;

/// Актуальные настройки проигрывания, общие для UI и сервиса EventSub.
#[derive(Debug, Clone)]
pub struct PlaybackState {
    bindings: HashMap<String, (String, f32)>,
    image_rewards: HashMap<String, ImageRewardSettings>,
    image_modes: HashMap<String, String>,
    volume: f32,
    enabled: bool,
}

impl Default for PlaybackState {
    fn default() -> Self {
        Self {
            bindings: HashMap::new(),
            image_rewards: HashMap::new(),
            image_modes: HashMap::new(),
            volume: 0.8,
            enabled: true,
        }
    }
}

impl PlaybackState {
    /// Обновляет состояние из настроек приложения.
    pub fn sync(&mut self, settings: &Settings) {
        self.bindings = settings
            .twitch_rewards
            .iter()
            .filter(|reward| !reward.reward_id.is_empty() && !reward.path.is_empty())
            .map(|reward| {
                (
                    reward.reward_id.clone(),
                    (reward.path.clone(), reward.volume as f32),
                )
            })
            .collect();
        self.image_rewards = settings
            .music
            .image_rewards
            .iter()
            .filter(|reward| !reward.reward_id.is_empty() && !reward.images.is_empty())
            .map(|reward| (reward.reward_id.clone(), reward.clone()))
            .collect();
        self.image_modes = settings
            .music
            .image_rewards
            .iter()
            .map(|reward| (reward.reward_id.clone(), reward.mode.clone()))
            .collect();
        self.volume = settings.effective_volume();
        self.enabled = settings.playback_enabled;
    }

    /// Путь к звуку для награды, если он привязан.
    pub fn path_for(&self, reward_id: &str) -> Option<&str> {
        self.bindings.get(reward_id).map(|(path, _)| path.as_str())
    }

    /// Индивидуальная громкость звука награды (1.0 — как в файле).
    pub fn sound_volume_for(&self, reward_id: &str) -> Option<f32> {
        self.bindings
            .get(reward_id)
            .map(|(_, volume)| *volume)
    }

    pub fn volume(&self) -> f32 {
        self.volume
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }
}

/// Проигрыватель, который можно передать в поток EventSub.
#[derive(Clone)]
pub struct Playback {
    engine: AudioEngine,
    state: Arc<Mutex<PlaybackState>>,
}

impl Playback {
    pub fn new(engine: AudioEngine, state: Arc<Mutex<PlaybackState>>) -> Self {
        Self { engine, state }
    }

    /// Играет звук награды (или пишет понятную причину, почему нет).
    pub fn play(&self, redemption: &Redemption) {
        let (binding, image, mode, volume, enabled) = {
            let Ok(state) = self.state.lock() else {
                log::error!("Не удалось получить настройки проигрывания");
                return;
            };
            (
                state
                    .bindings
                    .get(&redemption.reward_id)
                    .map(|(path, volume)| (path.clone(), *volume)),
                state.image_rewards.get(&redemption.reward_id).cloned(),
                state
                    .image_modes
                    .get(&redemption.reward_id)
                    .cloned()
                    .unwrap_or_else(|| "both".to_string()),
                state.volume(),
                state.is_enabled(),
            )
        };

        // Картинка — отдельная часть награды: показываем даже при выключенных звуках.
        if mode != "sound" {
            if let Some(image) = image.as_ref() {
                if crate::image_reward::show(image) {
                    log::info!(
                        "Картинка награды «{}» показана в OBS",
                        redemption.reward_title
                    );
                }
            }
        }

        if mode == "image" {
            log::info!(
                "Награда «{}»: режим только картинки — звук пропущен",
                redemption.reward_title
            );
            return;
        }

        if !enabled {
            log::info!(
                "Звуки выключены — активация «{}» пропущена",
                redemption.reward_title
            );
            return;
        }

        let Some((path, sound_volume)) = binding else {
            log::info!(
                "У награды {} нет звука — пропускаем",
                redemption.reward_id
            );
            return;
        };

        let path = PathBuf::from(&path);
        if !path.is_file() {
            log::error!(
                "Награда «{}»: файл не найден ({})",
                redemption.reward_title,
                path.display()
            );
            return;
        }
        if !audio::is_supported_file(&path) {
            log::error!(
                "Награда «{}»: {}",
                redemption.reward_title,
                audio::unsupported_format_message(&path)
            );
            return;
        }

        let volume = (volume * sound_volume).clamp(0.0, 2.0);
        match self.engine.play(&redemption.reward_id, path, volume) {
            Ok(()) => log::info!(
                "Играет звук награды «{}» (громкость {:.0}%)",
                redemption.reward_title,
                volume * 100.0
            ),
            Err(err) => log::error!("Не удалось включить звук награды: {err}"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::RewardSound;
    use std::time::{Duration, Instant};

    fn settings_with(reward_id: &str, path: &str) -> Settings {
        let mut settings = Settings::default();
        settings.set_reward_sound(reward_id, "Тест", path);
        settings
    }

    #[test]
    fn sync_collects_bindings_and_volume() {
        let mut settings = settings_with("a1", r"C:\Sounds\a.mp3");
        settings.volume = 0.5;
        settings.muted = true;

        let mut state = PlaybackState::default();
        state.sync(&settings);
        assert_eq!(state.path_for("a1"), Some(r"C:\Sounds\a.mp3"));
        assert!(!state.is_enabled() || settings.playback_enabled);
        assert_eq!(state.volume(), 0.0);
    }

    #[test]
    fn ignores_empty_bindings() {
        let mut settings = Settings::default();
        settings.twitch_rewards.push(RewardSound {
            reward_id: String::new(),
            title: "Пустая".to_string(),
            path: r"C:\Sounds\a.mp3".to_string(),
            volume: 1.0,
        });
        let mut state = PlaybackState::default();
        state.sync(&settings);
        assert!(state.path_for("").is_none());
    }

    #[test]
    fn disabled_playback_is_visible_to_worker() {
        let mut settings = settings_with("a1", r"C:\Sounds\a.mp3");
        settings.playback_enabled = false;
        let mut state = PlaybackState::default();
        state.sync(&settings);
        assert!(!state.is_enabled());
    }

    /// Пишет короткий WAV, чтобы проверить реальный аудиопоток.
    fn write_wav(path: &std::path::Path) {
        let sample_rate: u32 = 44_100;
        let samples = (sample_rate as f32 * 0.25) as u32;
        let data_len = samples * 2;
        let mut data = Vec::with_capacity(44 + data_len as usize);
        data.extend_from_slice(b"RIFF");
        data.extend_from_slice(&(36 + data_len).to_le_bytes());
        data.extend_from_slice(b"WAVEfmt ");
        data.extend_from_slice(&16u32.to_le_bytes());
        data.extend_from_slice(&1u16.to_le_bytes());
        data.extend_from_slice(&1u16.to_le_bytes());
        data.extend_from_slice(&sample_rate.to_le_bytes());
        data.extend_from_slice(&(sample_rate * 2).to_le_bytes());
        data.extend_from_slice(&2u16.to_le_bytes());
        data.extend_from_slice(&16u16.to_le_bytes());
        data.extend_from_slice(b"data");
        data.extend_from_slice(&data_len.to_le_bytes());
        for i in 0..samples {
            let t = i as f32 / sample_rate as f32;
            let value = (t * 440.0 * std::f32::consts::TAU).sin() * 0.2;
            data.extend_from_slice(&((value * i16::MAX as f32) as i16).to_le_bytes());
        }
        std::fs::write(path, data).expect("не удалось записать тестовый WAV");
    }

    #[test]
    fn play_applies_master_and_sound_volume() {
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join("audio-test")
            .join("playback-volume");
        std::fs::create_dir_all(&dir).unwrap();
        let wav = dir.join("tone.wav");
        write_wav(&wav);

        let mut settings = Settings::default();
        settings.volume = 0.8;
        settings.set_reward_sound("volume-test", "Громкость", wav.to_str().unwrap());
        settings.set_sound_volume("volume-test", 0.5);

        let mut state = PlaybackState::default();
        state.sync(&settings);
        assert_eq!(state.sound_volume_for("volume-test"), Some(0.5));

        let engine = AudioEngine::spawn();
        let started = Instant::now();
        while engine.snapshot().device.is_none()
            && started.elapsed() < Duration::from_secs(6)
        {
            if !engine.take_errors().is_empty() {
                // В системе нет устройства вывода — проверять нечего.
                let _ = std::fs::remove_dir_all(&dir);
                return;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        if engine.snapshot().device.is_none() {
            let _ = std::fs::remove_dir_all(&dir);
            return;
        }

        let playback = Playback::new(engine, Arc::new(Mutex::new(state)));
        audio::capture::reset();
        playback.play(&Redemption {
            redemption_id: "r-1".to_string(),
            reward_id: "volume-test".to_string(),
            reward_title: "Громкость".to_string(),
            user_login: "tester".to_string(),
            user_input: String::new(),
            redeemed_at: String::new(),
        });

        let volume = audio::capture::wait_for("volume-test", Duration::from_secs(3))
            .expect("звук не дошёл до аудиопотока");
        assert!(
            (volume - 0.4).abs() < 1e-4,
            "ожидалось 0.8 × 0.5 = 0.4, получено {volume}"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }
}
