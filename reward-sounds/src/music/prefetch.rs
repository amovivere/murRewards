//! Предзагрузка следующего трека.
//!
//! Пока играет текущая заявка, приложение заранее тянет следующую — тогда
//! переключение происходит без пятисекундной паузы на «метаданные + загрузку».
//!
//! Держим в памяти не больше одного трека: 3–15 МБ при лимите длительности
//! 8 минут.

/// Аудио, готовое к мгновенному старту.
#[derive(Debug, Clone)]
pub struct Prefetched {
    pub video_id: String,
    pub bytes: Vec<u8>,
    pub duration_sec: u64,
}

/// Одна ячейка предзагрузки.
#[derive(Debug, Default)]
pub struct Prefetch {
    slot: Option<Prefetched>,
    limit_bytes: usize,
}

impl Prefetch {
    /// Ячейка с предохранителем по размеру (64 МБ).
    pub fn new() -> Self {
        Self {
            slot: None,
            limit_bytes: 64 * 1024 * 1024,
        }
    }

    /// Кладёт трек в ячейку. Слишком большой не помещаем.
    pub fn store(&mut self, track: Prefetched) -> bool {
        if track.bytes.len() > self.limit_bytes {
            return false;
        }
        self.slot = Some(track);
        true
    }

    /// Готов ли именно этот трек.
    pub fn is_ready_for(&self, video_id: &str) -> bool {
        self.slot
            .as_ref()
            .map(|track| track.video_id == video_id)
            .unwrap_or(false)
    }

    /// Забирает трек, если он совпадает с нужным.
    pub fn take(&mut self, video_id: &str) -> Option<Prefetched> {
        match self.slot.as_ref() {
            Some(track) if track.video_id == video_id => self.slot.take(),
            _ => None,
        }
    }

    /// Освобождает память.
    pub fn clear(&mut self) {
        self.slot = None;
    }

    /// Что лежит в ячейке (для журнала и интерфейса).
    pub fn ready_video(&self) -> Option<&str> {
        self.slot.as_ref().map(|track| track.video_id.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn track(video_id: &str, size: usize) -> Prefetched {
        Prefetched {
            video_id: video_id.to_string(),
            bytes: vec![0u8; size],
            duration_sec: 200,
        }
    }

    #[test]
    fn stores_and_takes_matching_track() {
        let mut prefetch = Prefetch::new();
        assert!(prefetch.store(track("aaa", 1024)));
        assert!(prefetch.is_ready_for("aaa"));
        assert!(!prefetch.is_ready_for("bbb"));
        assert!(prefetch.take("bbb").is_none());
        let taken = prefetch.take("aaa").expect("трек должен быть готов");
        assert_eq!(taken.video_id, "aaa");
        assert!(!prefetch.is_ready_for("aaa"), "ячейка опустела");
    }

    #[test]
    fn rejects_oversized_track() {
        let mut prefetch = Prefetch::new();
        prefetch.limit_bytes = 1024;
        assert!(!prefetch.store(track("big", 2048)));
        assert!(prefetch.ready_video().is_none());
    }

    #[test]
    fn clear_frees_memory() {
        let mut prefetch = Prefetch::new();
        prefetch.store(track("aaa", 16));
        prefetch.clear();
        assert!(prefetch.ready_video().is_none());
    }
}
