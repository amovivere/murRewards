//! Очередь заявок на треки.
//!
//! Очередь живёт в памяти и сохраняется в `queue.json`, чтобы перезапуск
//! приложения не терял заявки. Порядок — по времени активации на Twitch
//! (`redeemed_at`), а не по времени прихода события: после переподключения
//! EventSub события могут прийти не по порядку.

use std::path::Path;

use serde::{Deserialize, Serialize};

use super::VideoMeta;

/// Версия формата файла очереди.
pub const QUEUE_VERSION: u32 = 1;

/// Сколько завершённых заявок храним в файле для истории.
pub const HISTORY_LIMIT: usize = 20;

/// Состояние заявки.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ItemState {
    /// Ждёт своей очереди.
    Queued,
    /// Скачивается или готовится к старту.
    Loading,
    /// Звучит прямо сейчас.
    Playing,
    /// Сыграна до конца.
    Done,
    /// Не удалось запустить.
    Failed,
    /// Баллы вернулись зрителю.
    Refunded,
    /// Пропущена стримером.
    Skipped,
}

impl ItemState {
    /// Завершена ли заявка (занимает ли она место в очереди).
    pub fn is_final(self) -> bool {
        matches!(
            self,
            ItemState::Done | ItemState::Failed | ItemState::Refunded | ItemState::Skipped
        )
    }

    pub fn label(self) -> &'static str {
        match self {
            ItemState::Queued => "в очереди",
            ItemState::Loading => "загружается",
            ItemState::Playing => "играет",
            ItemState::Done => "сыграно",
            ItemState::Failed => "ошибка",
            ItemState::Refunded => "баллы возвращены",
            ItemState::Skipped => "пропущено",
        }
    }
}

/// Одна заявка зрителя.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueItem {
    /// ID активации на Twitch — по нему же обновляется статус.
    pub redemption_id: String,
    pub video_id: String,
    /// Канонический адрес видео.
    pub url: String,
    /// Название и канал появляются после проверки через yt-dlp.
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub channel: String,
    #[serde(default)]
    pub duration_sec: u64,
    pub user_login: String,
    /// Время активации (строка из Twitch или локальная метка).
    pub redeemed_at: String,
    pub state: ItemState,
    #[serde(default)]
    pub attempts: u32,
    #[serde(default)]
    pub error: Option<String>,
}

impl QueueItem {
    /// Новая заявка до проверки метаданных.
    pub fn new(
        redemption_id: impl Into<String>,
        video_id: impl Into<String>,
        url: impl Into<String>,
        user_login: impl Into<String>,
        redeemed_at: impl Into<String>,
    ) -> Self {
        Self {
            redemption_id: redemption_id.into(),
            video_id: video_id.into(),
            url: url.into(),
            title: String::new(),
            channel: String::new(),
            duration_sec: 0,
            user_login: user_login.into(),
            redeemed_at: redeemed_at.into(),
            state: ItemState::Queued,
            attempts: 0,
            error: None,
        }
    }

    /// Подпись для интерфейса: название, иначе ID видео.
    pub fn label(&self) -> String {
        if self.title.trim().is_empty() {
            self.video_id.clone()
        } else {
            self.title.clone()
        }
    }

    /// Заполняет данные, полученные от yt-dlp.
    pub fn apply_meta(&mut self, meta: &VideoMeta) {
        self.title = meta.title.clone();
        self.channel = meta.channel.clone();
        self.duration_sec = meta.duration_sec;
    }
}

/// Почему заявку не приняли.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum QueueReject {
    /// Очередь заполнена.
    Full,
    /// Такая активация уже в очереди.
    Duplicate,
    /// Трек длиннее лимита.
    TooLong { sec: u64, limit: u64 },
    /// Прямой эфир.
    Live,
}

impl QueueReject {
    /// Текст для журнала и интерфейса.
    pub fn message(&self) -> String {
        match self {
            QueueReject::Full => "Очередь заявок заполнена".to_string(),
            QueueReject::Duplicate => "Эта заявка уже в очереди".to_string(),
            QueueReject::TooLong { sec, limit } => format!(
                "Трек длиннее лимита: {} вместо {}",
                super::ytdlp::format_duration(*sec),
                super::ytdlp::format_duration(*limit)
            ),
            QueueReject::Live => "Прямые эфиры не поддерживаются".to_string(),
        }
    }
}

/// Состояние очереди на диске.
#[derive(Debug, Serialize, Deserialize)]
struct QueueFile {
    version: u32,
    updated_at: String,
    items: Vec<QueueItem>,
}

/// Очередь заявок.
pub struct Queue {
    items: Vec<QueueItem>,
    max_len: usize,
    max_duration_sec: u64,
}

impl Queue {
    pub fn new(max_len: usize, max_duration_sec: u64) -> Self {
        Self {
            items: Vec::new(),
            max_len: max_len.max(1),
            max_duration_sec: max_duration_sec.max(30),
        }
    }

    /// Меняет лимиты на ходу (например, из настроек).
    pub fn set_limits(&mut self, max_len: usize, max_duration_sec: u64) {
        self.max_len = max_len.max(1);
        self.max_duration_sec = max_duration_sec.max(30);
    }

    pub fn items(&self) -> &[QueueItem] {
        &self.items
    }

    /// Сколько заявок ещё ждут (без завершённых).
    pub fn pending(&self) -> usize {
        self.items
            .iter()
            .filter(|item| !item.state.is_final())
            .count()
    }

    /// Есть ли место для новой заявки.
    pub fn has_room(&self) -> bool {
        self.pending() < self.max_len
    }

    /// Добавляет заявку с уже проверенными метаданными.
    pub fn push(&mut self, mut item: QueueItem) -> Result<(), QueueReject> {
        if self
            .items
            .iter()
            .any(|existing| existing.redemption_id == item.redemption_id)
        {
            return Err(QueueReject::Duplicate);
        }
        if item.duration_sec > self.max_duration_sec {
            return Err(QueueReject::TooLong {
                sec: item.duration_sec,
                limit: self.max_duration_sec,
            });
        }
        if !self.has_room() {
            return Err(QueueReject::Full);
        }

        item.state = ItemState::Queued;
        let position = self
            .items
            .iter()
            .position(|existing| {
                (existing.redeemed_at.as_str(), existing.redemption_id.as_str())
                    > (item.redeemed_at.as_str(), item.redemption_id.as_str())
            })
            .unwrap_or(self.items.len());
        self.items.insert(position, item);
        Ok(())
    }

    /// Берёт следующую заявку в работу и помечает её играющей.
    pub fn take_next(&mut self) -> Option<QueueItem> {
        let index = self
            .items
            .iter()
            .position(|item| item.state == ItemState::Queued)?;
        let mut item = self.items[index].clone();
        item.state = ItemState::Playing;
        item.attempts += 1;
        self.items[index] = item.clone();
        Some(item)
    }

    /// Помечает заявку завершённой.
    pub fn complete(&mut self, redemption_id: &str, state: ItemState) -> bool {
        match self
            .items
            .iter_mut()
            .find(|item| item.redemption_id == redemption_id)
        {
            Some(item) => {
                item.state = state;
                item.error = None;
                true
            }
            None => false,
        }
    }

    /// Запоминает ошибку и помечает заявку неудачной.
    pub fn fail(&mut self, redemption_id: &str, message: impl Into<String>) -> bool {
        match self
            .items
            .iter_mut()
            .find(|item| item.redemption_id == redemption_id)
        {
            Some(item) => {
                item.state = ItemState::Failed;
                item.error = Some(message.into());
                true
            }
            None => false,
        }
    }

    /// Убирает заявку (например, стример удалил её из очереди).
    pub fn remove(&mut self, redemption_id: &str) -> bool {
        let before = self.items.len();
        self.items
            .retain(|item| item.redemption_id != redemption_id);
        self.items.len() != before
    }

    /// Поднимает заявку на одну позицию выше среди ожидающих.
    pub fn move_up(&mut self, redemption_id: &str) -> bool {
        let Some(index) = self
            .items
            .iter()
            .position(|item| item.redemption_id == redemption_id)
        else {
            return false;
        };
        if index == 0 {
            return false;
        }
        if self.items[index - 1].state.is_final() {
            return false;
        }
        self.items.swap(index - 1, index);
        true
    }

    /// Убирает завершённые заявки. Возвращает, сколько удалили.
    pub fn clear_finished(&mut self) -> usize {
        let before = self.items.len();
        self.items.retain(|item| !item.state.is_final());
        before - self.items.len()
    }

    /// Полностью очищает очередь.
    pub fn clear(&mut self) -> usize {
        let count = self.items.len();
        self.items.clear();
        count
    }

    /// Загружает очередь из файла. Битый файл не должен ронять приложение.
    pub fn load(path: &Path) -> Self {
        let text = match std::fs::read_to_string(path) {
            Ok(text) => text,
            Err(_) => return Self::new(10, 480),
        };

        match serde_json::from_str::<QueueFile>(&text) {
            Ok(file) => {
                if file.version != QUEUE_VERSION {
                    log::warn!(
                        "Очередь заявок версии {} не поддерживается — начинаем с пустой",
                        file.version
                    );
                    return Self::new(10, 480);
                }
                let mut queue = Self::new(10, 480);
                queue.items = file.items;
                // Играющие до перезапуска заявки возвращаем в очередь:
                // звук всё равно прервался.
                for item in &mut queue.items {
                    if item.state == ItemState::Playing || item.state == ItemState::Loading {
                        item.state = ItemState::Queued;
                    }
                }
                queue.items.retain(|item| !item.state.is_final());
                queue
            }
            Err(err) => {
                log::warn!("Файл очереди повреждён: {err}");
                Self::new(10, 480)
            }
        }
    }

    /// Сохраняет очередь атомарно (временный файл + замена).
    pub fn save(&self, path: &Path) -> std::io::Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        // История: последние завершённые заявки, чтобы файл не рос бесконечно.
        let mut items: Vec<QueueItem> = self.items.clone();
        let finished = items.iter().filter(|item| item.state.is_final()).count();
        if finished > HISTORY_LIMIT {
            let mut skip = finished - HISTORY_LIMIT;
            let mut kept = Vec::with_capacity(items.len());
            for item in items {
                // Завершённые идут в конце очереди, поэтому «лишние» — первые из них.
                if item.state.is_final() && skip > 0 {
                    skip -= 1;
                    continue;
                }
                kept.push(item);
            }
            items = kept;
        }

        let file = QueueFile {
            version: QUEUE_VERSION,
            updated_at: crate::logging::timestamp(),
            items,
        };

        let text = serde_json::to_string_pretty(&file)
            .map_err(|err| std::io::Error::new(std::io::ErrorKind::InvalidData, err))?;
        let tmp = path.with_extension("json.tmp");
        std::fs::write(&tmp, text.as_bytes())?;
        std::fs::rename(&tmp, path)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn item(id: &str, redeemed_at: &str) -> QueueItem {
        QueueItem::new(
            format!("redemption-{id}"),
            "dQw4w9WgXcQ",
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "viewer",
            redeemed_at,
        )
    }

    fn temp_file(name: &str) -> PathBuf {
        use std::sync::atomic::{AtomicU32, Ordering};
        static COUNTER: AtomicU32 = AtomicU32::new(0);
        let counter = COUNTER.fetch_add(1, Ordering::Relaxed);
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join("test-tmp")
            .join(format!("queue-{name}-{}-{counter}", std::process::id()));
        std::fs::create_dir_all(&dir).expect("временная папка");
        dir.join("queue.json")
    }

    #[test]
    fn keeps_order_by_redeemed_at() {
        let mut queue = Queue::new(10, 480);
        queue.push(item("b", "2026-11-14T10:00:02Z")).unwrap();
        queue.push(item("a", "2026-11-14T10:00:01Z")).unwrap();
        queue.push(item("c", "2026-11-14T10:00:03Z")).unwrap();

        let ids: Vec<&str> = queue
            .items()
            .iter()
            .map(|item| item.redemption_id.as_str())
            .collect();
        assert_eq!(
            ids,
            vec!["redemption-a", "redemption-b", "redemption-c"]
        );
    }

    #[test]
    fn rejects_duplicate() {
        let mut queue = Queue::new(10, 480);
        queue.push(item("a", "1")).unwrap();
        assert_eq!(queue.push(item("a", "2")), Err(QueueReject::Duplicate));
    }

    #[test]
    fn rejects_full_queue() {
        let mut queue = Queue::new(1, 480);
        queue.push(item("a", "1")).unwrap();
        assert_eq!(queue.push(item("b", "2")), Err(QueueReject::Full));
    }

    #[test]
    fn rejects_too_long_and_counts_only_pending() {
        let mut queue = Queue::new(1, 60);
        let mut long = item("long", "1");
        long.duration_sec = 120;
        assert_eq!(
            queue.push(long),
            Err(QueueReject::TooLong {
                sec: 120,
                limit: 60
            })
        );

        queue.push(item("a", "1")).unwrap();
        assert_eq!(queue.pending(), 1);
        queue.complete("redemption-a", ItemState::Done);
        assert_eq!(queue.pending(), 0, "завершённые не занимают место");
        assert!(queue.has_room());
    }

    #[test]
    fn take_next_marks_playing() {
        let mut queue = Queue::new(10, 480);
        queue.push(item("a", "1")).unwrap();
        queue.push(item("b", "2")).unwrap();

        let first = queue.take_next().expect("первая заявка");
        assert_eq!(first.redemption_id, "redemption-a");
        assert_eq!(first.state, ItemState::Playing);
        assert_eq!(first.attempts, 1);

        let snapshot = queue.items().to_vec();
        assert_eq!(snapshot[0].state, ItemState::Playing);

        let second = queue.take_next().expect("вторая заявка");
        assert_eq!(second.redemption_id, "redemption-b");
        assert!(queue.take_next().is_none());
    }

    #[test]
    fn complete_remove_and_clear() {
        let mut queue = Queue::new(10, 480);
        queue.push(item("a", "1")).unwrap();
        queue.push(item("b", "2")).unwrap();

        assert!(queue.complete("redemption-a", ItemState::Skipped));
        assert!(!queue.complete("unknown", ItemState::Done));
        assert!(queue.remove("redemption-b"));
        assert!(!queue.remove("redemption-b"));
        assert_eq!(queue.clear_finished(), 1);
        assert_eq!(queue.items().len(), 0);
    }

    #[test]
    fn move_up_swaps_pending_items() {
        let mut queue = Queue::new(10, 480);
        queue.push(item("a", "1")).unwrap();
        queue.push(item("b", "2")).unwrap();

        assert!(queue.move_up("redemption-b"));
        let ids: Vec<&str> = queue
            .items()
            .iter()
            .map(|item| item.redemption_id.as_str())
            .collect();
        assert_eq!(ids, vec!["redemption-b", "redemption-a"]);
        assert!(!queue.move_up("redemption-b"), "уже сверху");
    }

    #[test]
    fn saves_and_loads_queue() {
        let file = temp_file("roundtrip");
        let mut queue = Queue::new(10, 480);
        let mut first = item("a", "2026-11-14T10:00:01Z");
        first.apply_meta(&VideoMeta {
            title: "Тестовый трек".into(),
            channel: "Канал".into(),
            duration_sec: 213,
            is_live: false,
        });
        queue.push(first).unwrap();
        queue.push(item("b", "2026-11-14T10:00:02Z")).unwrap();
        queue.save(&file).expect("очередь должна сохраниться");

        let loaded = Queue::load(&file);
        assert_eq!(loaded.items().len(), 2);
        assert_eq!(loaded.items()[0].title, "Тестовый трек");
        assert_eq!(loaded.items()[0].duration_sec, 213);

        let _ = std::fs::remove_dir_all(file.parent().unwrap());
    }

    #[test]
    fn playing_items_return_to_queue_after_restart() {
        let file = temp_file("restart");
        let mut queue = Queue::new(10, 480);
        queue.push(item("a", "1")).unwrap();
        queue.take_next();
        queue.save(&file).expect("сохранение");

        let loaded = Queue::load(&file);
        assert_eq!(loaded.items()[0].state, ItemState::Queued);
        assert_eq!(loaded.pending(), 1);

        let _ = std::fs::remove_dir_all(file.parent().unwrap());
    }

    #[test]
    fn broken_file_gives_empty_queue() {
        let file = temp_file("broken");
        std::fs::write(&file, "{это не json").unwrap();
        let queue = Queue::load(&file);
        assert_eq!(queue.items().len(), 0);

        let _ = std::fs::remove_dir_all(file.parent().unwrap());
    }

    #[test]
    fn state_labels_and_finals() {
        assert!(ItemState::Done.is_final());
        assert!(ItemState::Failed.is_final());
        assert!(!ItemState::Queued.is_final());
        assert!(!ItemState::Playing.is_final());
        assert_eq!(ItemState::Playing.label(), "играет");
    }

    #[test]
    fn reject_messages_are_readable() {
        assert!(QueueReject::Full.message().contains("заполнена"));
        assert!(QueueReject::Live.message().contains("эфир"));
        assert!(QueueReject::TooLong { sec: 500, limit: 480 }
            .message()
            .contains("8:00"));
    }
}
