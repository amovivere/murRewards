//! Показ картинки-награды в OBS: глобальное состояние для оверлея.

use std::collections::HashMap;
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
    pub visible_at: Instant,
    pub expires: Instant,
    pub duration_ms: u64,
}

static STATE: OnceLock<Mutex<Option<Shown>>> = OnceLock::new();
static LIBRARY: OnceLock<Mutex<HashMap<String, Vec<PathBuf>>>> = OnceLock::new();
static LAST: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
static SHOWS: OnceLock<Mutex<HashMap<String, (u32, Option<Instant>)>>> = OnceLock::new();

fn state() -> &'static Mutex<Option<Shown>> {
    STATE.get_or_init(|| Mutex::new(None))
}

fn library() -> &'static Mutex<HashMap<String, Vec<PathBuf>>> {
    LIBRARY.get_or_init(|| Mutex::new(HashMap::new()))
}

fn last_shown() -> &'static Mutex<HashMap<String, String>> {
    LAST.get_or_init(|| Mutex::new(HashMap::new()))
}

fn show_stats() -> &'static Mutex<HashMap<String, (u32, Option<Instant>)>> {
    SHOWS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Обновляет каталог картинок для превью в приложении и OBS.
pub fn set_library(rewards: &[ImageRewardSettings]) {
    let mut map = HashMap::new();
    for reward in rewards {
        map.insert(
            reward.reward_id.clone(),
            reward
                .images
                .iter()
                .filter(|path| PathBuf::from(path).is_file())
                .map(PathBuf::from)
                .collect(),
        );
    }
    if let Ok(mut library) = library().lock() {
        *library = map;
    }
}

/// Отдаёт картинку из каталога награды (для `<img src="/image-reward/thumb/...">`).
pub fn library_media(reward_id: &str, index: usize) -> Option<Vec<u8>> {
    let library = library().lock().ok()?;
    let path = library.get(reward_id)?.get(index)?;
    std::fs::read(path).ok()
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

/// Показывает случайную картинку награды. Возвращает false, если картинок нет
/// или сработал лимит/кулдаун.
pub fn show(settings: &ImageRewardSettings) -> bool {
    let now = Instant::now();
    {
        let stats = match show_stats().lock() {
            Ok(stats) => stats,
            Err(_) => return false,
        };
        if let Some((count, last)) = stats.get(&settings.reward_id) {
            if settings.max_shows > 0 && *count >= settings.max_shows {
                log::info!("Картинки «{}»: достигнут лимит показов", settings.reward_id);
                return false;
            }
            if settings.show_cooldown_sec > 0 {
                if let Some(last) = last {
                    if last.elapsed().as_secs() < settings.show_cooldown_sec {
                        log::info!("Картинки «{}»: кулдаун", settings.reward_id);
                        return false;
                    }
                }
            }
        }
    }

    let valid: Vec<(usize, &String)> = settings
        .images
        .iter()
        .enumerate()
        .filter(|(_, path)| PathBuf::from(path).is_file())
        .collect();
    if valid.is_empty() {
        return false;
    }
    let last = last_shown()
        .lock()
        .ok()
        .and_then(|last| last.get(&settings.reward_id).cloned());
    let mut candidates: Vec<(usize, &String)> = valid;
    if settings.no_repeat && candidates.len() > 1 {
        candidates.retain(|(_, path)| Some((*path).clone()) != last);
    }
    let weights: Vec<u64> = candidates
        .iter()
        .map(|(index, _)| {
            settings
                .weights
                .get(*index)
                .copied()
                .unwrap_or(1)
                .max(1) as u64
        })
        .collect();
    let total: u64 = weights.iter().sum();
    let mut target = (random_unit(seed(), 53) * total as f64).floor() as u64;
    let mut picked = candidates
        .last()
        .expect("кандидаты есть")
        .1
        .clone();
    for ((_, path), weight) in candidates.iter().zip(weights.iter()) {
        if target < *weight {
            picked = (*path).clone();
            break;
        }
        target -= weight;
    }
    let path = PathBuf::from(picked.clone());

    let seed = seed();
    let angle = (random_unit(seed, 7) * 2.0 - 1.0) * settings.max_angle_deg;
    let size = if settings.random_size {
        let min = settings.size_min_pct.min(settings.size_max_pct);
        let max = settings.size_min_pct.max(settings.size_max_pct);
        min + random_unit(seed, 41) * (max - min)
    } else {
        settings.size_pct
    };
    let margin = settings.safe_margin_pct.clamp(0.0, 20.0);
    let half = size / 2.0;
    let (left, right) = (margin + half, (100.0 - margin - half).max(margin + half));
    let (top, bottom) = (margin + 6.0, (100.0 - margin - 6.0).max(margin + 6.0));
    let random_x = left + random_unit(seed, 13) * (right - left);
    let random_y = top + random_unit(seed, 29) * (bottom - top);
    let (x, y) = match settings.placement.as_str() {
        "center" => (50.0, 50.0),
        "top-left" => (left, top),
        "top-right" => (right, top),
        "bottom-left" => (left, bottom),
        "bottom-right" => (right, bottom),
        _ => (random_x, random_y),
    };
    let delay = settings.delay_ms.min(10_000);
    let visible_at = now + Duration::from_millis(delay);
    let duration = settings.duration_ms.max(500);
    let shown = Shown {
        reward_id: settings.reward_id.clone(),
        path,
        x: x.clamp(0.0, 100.0),
        y: y.clamp(0.0, 100.0),
        angle,
        size_pct: size,
        opacity: settings.opacity,
        visible_at,
        expires: visible_at + Duration::from_millis(duration),
        duration_ms: duration,
    };
    if let Ok(mut state) = state().lock() {
        *state = Some(shown);
    }
    if let Ok(mut last) = last_shown().lock() {
        last.insert(settings.reward_id.clone(), picked);
    }
    if let Ok(mut stats) = show_stats().lock() {
        let entry = stats
            .entry(settings.reward_id.clone())
            .or_insert((0, None));
        entry.0 += 1;
        entry.1 = Some(now);
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
    if Instant::now() < shown.visible_at {
        return r#"{"show":false}"#.to_string();
    }
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
        "kind": kind_for_path(&shown.path),
        "media": format!("/image-reward/media?t={}", shown.reward_id),
    })
    .to_string()
}

pub fn media_bytes() -> Option<Vec<u8>> {
    let shown = current()?;
    std::fs::read(shown.path).ok()
}

pub fn media_content_type() -> &'static str {
    current()
        .map(|shown| content_type_for_path(&shown.path))
        .unwrap_or("application/octet-stream")
}

pub fn library_content_type(reward_id: &str, index: usize) -> &'static str {
    let Ok(library) = library().lock() else {
        return "application/octet-stream";
    };
    library
        .get(reward_id)
        .and_then(|images| images.get(index))
        .map(|path| content_type_for_path(path))
        .unwrap_or("application/octet-stream")
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

pub fn content_type_for_path(path: &std::path::Path) -> &'static str {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "ogv" | "ogg" => "video/ogg",
        _ => "application/octet-stream",
    }
}

fn kind_for_path(path: &std::path::Path) -> &'static str {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "mp4" | "webm" | "ogv" | "ogg" => "video",
        _ => "image",
    }
}

pub fn clear() {
    if let Ok(mut state) = state().lock() {
        *state = None;
    }
    if let Ok(mut last) = last_shown().lock() {
        last.clear();
    }
    if let Ok(mut stats) = show_stats().lock() {
        stats.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_settings(images: Vec<String>) -> ImageRewardSettings {
        ImageRewardSettings {
            reward_id: "test-reward".to_string(),
            images,
            ..ImageRewardSettings::default()
        }
    }

    #[test]
    fn random_size_stays_between_limits() {
        let dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target/test-tmp");
        std::fs::create_dir_all(&dir).expect("тестовая папка");
        let path = dir.join("image-random-size.png");
        std::fs::write(&path, b"not-a-real-image").expect("тестовый файл");
        let mut settings = sample_settings(vec![path.to_string_lossy().into_owned()]);
        settings.random_size = true;
        settings.size_min_pct = 20.0;
        settings.size_max_pct = 30.0;
        for _ in 0..8 {
            assert!(show(&settings));
            let shown = current().expect("показ");
            assert!(
                (20.0..=30.0).contains(&shown.size_pct),
                "размер {} вне диапазона",
                shown.size_pct
            );
        }
        clear();
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn respects_show_limit() {
        let dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target/test-tmp");
        std::fs::create_dir_all(&dir).expect("тестовая папка");
        let path = dir.join("image-limit.png");
        std::fs::write(&path, b"fake-image").expect("тестовый файл");
        let mut settings = sample_settings(vec![path.to_string_lossy().into_owned()]);
        settings.reward_id = "limit-reward".to_string();
        settings.max_shows = 1;
        assert!(show(&settings));
        assert!(!show(&settings));
        clear();
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn no_repeat_chooses_other_image() {
        let dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target/test-tmp");
        std::fs::create_dir_all(&dir).expect("тестовая папка");
        let first = dir.join("image-a.png");
        let second = dir.join("image-b.png");
        std::fs::write(&first, b"a").expect("файл a");
        std::fs::write(&second, b"b").expect("файл b");
        let mut settings = sample_settings(vec![
            first.to_string_lossy().into_owned(),
            second.to_string_lossy().into_owned(),
        ]);
        settings.reward_id = "no-repeat-reward".to_string();
        settings.no_repeat = true;
        assert!(show(&settings));
        let first_path = current().expect("первый показ").path;
        assert!(show(&settings));
        let second_path = current().expect("второй показ").path;
        assert_ne!(first_path, second_path);
        clear();
        let _ = std::fs::remove_file(first);
        let _ = std::fs::remove_file(second);
    }
}
