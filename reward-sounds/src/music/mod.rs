//! Подсистема «Трек по заявке»: заявки из Twitch, ссылки YouTube, звук в эфире.
//!
//! В этой версии всё воспроизведение идёт внутри приложения:
//! * [`links`]  — разбор ссылок из текста заявки;
//! * [`ytdlp`]  — вызов `yt-dlp`: метаданные видео и аудио в память;
//! * [`decode`] — собственный декодер AAC/fMP4 поверх symphonia;
//! * [`player`] — воспроизведение, пауза, перемотка, конец трека;
//! * [`queue`]  — очередь заявок, порядок, лимиты, сохранение;
//! * [`prefetch`] — предзагрузка следующего трека в память;
//! * [`service`] — связка «заявка → проверка → очередь → воспроизведение».
//!
//! Аудио на диск не сохраняется: `yt-dlp` отдаёт поток в stdout, приложение
//! держит его в памяти и отдаёт декодеру. После трека буфер просто исчезает.

pub mod decode;
pub mod links;
pub mod player;
pub mod prefetch;
pub mod queue;
pub mod chat;
pub mod overlay;
pub mod service;
pub mod yandex;
pub mod ytdlp;

pub use links::{LinkError, TrackLink};
pub use player::{Player, PlayerState};
pub use prefetch::{Prefetch, Prefetched};
pub use queue::{ItemState, Queue, QueueItem, QueueReject};
pub use service::{Config, MusicEvent, MusicService, Snapshot};
pub use ytdlp::{VideoMeta, YtDlp, YtError};
