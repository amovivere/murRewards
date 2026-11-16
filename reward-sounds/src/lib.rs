//! Reward Sounds — воспроизведение локальных звуков при активации наград
//! Twitch Channel Points.
//!
//! Код разделён на независимые части:
//! * [`config`]  — настройки и пути хранения (AppData);
//! * [`audio`]   — аудиодвижок (отдельный поток, микширование, громкость);
//! * [`logging`] — локальный журнал событий и ошибок;
//! * [`music`]   — треки по заявке: ссылки YouTube и загрузка через yt-dlp;
//! * [`app`]     — интерфейс приложения;
//! * [`theme`]   — оформление интерфейса;
//! * [`icon`]    — иконка окна;
//! * [`util`]    — мелкие вспомогательные функции.

pub mod app;
pub mod audio;
pub mod autostart;
pub mod config;
pub mod eventsub;
pub mod http;
pub mod icon;
pub mod json;
pub mod logging;
pub mod music;
pub mod playback;
pub mod secure_store;
pub mod theme;
pub mod tray;
pub mod twitch;
pub mod util;
pub mod window_ops;

/// Версия приложения (из Cargo.toml).
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
