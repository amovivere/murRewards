//! Локальный журнал событий и ошибок.
//!
//! Журнал пишется в файл `%APPDATA%\RewardSounds\logs\reward-sounds.log`
//! и одновременно хранится в памяти, чтобы показывать его в интерфейсе.
//!
//! В журнал никогда не попадают токены и секреты: приложение их просто не логирует.

use std::collections::VecDeque;
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use log::{Level, LevelFilter, Log, Metadata, Record};

/// Сколько последних записей держим в памяти для окна «Журнал».
pub const MAX_MEMORY_ENTRIES: usize = 400;

/// Максимальный размер файла журнала; при превышении файл переименовывается в `.1`.
const MAX_FILE_BYTES: u64 = 2 * 1024 * 1024;

/// Одна запись журнала.
#[derive(Debug, Clone)]
pub struct LogEntry {
    pub time: String,
    pub level: Level,
    pub message: String,
}

impl LogEntry {
    pub fn level_label(&self) -> &'static str {
        match self.level {
            Level::Error => "ОШИБКА",
            Level::Warn => "ВНИМАНИЕ",
            Level::Info => "ИНФО",
            Level::Debug => "ОТЛАДКА",
            Level::Trace => "ТРАССИРОВКА",
        }
    }
}

struct Inner {
    file: Option<File>,
    size: u64,
    entries: VecDeque<LogEntry>,
}

/// Реализация `log::Log`: файл + кольцевой буфер в памяти.
pub struct Logger {
    path: PathBuf,
    inner: Mutex<Inner>,
}

impl Logger {
    fn new(path: PathBuf) -> Self {
        let mut file = None;
        let mut size = 0;

        // Если журнал уже слишком большой — убираем его в архив при старте.
        if let Ok(meta) = std::fs::metadata(&path) {
            size = meta.len();
            if size > MAX_FILE_BYTES {
                let _ = std::fs::remove_file(path.with_extension("log.1"));
                let _ = std::fs::rename(&path, path.with_extension("log.1"));
                size = 0;
            }
        }

        if let Ok(handle) = OpenOptions::new().create(true).append(true).open(&path) {
            file = Some(handle);
        }

        Self {
            path,
            inner: Mutex::new(Inner {
                file,
                size,
                entries: VecDeque::with_capacity(MAX_MEMORY_ENTRIES),
            }),
        }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Последние записи журнала (для окна «Журнал»).
    pub fn entries(&self) -> Vec<LogEntry> {
        match self.inner.lock() {
            Ok(inner) => inner.entries.iter().cloned().collect(),
            Err(_) => Vec::new(),
        }
    }

    fn write_record(&self, level: Level, message: &str) {
        let time = timestamp();
        let line = format!("{time}  {:<8} {message}", level.as_str().to_uppercase());

        let mut inner = match self.inner.lock() {
            Ok(inner) => inner,
            Err(_) => return,
        };

        // Кольцевой буфер для интерфейса.
        if inner.entries.len() >= MAX_MEMORY_ENTRIES {
            inner.entries.pop_front();
        }
        inner.entries.push_back(LogEntry {
            time,
            level,
            message: message.to_string(),
        });

        // Файл.
        let line_len = line.len() as u64 + 1;
        if inner.size + line_len > MAX_FILE_BYTES {
            inner.file = None;
            drop(inner);
            self.rotate();
            return;
        }

        if let Some(file) = inner.file.as_mut() {
            if writeln!(file, "{line}").is_err() {
                return;
            }
            let _ = file.flush();
            inner.size += line_len;
        }
    }

    /// Переименовывает переполненный журнал в `.1` и открывает новый.
    fn rotate(&self) {
        let _ = std::fs::remove_file(self.path.with_extension("log.1"));
        let _ = std::fs::rename(&self.path, self.path.with_extension("log.1"));
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)
            .ok();
        if let Ok(mut inner) = self.inner.lock() {
            inner.file = file;
            inner.size = 0;
        }
    }
}

impl Log for Logger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        let ours = metadata.target().starts_with("reward_sounds");
        if ours {
            metadata.level() <= Level::Debug
        } else {
            // Сторонние библиотеки пишем только при проблемах.
            metadata.level() <= Level::Warn
        }
    }

    fn log(&self, record: &Record) {
        if !self.enabled(record.metadata()) {
            return;
        }
        let message = format!("{}", record.args());
        // Дополнительная страховка: никогда не пишем в журнал длинные токены.
        if looks_like_secret(&message) {
            self.write_record(record.level(), "[запись скрыта: похоже на токен]");
            return;
        }
        self.write_record(record.level(), &message);
    }

    fn flush(&self) {}
}

/// Очень грубая, но полезная проверка: не пытаемся ли записать токен.
fn looks_like_secret(message: &str) -> bool {
    message.contains("access_token") || message.contains("refresh_token")
}

/// Обёртка, чтобы передать `Logger` в глобальный логгер `log`.
struct LoggerHandle(Arc<Logger>);

impl Log for LoggerHandle {
    fn enabled(&self, metadata: &Metadata) -> bool {
        self.0.enabled(metadata)
    }

    fn log(&self, record: &Record) {
        self.0.log(record);
    }

    fn flush(&self) {
        self.0.flush();
    }
}

/// Инициализирует журнал. Возвращает объект для чтения записей в интерфейсе.
pub fn init(log_dir: &Path) -> Arc<Logger> {
    let _ = std::fs::create_dir_all(log_dir);
    let logger = Arc::new(Logger::new(log_dir.join("reward-sounds.log")));

    if log::set_boxed_logger(Box::new(LoggerHandle(logger.clone()))).is_ok() {
        log::set_max_level(LevelFilter::Debug);
    }

    install_panic_hook();

    logger
}

/// Паника не должна оставлять пользователя без информации: пишем её в журнал.
fn install_panic_hook() {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        log::error!("Критическая ошибка (паника): {info}");
        default_hook(info);
    }));
}

/// Текущее локальное время: `2026-11-09 02:19:17.123`.
pub fn timestamp() -> String {
    let t = now_parts();
    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}:{:02}.{:03}",
        t.year, t.month, t.day, t.hour, t.minute, t.second, t.millis
    )
}

/// Компактная метка времени для имён файлов: `20261109-021917`.
pub fn now_compact() -> String {
    let t = now_parts();
    format!(
        "{:04}{:02}{:02}-{:02}{:02}{:02}",
        t.year, t.month, t.day, t.hour, t.minute, t.second
    )
}

/// Время для интерфейса: `02:19:17`.
pub fn time_only() -> String {
    let t = now_parts();
    format!("{:02}:{:02}:{:02}", t.hour, t.minute, t.second)
}

#[derive(Debug, Clone, Copy)]
pub struct LocalTimeParts {
    pub year: u16,
    pub month: u16,
    pub day: u16,
    pub hour: u16,
    pub minute: u16,
    pub second: u16,
    pub millis: u16,
}

#[cfg(windows)]
fn now_parts() -> LocalTimeParts {
    use windows_sys::Win32::Foundation::SYSTEMTIME;
    use windows_sys::Win32::System::SystemInformation::GetLocalTime;

    let mut st = SYSTEMTIME {
        wYear: 0,
        wMonth: 0,
        wDayOfWeek: 0,
        wDay: 0,
        wHour: 0,
        wMinute: 0,
        wSecond: 0,
        wMilliseconds: 0,
    };
    // SAFETY: GetLocalTime заполняет переданную структуру, указатель корректен.
    unsafe { GetLocalTime(&mut st) };

    LocalTimeParts {
        year: st.wYear,
        month: st.wMonth,
        day: st.wDay,
        hour: st.wHour,
        minute: st.wMinute,
        second: st.wSecond,
        millis: st.wMilliseconds,
    }
}

#[cfg(not(windows))]
fn now_parts() -> LocalTimeParts {
    use std::time::{SystemTime, UNIX_EPOCH};

    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let days = secs / 86_400;
    let rem = secs % 86_400;

    // Простое преобразование «дни с 1970-01-01» в дату.
    let (year, month, day) = civil_from_days(days as i64);
    LocalTimeParts {
        year: year as u16,
        month: month as u16,
        day: day as u16,
        hour: (rem / 3600) as u16,
        minute: ((rem % 3600) / 60) as u16,
        second: (rem % 60) as u16,
        millis: 0,
    }
}

#[cfg(not(windows))]
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    // Алгоритм Говарда Хиннанта.
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}
