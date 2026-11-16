//! Управление Яндекс Музыкой через системные медиа-сессии Windows (SMTC).
//!
//! Это тот же механизм, что используют мультимедийные клавиши: мы читаем
//! состояние плеера и просим паузу или продолжение. Окно не активируется,
//! фокус не перехватывается, приложение может быть свёрнуто.
//!
//! Сессия ищется по идентификатору приложения: у версии с установщика это
//! `ru.yandex.desktop.music`.

use windows::Media::Control::GlobalSystemMediaTransportControlsSession;
use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager;
use windows::Media::Control::GlobalSystemMediaTransportControlsSessionPlaybackStatus;

/// Как искать сессию среди всех медиа-приложений.
const APP_MATCHER: &str = "yandex";

/// Менеджер медиа-сессий системы.
fn manager() -> Option<GlobalSystemMediaTransportControlsSessionManager> {
    GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
        .ok()?
        .get()
        .ok()
}

/// Сессия Яндекс Музыки, если она есть.
fn yandex_session() -> Option<GlobalSystemMediaTransportControlsSession> {
    let manager = manager()?;
    let sessions = manager.GetSessions().ok()?;
    let count = sessions.Size().ok()?;

    for index in 0..count {
        let Ok(session) = sessions.GetAt(index) else {
            continue;
        };
        if let Ok(app) = session.SourceAppUserModelId() {
            if app.to_string().to_lowercase().contains(APP_MATCHER) {
                return Some(session);
            }
        }
    }

    None
}

/// Играет ли сейчас Яндекс Музыка.
///
/// `None` — сессии не нашлось (приложение закрыто).
pub fn is_playing() -> Option<bool> {
    let session = yandex_session()?;
    let status = session.GetPlaybackInfo().ok()?.PlaybackStatus().ok()?;
    Some(status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing)
}

/// Ставит воспроизведение на паузу. `true`, если получилось.
pub fn pause() -> bool {
    let Some(session) = yandex_session() else {
        return false;
    };
    session
        .TryPauseAsync()
        .ok()
        .and_then(|operation| operation.get().ok())
        .unwrap_or(false)
}

/// Продолжает воспроизведение с того же места.
pub fn resume() -> bool {
    let Some(session) = yandex_session() else {
        return false;
    };
    session
        .TryPlayAsync()
        .ok()
        .and_then(|operation| operation.get().ok())
        .unwrap_or(false)
}
