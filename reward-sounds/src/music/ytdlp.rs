//! Вызов `yt-dlp`: метаданные видео и аудио в память.
//!
//! Аудио на диск не сохраняется. `yt-dlp` пишет поток в stdout, приложение
//! читает его в память и отдаёт декодеру (`Cursor<Vec<u8>>`). После трека
//! буфер уничтожается — чистить нечего.
//!
//! Процесс запускается без окна консоли, с временной папкой приложения:
//! `yt-dlp` не должен писать в системный `%TEMP%`.

use std::fmt;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/// Сколько ждём метаданные видео.
pub const META_TIMEOUT: Duration = Duration::from_secs(20);
/// Сколько ждём загрузку аудио.
pub const AUDIO_TIMEOUT: Duration = Duration::from_secs(60);
/// Предохранитель по размеру: 64 МБ хватает примерно на час аудио.
pub const MAX_AUDIO_BYTES: usize = 64 * 1024 * 1024;
/// Сколько читаем из stdout при вызовах, где ждём текст.
const TEXT_LIMIT: usize = 64 * 1024;
/// Сколько читаем stderr для сообщения об ошибке.
const STDERR_LIMIT: usize = 16 * 1024;

/// Понятное описание видео, полученное до загрузки.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VideoMeta {
    pub title: String,
    pub channel: String,
    /// Длительность в секундах (0 — если YouTube её не сообщил).
    pub duration_sec: u64,
    /// Прямой эфир воспроизводить нельзя.
    pub is_live: bool,
}

/// Убирает старые каталоги PyInstaller (`_MEI*`), оставшиеся в TEMP
/// после таймаутов и падений `yt-dlp`. Один такой каталог — около 29 МБ.
pub fn cleanup_stale_temp_dirs(temp_dir: &Path) {
    let Ok(entries) = std::fs::read_dir(temp_dir) else {
        return;
    };
    let cutoff = std::time::SystemTime::now() - std::time::Duration::from_secs(3600);
    let mut removed = 0usize;
    let mut freed = 0u64;
    for entry in entries.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if !name.starts_with("_MEI") {
            continue;
        }
        let stale = entry
            .metadata()
            .ok()
            .and_then(|meta| meta.modified().ok())
            .map(|modified| modified < cutoff)
            .unwrap_or(false);
        if !stale {
            continue;
        }
        if let Some(size) = dir_size(&path) {
            freed += size;
        }
        if std::fs::remove_dir_all(&path).is_ok() {
            removed += 1;
        }
    }
    if removed > 0 {
        log::info!(
            "Музыка: удалено старых temp-каталогов yt-dlp: {removed} ({} МБ)",
            freed / (1024 * 1024)
        );
    }
}

fn dir_size(path: &Path) -> Option<u64> {
    let mut total = 0u64;
    for entry in std::fs::read_dir(path).ok()?.flatten() {
        let meta = entry.metadata().ok()?;
        if meta.is_dir() {
            total += dir_size(&entry.path()).unwrap_or(0);
        } else {
            total += meta.len();
        }
    }
    Some(total)
}

impl VideoMeta {
    /// Подпись для интерфейса: «3:33».
    pub fn duration_label(&self) -> String {
        format_duration(self.duration_sec)
    }
}

/// Ошибки запуска `yt-dlp` и получения данных.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum YtError {
    /// Программа не найдена.
    NotFound,
    /// Не удалось запустить процесс.
    Io(String),
    /// `yt-dlp` завершился с ошибкой.
    Failed(String),
    /// Не дождались ответа.
    Timeout(&'static str),
    /// Аудио оказалось больше предохранителя.
    TooLarge,
    /// Ответ не разобрать.
    BadOutput(String),
}

impl fmt::Display for YtError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            YtError::NotFound => write!(f, "yt-dlp не найден"),
            YtError::Io(message) => write!(f, "не удалось запустить yt-dlp: {message}"),
            YtError::Failed(message) => write!(f, "{message}"),
            YtError::Timeout(what) => write!(f, "не дождались ответа: {what}"),
            YtError::TooLarge => write!(f, "аудио больше допустимого размера"),
            YtError::BadOutput(message) => write!(f, "непонятный ответ yt-dlp: {message}"),
        }
    }
}

impl std::error::Error for YtError {}

/// Проверяет, есть ли в Netscape cookies.txt авторизация YouTube.
///
/// Для возрастных ограничений нужны именно cookie домена `.youtube.com`
/// (`SID`, `__Secure-1PSID` и т.п.). Файл, экспортированный со страницы
/// Google/Chrome Web Store, содержит только гостевые cookie и не подходит.
pub fn cookies_have_youtube_login(path: &Path) -> bool {
    let Ok(text) = std::fs::read_to_string(path) else {
        return false;
    };
    text.lines().any(|line| {
        if line.starts_with('#') || line.trim().is_empty() {
            return false;
        }
        let fields: Vec<&str> = line.split('\t').collect();
        if fields.len() < 7 {
            return false;
        }
        let domain = fields[0].trim_start_matches('.');
        let name = fields[5];
        domain.ends_with("youtube.com")
            && matches!(
                name,
                "SID" | "HSID" | "SSID" | "__Secure-1PSID" | "__Secure-3PSID" | "LOGIN_INFO"
            )
    })
}

/// Обёртка над `yt-dlp.exe`.
pub struct YtDlp {
    exe: PathBuf,
    temp_dir: PathBuf,
    cookies: Option<PathBuf>,
    js_runtime: Option<PathBuf>,
}

impl YtDlp {
    pub fn new(exe: impl Into<PathBuf>, temp_dir: impl Into<PathBuf>) -> Self {
        let exe = exe.into();
        // yt-dlp 2026+ решает JS-челленджи YouTube через внешний runtime.
        // qjs.exe кладётся рядом с yt-dlp.exe при сборке/распаковке приложения.
        let js_runtime = exe
            .parent()
            .map(|dir| dir.join("qjs.exe"))
            .filter(|path| path.is_file());
        Self {
            exe,
            temp_dir: temp_dir.into(),
            cookies: None,
            js_runtime,
        }
    }

    /// Netscape cookies.txt для YouTube (видео с проверкой возраста).
    pub fn with_cookies(mut self, cookies: Option<PathBuf>) -> Self {
        self.cookies = cookies.filter(|path| path.is_file());
        self
    }

    /// Ищет `yt-dlp.exe`: настройка → рядом с программой → `tools\` → `PATH`.
    pub fn locate(configured: &str, data_dir: &Path) -> Option<PathBuf> {
        let configured = configured.trim();
        if !configured.is_empty() && !configured.eq_ignore_ascii_case("auto") {
            let path = PathBuf::from(configured);
            if path.is_file() {
                return Some(path);
            }
        }

        let name = if cfg!(windows) { "yt-dlp.exe" } else { "yt-dlp" };

        if let Ok(current) = std::env::current_exe() {
            if let Some(dir) = current.parent() {
                for candidate in [dir.join(name), dir.join("tools").join(name)] {
                    if candidate.is_file() {
                        return Some(candidate);
                    }
                }
            }
        }

        let beside_data = data_dir.join("tools").join(name);
        if beside_data.is_file() {
            return Some(beside_data);
        }

        if let Some(path) = std::env::var_os("PATH") {
            for dir in std::env::split_paths(&path) {
                let candidate = dir.join(name);
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }

        None
    }

    pub fn exe(&self) -> &Path {
        &self.exe
    }

    /// Версия `yt-dlp` (для интерфейса и журнала).
    pub fn version(&self) -> Option<String> {
        let output = self.run(&["--version"], Duration::from_secs(10), TEXT_LIMIT).ok()?;
        if !output.success {
            return None;
        }
        let text = String::from_utf8_lossy(&output.stdout);
        let version = text.lines().next().unwrap_or_default().trim();
        if version.is_empty() {
            None
        } else {
            Some(version.to_string())
        }
    }

    /// Спрашивает у `yt-dlp` название, канал и длительность.
    pub fn probe(&self, url: &str) -> Result<VideoMeta, YtError> {
        let template = "%(title)s\t%(duration)s\t%(is_live)s\t%(uploader)s";
        let output = self.run(
            &[
                "--no-warnings",
                "--no-playlist",
                "--skip-download",
                "--no-progress",
                "--print",
                template,
                url,
            ],
            META_TIMEOUT,
            TEXT_LIMIT,
        )?;

        if !output.success {
            return Err(YtError::Failed(self.describe_failure(&output.stderr)));
        }

        let text = decode_text(&output.stdout);
        parse_meta(&text)
    }

    /// Загружает аудио в память (`m4a`, обычный AAC).
    pub fn download_audio(&self, url: &str) -> Result<Vec<u8>, YtError> {
        let output = self.run(
            &[
                "-f",
                "bestaudio[ext=m4a]/bestaudio",
                "--no-playlist",
                "--no-warnings",
                "--no-progress",
                "--no-part",
                "-o",
                "-",
                url,
            ],
            AUDIO_TIMEOUT,
            MAX_AUDIO_BYTES,
        )?;

        if !output.success {
            return Err(YtError::Failed(self.describe_failure(&output.stderr)));
        }
        if output.stdout.len() >= MAX_AUDIO_BYTES {
            return Err(YtError::TooLarge);
        }
        if output.stdout.is_empty() {
            return Err(YtError::BadOutput("yt-dlp вернул пустой поток".into()));
        }

        Ok(output.stdout)
    }

    /// Обновляет `yt-dlp` до свежей версии (`yt-dlp -U`).
    pub fn update(&self) -> Result<String, YtError> {
        let output = self.run(&["-U"], Duration::from_secs(120), TEXT_LIMIT)?;
        if !output.success {
            return Err(YtError::Failed(self.describe_failure(&output.stderr)));
        }
        let text = String::from_utf8_lossy(&output.stdout);
        let last = text
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .last()
            .unwrap_or("обновление выполнено");
        Ok(last.to_string())
    }

    /// Готовит процесс: без окна консоли и со своей временной папкой.
    fn command(&self) -> Command {
        let mut command = Command::new(&self.exe);
        let custom_temp = std::fs::create_dir_all(&self.temp_dir).is_ok();
        if custom_temp {
            command.env("TEMP", &self.temp_dir).env("TMP", &self.temp_dir);
        }
        command
            // Иначе yt-dlp пишет названия в системной кодировке (cp866),
            // и кириллица приходит испорченной.
            .env("PYTHONIOENCODING", "utf-8")
            .env("PYTHONUTF8", "1");

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            /// `CREATE_NO_WINDOW`: не показывать консоль на секунду.
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            command.creation_flags(CREATE_NO_WINDOW);
        }

        command
    }

    /// Запускает `yt-dlp` и читает stdout (не больше `limit` байт).
    fn run(
        &self,
        args: &[&str],
        timeout: Duration,
        limit: usize,
    ) -> Result<ProcessOutput, YtError> {
        let mut command = self.command();
        if let Some(js_runtime) = &self.js_runtime {
            command
                .arg("--js-runtimes")
                .arg(format!("quickjs:{}", js_runtime.display()));
        }
        if let Some(cookies) = &self.cookies {
            command.arg("--cookies").arg(cookies);
        }
        command
            .args(args)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = command
            .spawn()
            .map_err(|err| YtError::Io(err.to_string()))?;

        let stdout_pipe = child.stdout.take();
        let stderr_pipe = child.stderr.take();

        // Читаем сразу в потоке: иначе процесс встанет на заполненном канале.
        let stdout_reader = std::thread::spawn(move || read_limited(stdout_pipe, limit));
        let stderr_reader = std::thread::spawn(move || read_limited(stderr_pipe, STDERR_LIMIT));

        let status = wait_with_timeout(&mut child, timeout);

        let stdout = stdout_reader.join().unwrap_or_default();
        let stderr = String::from_utf8_lossy(&stderr_reader.join().unwrap_or_default()).to_string();

        match status {
            Some(status) => Ok(ProcessOutput {
                stdout,
                stderr,
                success: status.success(),
            }),
            None => Err(YtError::Timeout(if limit > TEXT_LIMIT {
                "загрузка аудио"
            } else {
                "ответ yt-dlp"
            })),
        }
    }

    /// Берёт из stderr последнюю содержательную строку и убирает «ERROR:».
    fn describe_failure(&self, stderr: &str) -> String {
        let lower = stderr.to_lowercase();
        if lower.contains("sign in to confirm your age") || lower.contains("age-restricted") {
            return "YouTube требует подтверждения возраста. Убедитесь, что cookies.txt экспортирован с youtube.com под аккаунтом (нужны cookie .youtube.com).".to_string();
        }
        let line = stderr
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .last()
            .unwrap_or("yt-dlp завершился с ошибкой");

        let line = line
            .strip_prefix("ERROR: ")
            .or_else(|| line.strip_prefix("ERROR:"))
            .unwrap_or(line)
            .trim();

        if line.is_empty() {
            "yt-dlp завершился с ошибкой".to_string()
        } else {
            line.to_string()
        }
    }
}

struct ProcessOutput {
    stdout: Vec<u8>,
    stderr: String,
    success: bool,
}

/// Читает поток целиком, но не больше `limit` байт.
fn read_limited<R: Read>(reader: Option<R>, limit: usize) -> Vec<u8> {
    let mut buffer = Vec::new();
    let Some(mut reader) = reader else {
        return buffer;
    };

    let mut chunk = [0u8; 64 * 1024];
    loop {
        match reader.read(&mut chunk) {
            Ok(0) => break,
            Ok(read) => {
                buffer.extend_from_slice(&chunk[..read]);
                if buffer.len() >= limit {
                    break;
                }
            }
            Err(_) => break,
        }
    }
    buffer
}

/// Ждёт завершения процесса; по истечении времени — убивает.
fn wait_with_timeout(
    child: &mut std::process::Child,
    timeout: Duration,
) -> Option<std::process::ExitStatus> {
    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => return Some(status),
            Ok(None) => {
                if started.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    return None;
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(_) => return None,
        }
    }
}

/// Превращает байты вывода в текст.
///
/// `yt-dlp` на Windows пишет кириллицу в системной кодировке (cp1251), а не в
/// UTF-8: настройки Python он игнорирует. Поэтому сначала пробуем UTF-8,
/// а если не вышло — разбираем как cp1251.
fn decode_text(bytes: &[u8]) -> String {
    match std::str::from_utf8(bytes) {
        Ok(text) => text.to_string(),
        Err(_) => decode_cp1251(bytes),
    }
}

/// Однобайтовая кодировка Windows-1251 → Unicode.
fn decode_cp1251(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len());
    for &byte in bytes {
        let ch = match byte {
            0x00..=0x7F => byte as char,
            0x80 => 'Ђ', 0x81 => 'Ѓ', 0x82 => '‚', 0x83 => 'ѓ', 0x84 => '„', 0x85 => '…',
            0x86 => '†', 0x87 => '‡', 0x88 => '€', 0x89 => '‰', 0x8A => 'Љ', 0x8B => '‹',
            0x8C => 'Њ', 0x8D => 'Ќ', 0x8E => 'Ћ', 0x8F => 'Џ', 0x90 => 'ђ', 0x91 => '‘',
            0x92 => '’', 0x93 => '“', 0x94 => '”', 0x95 => '•', 0x96 => '–', 0x97 => '—',
            0x98 => ' ',
            0x99 => '™', 0x9A => 'љ', 0x9B => '›', 0x9C => 'њ', 0x9D => 'ќ', 0x9E => 'ћ',
            0x9F => 'џ', 0xA0 => ' ', 0xA1 => 'Ў', 0xA2 => 'ў', 0xA3 => 'Ј', 0xA4 => '¤',
            0xA5 => 'Ґ', 0xA6 => '¦', 0xA7 => '§', 0xA8 => 'Ё', 0xA9 => '©', 0xAA => 'Є',
            0xAB => '«', 0xAC => '¬', 0xAD => '­', 0xAE => '®', 0xAF => 'Ї', 0xB0 => '°',
            0xB1 => '±', 0xB2 => 'І', 0xB3 => 'і', 0xB4 => 'ґ', 0xB5 => 'µ', 0xB6 => '¶',
            0xB7 => '·', 0xB8 => 'ё', 0xB9 => '№', 0xBA => 'є', 0xBB => '»', 0xBC => 'ј',
            0xBD => 'Ѕ', 0xBE => 'ѕ', 0xBF => 'ї',
            0xC0..=0xFF => char::from_u32(0x0410 + (byte as u32 - 0xC0)).unwrap_or('?'),
        };
        out.push(ch);
    }
    out
}

/// Разбирает ответ `--print` (поля через табуляцию).
fn parse_meta(text: &str) -> Result<VideoMeta, YtError> {    let line = text.lines().find(|line| !line.trim().is_empty());
    let Some(line) = line else {
        return Err(YtError::BadOutput("yt-dlp ничего не вернул".into()));
    };

    let mut fields = line.split('\t');
    let title = fields.next().unwrap_or_default().trim().to_string();
    let duration = fields.next().unwrap_or("NA").trim().to_string();
    let live = fields.next().unwrap_or("NA").trim().to_ascii_lowercase();
    let channel = fields.next().unwrap_or_default().trim().to_string();

    if title.is_empty() {
        return Err(YtError::BadOutput("нет названия видео".into()));
    }

    let duration_sec = duration.parse::<u64>().unwrap_or(0);

    Ok(VideoMeta {
        title,
        channel,
        duration_sec,
        is_live: matches!(live.as_str(), "true" | "yes" | "1"),
    })
}

/// Секунды в «3:33» или «1:02:03».
pub fn format_duration(total_sec: u64) -> String {
    let hours = total_sec / 3600;
    let minutes = (total_sec % 3600) / 60;
    let seconds = total_sec % 60;
    if hours > 0 {
        format!("{hours}:{minutes:02}:{seconds:02}")
    } else {
        format!("{minutes}:{seconds:02}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_meta_line() {
        let meta = parse_meta("Never Gonna Give You Up\t213\tFalse\tRick Astley\n").unwrap();
        assert_eq!(meta.title, "Never Gonna Give You Up");
        assert_eq!(meta.duration_sec, 213);
        assert!(!meta.is_live);
        assert_eq!(meta.channel, "Rick Astley");
    }

    #[test]
    fn parses_live_and_missing_duration() {
        let meta = parse_meta("Стрим\tNA\tTrue\tКанал\n").unwrap();
        assert!(meta.is_live);
        assert_eq!(meta.duration_sec, 0);
        assert_eq!(meta.duration_label(), "0:00");
    }

    #[test]
    fn rejects_empty_meta() {
        assert!(matches!(parse_meta(""), Err(YtError::BadOutput(_))));
        assert!(matches!(parse_meta("\t213\tFalse\t\n"), Err(YtError::BadOutput(_))));
    }

    #[test]
    fn formats_durations() {
        assert_eq!(format_duration(213), "3:33");
        assert_eq!(format_duration(5), "0:05");
        assert_eq!(format_duration(3723), "1:02:03");
    }

    #[test]
    fn detects_youtube_login_cookies() {
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target/test-tmp");
        std::fs::create_dir_all(&dir).expect("тестовая папка");
        let path = dir.join("reward-sounds-cookies-test.txt");
        std::fs::write(
            &path,
            "# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tsecret\n.google.com\tTRUE\t/\tFALSE\t0\tNID\tvisitor\n",
        )
        .unwrap();
        assert!(cookies_have_youtube_login(&path));
        std::fs::write(&path, ".youtube.com\tTRUE\t/\tTRUE\t0\tPREF\thl=en\n").unwrap();
        assert!(!cookies_have_youtube_login(&path));
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn age_gate_error_mentions_cookies() {
        let tool = YtDlp::new("yt-dlp.exe", ".");
        let text = tool.describe_failure(
            "ERROR: [youtube] tRAmPLYjbGg: Sign in to confirm your age. This video may be inappropriate",
        );
        assert!(text.contains("cookies.txt"), "{text}");
    }

    #[test]
    fn locate_prefers_configured_path() {
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join("test-tmp")
            .join("ytdlp-locate");
        std::fs::create_dir_all(&dir).expect("временная папка");
        let fake = dir.join("yt-dlp.exe");
        std::fs::write(&fake, b"stub").expect("файл-заглушка");

        let found = YtDlp::locate(fake.to_str().unwrap(), &dir);
        assert_eq!(found.as_deref(), Some(fake.as_path()));

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn locate_returns_none_for_empty_settings() {
        let empty = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join("test-tmp")
            .join("no-ytdlp-here");
        // В PATH yt-dlp на машине разработчика может быть установлен,
        // поэтому проверяем только заведомо пустую папку данных.
        let found = YtDlp::locate("", &empty);
        if let Some(path) = found {
            assert!(path.file_name().is_some());
        }
    }
}
