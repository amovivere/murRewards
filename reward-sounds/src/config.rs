//! Настройки приложения и стандартные пути Windows.
//!
//! Все данные лежат в `%APPDATA%\RewardSounds`:
//! * `config.toml` — настройки;
//! * `logs\reward-sounds.log` — журнал событий.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

/// Версия формата настроек. Нужна для будущих обновлений без потери данных.
pub const CONFIG_VERSION: u32 = 3;

/// Привязка звука к награде Twitch.
///
/// Ключ — именно `reward_id` (ID награды), а не название: названия
/// можно менять в Twitch в любой момент.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RewardSound {
    pub reward_id: String,
    /// Название награды на момент привязки (для показа, если награда пропала).
    pub title: String,
    pub path: String,
    /// Индивидуальная громкость звука: 0.0–2.0 (1.0 — как в файле).
    #[serde(default = "default_sound_volume")]
    pub volume: f64,
}

fn default_sound_volume() -> f64 {
    1.0
}

impl RewardSound {
    pub fn has_sound(&self) -> bool {
        !self.path.trim().is_empty()
    }

    /// Итоговая громкость звука с учётом индивидуальной настройки.
    pub fn effective_volume(&self, master: f32) -> f32 {
        (master * self.volume as f32).clamp(0.0, 2.0)
    }
}

fn default_version() -> u32 {
    CONFIG_VERSION
}

/// Настройки вкладки «Музыка»: треки по заявке из YouTube.
///
/// Аудио не сохраняется на диск: заявка скачивается в память и играет
/// через общий аудиодвижок приложения.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct MusicSettings {
    /// Вкладка включена: заявки принимаются и играют.
    pub enabled: bool,
    /// ID награды Twitch, из которой приходят заявки.
    pub reward_id: String,
    /// Название награды для интерфейса.
    pub reward_title: String,
    /// Стоимость награды в баллах (меняется прямо на вкладке).
    pub reward_cost: u32,
    /// Максимум заявок в очереди.
    pub max_queue: usize,
    /// Максимальная длительность трека в секундах.
    pub max_duration_sec: u64,
    /// Путь к `yt-dlp.exe` (`auto` — искать рядом с программой).
    pub ytdlp_path: String,
    /// Обновлять `yt-dlp` раз в N дней (0 — не обновлять).
    pub ytdlp_update_days: u64,
    /// Файл cookies.txt для YouTube (нужен для видео с возрастным ограничением).
    pub cookies_file: String,
    /// Подгружать следующий трек заранее, пока играет текущий.
    pub prefetch: bool,
    /// Громкость музыки: 0.0–1.0, отдельно от звуков наград.
    pub music_volume: f64,
    /// Восстанавливать очередь после перезапуска.
    pub restore_queue: bool,
    /// Пауза Яндекс Музыки на время заявок и возврат после.
    pub pause_yandex: bool,
    /// Кулдаун между заявками одного зрителя, секунды (0 — без кулдауна).
    pub request_cooldown_sec: u64,
    /// ID видео YouTube, которые нельзя заказывать.
    pub blocked_videos: Vec<String>,
    /// Включать резервный плейлист, когда очередь пуста.
    pub autodj: bool,
    /// Ссылки YouTube для AutoDJ.
    pub autodj_playlist: Vec<String>,
    /// Сколько секунд показывать строку «Сейчас играет» в оверлее.
    pub overlay_seconds: u64,
    /// Где показывать строку: `top` или `bottom`.
    pub overlay_position: String,
    /// Размер шрифта строки в пикселях.
    pub overlay_font: u32,
}

impl Default for MusicSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            reward_id: String::new(),
            reward_title: "Трек по заявке".to_string(),
            reward_cost: 500,
            max_queue: 10,
            max_duration_sec: 480,
            ytdlp_path: "auto".to_string(),
            ytdlp_update_days: 7,
            cookies_file: String::new(),
            prefetch: true,
            music_volume: 0.7,
            restore_queue: true,
            pause_yandex: true,
            request_cooldown_sec: 0,
            blocked_videos: Vec::new(),
            autodj: false,
            autodj_playlist: Vec::new(),
            overlay_seconds: 10,
            overlay_position: "top".to_string(),
            overlay_font: 17,
        }
    }
}

impl MusicSettings {
    /// Громкость музыки в виде, который понимает аудиодвижок.
    pub fn volume_f32(&self) -> f32 {
        self.music_volume.clamp(0.0, 1.0) as f32
    }

    /// Привязана ли награда к вкладке.
    pub fn has_reward(&self) -> bool {
        !self.reward_id.trim().is_empty()
    }
}

fn default_volume() -> f64 {
    0.8
}

/// Акцентный цвет интерфейса по умолчанию (фирменный фиолетовый).
fn default_accent() -> String {
    "#8B00FF".to_string()
}

/// Данные подключения к Twitch.
///
/// `client_id` — публичный идентификатор приложения Twitch, его не нужно
/// скрывать. Токены хранятся только в зашифрованном виде (Windows DPAPI),
/// Client Secret приложению не нужен и не хранится.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct TwitchSettings {
    pub client_id: String,
    /// Зашифрованный access token (hex).
    pub access_token_enc: String,
    /// Зашифрованный refresh token (hex).
    pub refresh_token_enc: String,
    /// Время истечения access token (Unix-время, секунды).
    pub expires_at: i64,
    pub user_id: String,
    pub login: String,
    pub display_name: String,
}

impl TwitchSettings {
    pub fn has_client_id(&self) -> bool {
        !self.client_id.trim().is_empty()
    }

    /// Похоже ли на Client ID Twitch (30 букв/цифр).
    pub fn client_id_looks_valid(&self) -> bool {
        let id = self.client_id.trim();
        id.len() >= 20 && id.chars().all(|c| c.is_ascii_alphanumeric())
    }

    /// Есть ли сохранённая сессия (токены).
    pub fn has_session(&self) -> bool {
        !self.refresh_token_enc.trim().is_empty() || !self.access_token_enc.trim().is_empty()
    }

    pub fn access_token(&self) -> Option<String> {
        crate::secure_store::unprotect(&self.access_token_enc).ok()
    }

    pub fn refresh_token(&self) -> Option<String> {
        crate::secure_store::unprotect(&self.refresh_token_enc).ok()
    }

    /// Сохраняет токены в зашифрованном виде.
    pub fn store_tokens(
        &mut self,
        access: &str,
        refresh: &str,
        expires_at: i64,
    ) -> Result<(), String> {
        self.access_token_enc = crate::secure_store::protect(access)?;
        self.refresh_token_enc = crate::secure_store::protect(refresh)?;
        self.expires_at = expires_at;
        Ok(())
    }

    /// Убирает токены и данные аккаунта, сохраняя Client ID.
    pub fn clear_session(&mut self) {
        self.access_token_enc.clear();
        self.refresh_token_enc.clear();
        self.expires_at = 0;
        self.user_id.clear();
        self.login.clear();
        self.display_name.clear();
    }

    /// Имя для интерфейса: отображаемое имя, иначе логин.
    pub fn account_label(&self) -> String {
        if !self.display_name.trim().is_empty() {
            self.display_name.clone()
        } else if !self.login.trim().is_empty() {
            self.login.clone()
        } else {
            "аккаунт Twitch".to_string()
        }
    }

    pub fn is_connected(&self) -> bool {
        !self.login.trim().is_empty() && self.has_session()
    }
}

/// Полный набор сохраняемых настроек.

/// Полный набор сохраняемых настроек.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    pub version: u32,
    /// Громкость приложения: 0.0 – 1.0 (системную громкость Windows не меняет).
    /// f64 выбран намеренно: в файле настроек получается аккуратное «0.8».
    pub volume: f64,
    /// Режим «Без звука».
    pub muted: bool,
    /// Закрывать окно в системный трей вместо выхода.
    pub close_to_tray: bool,
    /// Запускать приложение сразу свёрнутым в трей.
    pub start_minimized: bool,
    /// Автозапуск вместе с Windows.
    pub autostart: bool,
    /// Воспроизведение звуков наград включено.
    pub playback_enabled: bool,
    /// Показывать награды плиткой (3 в ряд) вместо списка.
    pub grid_view: bool,
    /// Акцентный цвет интерфейса в формате #RRGGBB.
    #[serde(default = "default_accent")]
    pub accent: String,


    /// Подключение к Twitch.
    pub twitch: TwitchSettings,
    /// Привязки звуков к наградам Twitch (по reward_id).
    pub twitch_rewards: Vec<RewardSound>,
    /// Треки по заявке (вкладка «Музыка»).
    pub music: MusicSettings,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            version: default_version(),
            volume: default_volume(),
            muted: false,
            close_to_tray: true,
            start_minimized: false,
            autostart: false,
            playback_enabled: true,
            grid_view: false,
            accent: default_accent(),

            twitch: TwitchSettings::default(),
            twitch_rewards: Vec::new(),
            music: MusicSettings::default(),
        }
    }
}

impl Settings {
    /// Громкость, которая реально уходит в аудиодвижок.
    pub fn effective_volume(&self) -> f32 {
        if self.muted {
            0.0
        } else {
            self.volume_f32()
        }
    }

    /// Громкость, которая реально уходит в аудиодвижок для звука награды:
    /// общая громкость приложения × ползунок на карточке.
    pub fn effective_sound_volume(&self, reward_id: &str) -> f32 {
        let master = self.effective_volume();
        match self.reward_sound(reward_id) {
            Some(reward) => reward.effective_volume(master),
            None => master,
        }
    }

    /// Громкость как f32 (для ползунка и подписи).
    pub fn volume_f32(&self) -> f32 {
        self.volume.clamp(0.0, 1.0) as f32
    }

    /// Подпись громкости: «80%».
    pub fn volume_label(&self) -> String {
        crate::util::format_volume(self.volume_f32())
    }

    /// Привязка звука к награде по её ID.
    pub fn reward_sound(&self, reward_id: &str) -> Option<&RewardSound> {
        self.twitch_rewards
            .iter()
            .find(|reward| reward.reward_id == reward_id)
    }

    /// Привязывает файл к награде (заменяет прежнюю привязку).
    pub fn set_reward_sound(&mut self, reward_id: &str, title: &str, path: &str) {
        match self
            .twitch_rewards
            .iter_mut()
            .find(|reward| reward.reward_id == reward_id)
        {
            Some(reward) => {
                reward.title = title.to_string();
                reward.path = path.to_string();
            }
            None => self.twitch_rewards.push(RewardSound {
                reward_id: reward_id.to_string(),
                title: title.to_string(),
                path: path.to_string(),
                volume: 1.0,
            }),
        }
    }

    /// Меняет индивидуальную громкость звука у награды.
    pub fn set_sound_volume(&mut self, reward_id: &str, volume: f64) -> bool {
        match self
            .twitch_rewards
            .iter_mut()
            .find(|reward| reward.reward_id == reward_id)
        {
            Some(reward) => {
                reward.volume = volume.clamp(0.0, 2.0);
                true
            }
            None => false,
        }
    }

    /// Убирает привязку звука у награды. Возвращает true, если что-то удалили.
    pub fn clear_reward_sound(&mut self, reward_id: &str) -> bool {
        let before = self.twitch_rewards.len();
        self.twitch_rewards
            .retain(|reward| reward.reward_id != reward_id);
        self.twitch_rewards.len() != before
    }

    /// Приводит значения к допустимым (защита от испорченного файла).
    fn normalize(&mut self) {
        self.volume = self.volume.clamp(0.0, 1.0);
        self.twitch.client_id = self.twitch.client_id.trim().to_string();
        self.twitch_rewards.retain(|r| {
            !r.reward_id.trim().is_empty() && !r.path.trim().is_empty()
        });
        for reward in &mut self.twitch_rewards {
            reward.reward_id = reward.reward_id.trim().to_string();
            reward.title = reward.title.trim().to_string();
            reward.path = reward.path.trim().to_string();
            reward.path = reward.path.trim().to_string();
            reward.volume = reward.volume.clamp(0.0, 2.0);
        }

        self.music.music_volume = self.music.music_volume.clamp(0.0, 1.0);
        self.music.max_queue = self.music.max_queue.clamp(1, 50);
        self.music.max_duration_sec = self.music.max_duration_sec.clamp(30, 7200);
        self.music.reward_cost = self.music.reward_cost.clamp(1, 1_000_000);
        self.music.reward_id = self.music.reward_id.trim().to_string();
        self.music.reward_title = self.music.reward_title.trim().to_string();
        if self.music.reward_title.is_empty() {
            self.music.reward_title = "Трек по заявке".to_string();
        }
        self.music.ytdlp_path = self.music.ytdlp_path.trim().to_string();
        if self.music.ytdlp_path.is_empty() {
            self.music.ytdlp_path = "auto".to_string();
        }
        self.music.cookies_file = self.music.cookies_file.trim().to_string();
    }

    /// Загружает настройки. Если файла нет — настройки по умолчанию.
    /// Если файл повреждён — он переименовывается, чтобы не потерять данные,
    /// и приложение стартует с настройками по умолчанию.
    pub fn load(path: &Path) -> (Self, Option<String>) {
        if !path.is_file() {
            return (Self::default(), None);
        }

        let text = match std::fs::read_to_string(path) {
            Ok(text) => text,
            Err(err) => {
                log::error!("Не удалось прочитать файл настроек: {err}");
                return (
                    Self::default(),
                    Some(format!("Не удалось прочитать настройки: {err}")),
                );
            }
        };

        match toml::from_str::<Settings>(&text) {
            Ok(mut settings) => {
                // Старый формат (из предыдущей версии приложения) хранил список
                // наград: [[rewards]] с полями name / sound / reward_id.
                // Импортируем пути как звуки, но только если новый список пуст,
                // и обязательно сохраняем копию старого файла.
                if settings.twitch_rewards.is_empty() {
                    let legacy = import_legacy_rewards(&text);
                    if !legacy.is_empty() {
                        let backup = path.with_file_name(format!(
                            "config.legacy-{}.toml",
                            crate::logging::now_compact()
                        ));
                        match std::fs::copy(path, &backup) {
                            Ok(_) => {
                                let count = legacy.len();
                                log::info!(
                                    "Настройки предыдущей версии: импортировано {count} {}. Копия старого файла: {}",
                                    crate::util::plural_ru(count, "привязка", "привязки", "привязок"),
                                    backup.display()
                                );
                                settings.twitch_rewards = legacy;
                                settings.normalize();
                                return (
                                    settings,
                                    Some(format!(
                                        "Настройки прошлой версии перенесены: {} {}. Копия старого файла сохранена в папке настроек.",
                                        count,
                                        crate::util::plural_ru(count, "привязка", "привязки", "привязок"),
                                    )),
                                );
                            }
                            Err(err) => {
                                log::warn!(
                                    "Найдены настройки предыдущей версии, но копию создать не удалось: {err}"
                                );
                            }
                        }
                    }
                }

                settings.normalize();
                (settings, None)
            }
            Err(err) => {
                let backup = path.with_file_name(format!(
                    "config.broken-{}.toml",
                    crate::logging::now_compact()
                ));
                if let Err(rename_err) = std::fs::rename(path, &backup) {
                    log::error!(
                        "Файл настроек повреждён ({err}), резервную копию создать не удалось: {rename_err}"
                    );
                    return (
                        Self::default(),
                        Some("Файл настроек повреждён. Загружены настройки по умолчанию.".into()),
                    );
                }
                log::error!(
                    "Файл настроек повреждён ({err}). Резервная копия: {}",
                    backup.display()
                );
                (
                    Self::default(),
                    Some(format!(
                        "Файл настроек был повреждён. Сохранена копия «{}», загружены настройки по умолчанию.",
                        backup.display()
                    )),
                )
            }
        }
    }

    /// Сохраняет настройки атомарно: сначала во временный файл, потом замена.
    pub fn save(&self, path: &Path) -> std::io::Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        // Округляем громкость, чтобы в файле было «0.8», а не «0.800000011920929».
        let mut settings = self.clone();
        settings.version = CONFIG_VERSION;
        settings.volume = (settings.volume.clamp(0.0, 1.0) * 1000.0).round() / 1000.0;

        let text = toml::to_string_pretty(&settings)
            .map_err(|err| std::io::Error::new(std::io::ErrorKind::InvalidData, err))?;

        let tmp = path.with_extension("toml.tmp");
        std::fs::write(&tmp, text.as_bytes())?;
        std::fs::rename(&tmp, path)?;
        Ok(())
    }
}

/// Пути данных приложения.
#[derive(Debug, Clone)]
pub struct AppPaths {
    /// `%APPDATA%\RewardSounds`
    pub data_dir: PathBuf,
    /// `%APPDATA%\RewardSounds\config.toml`
    pub config_file: PathBuf,
    /// `%APPDATA%\RewardSounds\logs`
    pub log_dir: PathBuf,
    /// `%APPDATA%\RewardSounds\logs\reward-sounds.log`
    pub log_file: PathBuf,
}

impl AppPaths {
    pub fn resolve() -> Self {
        // Переменная окружения позволяет держать настройки рядом с программой
        // (портативный режим) или проверить приложение в отдельной папке.
        let base = std::env::var_os("REWARD_SOUNDS_DATA_DIR")
            .map(PathBuf::from)
            .filter(|path| !path.as_os_str().is_empty())
            .unwrap_or_else(|| {
                dirs::data_dir()
                    .or_else(|| std::env::var_os("APPDATA").map(PathBuf::from))
                    .unwrap_or_else(std::env::temp_dir)
                    .join("RewardSounds")
            });

        let log_dir = base.join("logs");
        Self {
            config_file: base.join("config.toml"),
            log_file: log_dir.join("reward-sounds.log"),
            log_dir,
            data_dir: base,
        }
    }

    pub fn ensure_dirs(&self) -> std::io::Result<()> {
        std::fs::create_dir_all(&self.data_dir)?;
        std::fs::create_dir_all(&self.log_dir)?;
        Ok(())
    }
}

/// Импорт настроек предыдущей версии приложения.
///
/// Старый формат (до появления списка наград Twitch) выглядел так:
/// ```toml
/// [[rewards]]
/// name = "Испугать стримера"
/// sound = 'D:\Stream\shot.mp3'
/// reward_id = "abc123"
/// ```
/// Переносим только записи с известным `reward_id`: без него привязать
/// звук к награде невозможно.
fn import_legacy_rewards(text: &str) -> Vec<RewardSound> {
    let value: toml::Value = match text.parse() {
        Ok(value) => value,
        Err(_) => return Vec::new(),
    };

    let Some(rewards) = value.get("rewards").and_then(toml::Value::as_array) else {
        return Vec::new();
    };

    let mut imported: Vec<RewardSound> = Vec::new();
    for reward in rewards {
        let Some(reward_id) = reward.get("reward_id").and_then(toml::Value::as_str) else {
            continue;
        };
        let reward_id = reward_id.trim();
        let Some(path) = reward.get("sound").and_then(toml::Value::as_str) else {
            continue;
        };
        let path = path.trim();
        if reward_id.is_empty() || path.is_empty() {
            continue;
        }
        if imported.iter().any(|binding| binding.reward_id == reward_id) {
            continue;
        }

        let title = reward
            .get("name")
            .and_then(toml::Value::as_str)
            .map(str::trim)
            .filter(|name| !name.is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| crate::util::file_stem(Path::new(path)));

        imported.push(RewardSound {
            reward_id: reward_id.to_string(),
            title,
            path: path.to_string(),
            volume: 1.0,
        });
    }

    imported
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        use std::sync::atomic::{AtomicU32, Ordering};
        static COUNTER: AtomicU32 = AtomicU32::new(0);

        let counter = COUNTER.fetch_add(1, Ordering::Relaxed);
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join("test-tmp")
            .join(format!("{name}-{}-{counter}", std::process::id()));
        std::fs::create_dir_all(&dir).expect("не удалось создать временную папку теста");
        dir
    }

    #[test]
    fn saves_and_loads_settings() {
        let dir = temp_dir("save-load");
        let file = dir.join("config.toml");

        let mut settings = Settings::default();
        settings.volume = 0.35;
        settings.muted = true;
        settings.set_reward_sound("reward-1", "Тревога", r"C:\Sounds\alarm.mp3");
        settings.save(&file).unwrap();

        let saved_text = std::fs::read_to_string(&file).unwrap();
        assert!(
            saved_text.contains("volume = 0.35"),
            "громкость должна сохраняться без длинного «хвоста»: {saved_text}"
        );
        assert!(saved_text.contains("reward_id = \"reward-1\""));

        let (loaded, warning) = Settings::load(&file);
        assert!(warning.is_none());
        assert!((loaded.volume - 0.35).abs() < 1e-9);
        assert!(loaded.muted);
        assert_eq!(loaded.effective_volume(), 0.0);
        let binding = loaded.reward_sound("reward-1").unwrap();
        assert_eq!(binding.title, "Тревога");
        assert_eq!(binding.path, r"C:\Sounds\alarm.mp3");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn broken_file_is_backed_up() {
        let dir = temp_dir("broken");
        let file = dir.join("config.toml");
        std::fs::write(&file, "volume = \"совсем не число\"").unwrap();

        let (settings, warning) = Settings::load(&file);
        assert!(warning.is_some());
        assert!((settings.volume - 0.8).abs() < 1e-9);
        assert!(!file.exists(), "испорченный файл должен быть переименован");
        let backup_exists = std::fs::read_dir(&dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .any(|e| e.file_name().to_string_lossy().starts_with("config.broken-"));
        assert!(backup_exists, "должна остаться резервная копия");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn imports_legacy_bindings_with_reward_id() {
        let dir = temp_dir("legacy");
        let file = dir.join("config.toml");
        std::fs::write(
            &file,
            "[[rewards]]\nname = \"Тревога\"\nsound = 'D:\\Stream\\shot.mp3'\nreward_id = \"abc123\"\n",
        )
        .unwrap();

        let (settings, warning) = Settings::load(&file);
        assert!(warning.is_some(), "пользователь должен узнать о переносе");
        let binding = settings.reward_sound("abc123").unwrap();
        assert_eq!(binding.title, "Тревога");
        assert_eq!(binding.path, r"D:\Stream\shot.mp3");

        let backup_exists = std::fs::read_dir(&dir)
            .unwrap()
            .filter_map(|entry| entry.ok())
            .any(|entry| entry.file_name().to_string_lossy().starts_with("config.legacy-"));
        assert!(backup_exists, "старый файл должен быть сохранён");

        settings.save(&file).unwrap();
        let (again, warning_again) = Settings::load(&file);
        assert!(warning_again.is_none());
        assert_eq!(again.twitch_rewards.len(), 1);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn legacy_entries_without_reward_id_are_skipped() {
        let dir = temp_dir("legacy-no-id");
        let file = dir.join("config.toml");
        std::fs::write(
            &file,
            "[[rewards]]\nname = \"АЛО\"\nsound = 'D:\\Stream\\shot.mp3'\nreward_id = \"\"\n",
        )
        .unwrap();

        let (settings, warning) = Settings::load(&file);
        assert!(warning.is_none());
        assert!(settings.twitch_rewards.is_empty());
        assert!(file.exists(), "старый файл не должен переименовываться");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn normalization_fixes_values() {
        let mut settings = Settings::default();
        settings.volume = 5.0;
        settings.twitch_rewards.push(RewardSound {
            reward_id: " r1 ".into(),
            title: "  Тревога  ".into(),
            path: " C:\\a\\b.mp3 ".into(),
            volume: 1.0,
        });
        settings.twitch_rewards.push(RewardSound {
            reward_id: String::new(),
            title: "Без ID".into(),
            path: r"C:\x.mp3".into(),
            volume: 1.0,
        });
        settings.normalize();
        assert_eq!(settings.volume, 1.0);
        assert_eq!(settings.twitch_rewards.len(), 1);
        assert_eq!(settings.twitch_rewards[0].reward_id, "r1");
        assert_eq!(settings.twitch_rewards[0].title, "Тревога");
        assert_eq!(settings.twitch_rewards[0].path, r"C:\a\b.mp3");
    }

    #[test]
    fn binds_sound_to_reward_by_id() {
        let mut settings = Settings::default();
        settings.set_reward_sound("reward-1", "Тревога", r"C:\Sounds\alarm.mp3");
        assert_eq!(settings.twitch_rewards.len(), 1);

        settings.set_reward_sound("reward-1", "Тревога", r"C:\Sounds\new.mp3");
        assert_eq!(settings.twitch_rewards.len(), 1);
        assert_eq!(
            settings.reward_sound("reward-1").unwrap().path,
            r"C:\Sounds\new.mp3"
        );

        assert!(settings.clear_reward_sound("reward-1"));
        assert!(settings.reward_sound("reward-1").is_none());
    }

    #[test]
    fn sound_volume_is_saved_and_clamped() {
        let mut settings = Settings::default();
        settings.set_reward_sound("reward-1", "Тревога", r"C:\Sounds\alarm.mp3");

        assert!(settings.set_sound_volume("reward-1", 0.5));
        assert!((settings.reward_sound("reward-1").unwrap().volume - 0.5).abs() < 1e-9);

        settings.set_sound_volume("reward-1", 5.0);
        assert!((settings.reward_sound("reward-1").unwrap().volume - 2.0).abs() < 1e-9);

        settings.set_sound_volume("reward-1", -1.0);
        assert!((settings.reward_sound("reward-1").unwrap().volume - 0.0).abs() < 1e-9);

        assert!(!settings.set_sound_volume("unknown", 1.0));
    }

    #[test]
    fn old_config_without_sound_volume_defaults_to_one() {
        let text = r#"
version = 3
volume = 0.8
[[twitch_rewards]]
reward_id = "r1"
title = "Старая привязка"
path = "C:\\a.mp3"
"#;
        let dir = temp_dir("volume-migration");
        let file = dir.join("config.toml");
        std::fs::write(&file, text).unwrap();

        let (settings, warning) = Settings::load(&file);
        assert!(warning.is_none());
        assert_eq!(settings.reward_sound("r1").unwrap().volume, 1.0);
        // Старый файл без режима отображения открывается списком.
        assert!(!settings.grid_view);
    }

    #[test]
    fn effective_sound_volume_multiplies_master_and_slider() {
        let mut settings = Settings::default();
        settings.volume = 0.5;
        settings.set_reward_sound("r1", "Тест", r"C:\a.mp3");
        settings.set_sound_volume("r1", 0.5);

        assert!((settings.effective_sound_volume("r1") - 0.25).abs() < 1e-6);
        // Без привязки действует только общая громкость.
        assert!((settings.effective_sound_volume("unknown") - 0.5).abs() < 1e-6);
        // Режим «Без звука» глушит всё.
        settings.muted = true;
        assert_eq!(settings.effective_sound_volume("r1"), 0.0);
    }
}

