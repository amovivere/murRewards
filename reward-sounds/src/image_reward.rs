//! Показ картинки-награды в OBS: глобальное состояние для оверлея.

use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use crate::config::ImageRewardSettings;

#[derive(Debug, Clone)]
pub struct Shown {
    pub reward_id: String,
    pub path: PathBuf,
    pub x: f64,
    pub y: f64,
    pub angle: f64,
    pub size_pct: f64,
    pub opacity: f64,
    pub expires: Instant,
    pub duration_ms: u64,
}

static STATE: OnceLock<Mutex<Option<Shown>>> = OnceLock::new();

fn state() -> &'static Mutex<Option<Shown>> {
    STATE.get_or_init(|| Mutex::new(None))
}

fn random_unit(seed: u64, salt: u64) -> f64 {
    let mut value = seed ^ salt.wrapping_mul(0x9E3779B97F4A7C15);
    value ^= value >> 30;
    value = value.wrapping_mul(0xBF58476D1CE4E5B9);
    value ^= value >> 27;
    value = value.wrapping_mul(0x94D049BB133111EB);
    value ^= value >> 31;
    (value % 10_000) as f64 / 10_000.0
}

fn seed() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos() as u64)
        .unwrap_or(0)
}

/// Показывает случайную картинку награды. Возвращает false, если картинок нет.
pub fn show(settings: &ImageRewardSettings) -> bool {
    let valid: Vec<&String> = settings
        .images
        .iter()
        .filter(|path| PathBuf::from(path).is_file())
        .collect();
    if valid.is_empty() {
        return false;
    }
    let seed = seed();
    let index = ((seed as usize) + (seed >> 17) as usize) % valid.len();
    let path = PathBuf::from(valid[index]);
    let angle = (random_unit(seed, 7) * 2.0 - 1.0) * settings.max_angle_deg;
    let margin = settings.safe_margin_pct.clamp(0.0, 20.0);
    let span = (100.0 - settings.size_pct).clamp(0.0, 100.0);
    let x = margin + random_unit(seed, 13) * (span - margin * 2.0).max(0.0);
    let y = margin + random_unit(seed, 29) * (100.0 - margin * 2.0).max(0.0);
    let shown = Shown {
        reward_id: settings.reward_id.clone(),
        path,
        x: x.clamp(0.0, 100.0),
        y: y.clamp(0.0, 100.0),
        angle,
        size_pct: settings.size_pct,
        opacity: settings.opacity,
        expires: Instant::now() + Duration::from_millis(settings.duration_ms.max(500)),
        duration_ms: settings.duration_ms.max(500),
    };
    if let Ok(mut state) = state().lock() {
        *state = Some(shown);
    }
    true
}

pub fn current() -> Option<Shown> {
    let mut state = state().lock().ok()?;
    if let Some(shown) = state.as_ref() {
        if shown.expires <= Instant::now() {
            *state = None;
            return None;
        }
    }
    state.clone()
}

pub fn state_json() -> String {
    let Some(shown) = current() else {
        return r#"{"show":false}"#.to_string();
    };
    let left = shown.expires.saturating_duration_since(Instant::now()).as_millis();
    serde_json::json!({
        "show": true,
        "id": shown.reward_id,
        "x": shown.x,
        "y": shown.y,
        "angle": shown.angle,
        "size": shown.size_pct,
        "opacity": shown.opacity,
        "duration": shown.duration_ms,
        "left": left,
        "media": format!("/image-reward/media?t={}", shown.reward_id),
    })
    .to_string()
}

pub fn media_bytes() -> Option<Vec<u8>> {
    let shown = current()?;
    std::fs::read(shown.path).ok()
}

pub fn content_type_for(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(&[0x89, b'P', b'N', b'G']) {
        "image/png"
    } else if bytes.starts_with(&[0xFF, 0xD8]) {
        "image/jpeg"
    } else if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        "image/webp"
    } else {
        "application/octet-stream"
    }
}

pub fn clear() {
    if let Ok(mut state) = state().lock() {
        *state = None;
    }
}
