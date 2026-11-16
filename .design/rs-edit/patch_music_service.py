# -*- coding: utf-8 -*-
"""Музыка: ручная очередь, оверлей, возвраты, PONG, уборка _MEI."""
import pathlib

ROOT = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src")
service = ROOT / "music" / "service.rs"
chat = ROOT / "music" / "chat.rs"
ytdlp = ROOT / "music" / "ytdlp.rs"

s = service.read_text(encoding="utf-8")


def sub_once(text: str, old: str, new: str) -> str:
    assert old in text, "NOT FOUND: " + old[:100]
    return text.replace(old, new, 1)


# --- Cmd: ручная заявка ---
s = sub_once(
    s,
    """    Request {
        redemption_id: String,
        user_login: String,
        user_input: String,
        redeemed_at: String,
    },
""",
    """    Request {
        redemption_id: String,
        user_login: String,
        user_input: String,
        redeemed_at: String,
    },
    /// Ручная заявка из интерфейса: без активации на Twitch и без баллов.
    Manual {
        user_input: String,
    },
""",
)

# --- методы сервиса ---
s = sub_once(
    s,
    """    pub fn skip(&self) {
        let _ = self.tx.send(Cmd::Skip);
    }
""",
    """    /// Ручная заявка из интерфейса: проверить ссылку и поставить в очередь
    /// без активации награды (для проверки музыки и тестов).
    pub fn add_manual(&self, url: &str) {
        let _ = self.tx.send(Cmd::Manual {
            user_input: url.to_string(),
        });
    }

    /// Показать строку «Сейчас играет» в оверлее ещё раз.
    pub fn show_overlay(&self) {
        let _ = self.tx.send(Cmd::ChatCommand);
    }

    pub fn skip(&self) {
        let _ = self.tx.send(Cmd::Skip);
    }
""",
)

# --- обработчик ручной заявки ---
s = sub_once(
    s,
    """            Ok(Cmd::Validated(Ok(item))) => {
""",
    """            Ok(Cmd::Manual { user_input }) => {
                if !config.enabled {
                    log::warn!("Музыка: ручная заявка при выключенной вкладке");
                } else if version.is_none() {
                    log::warn!("Музыка: ручная заявка без yt-dlp");
                } else if !queue.has_room() {
                    log::warn!("Музыка: ручная заявка не влезла — очередь заполнена");
                } else {
                    match links::parse(&user_input) {
                        Ok(link) => {
                            let stamp = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .map(|d| d.as_millis())
                                .unwrap_or(0);
                            let item = QueueItem::new(
                                format!("manual-{stamp}"),
                                &link.video_id,
                                &link.url,
                                "manual",
                                stamp.to_string(),
                            );
                            if let Some(exe) = exe.clone() {
                                validating.insert(item.redemption_id.clone());
                                spawn_validate(exe, temp_dir.clone(), item, tx.clone());
                            }
                        }
                        Err(err) => log::warn!("Музыка: ручная ссылка не разобрана — {}", err.message()),
                    }
                }
            }
            Ok(Cmd::Validated(Ok(item))) => {
""",
)

# --- возвраты при очистке/удалении очереди ---
s = sub_once(
    s,
    """                for redemption_id in removed {
                    queue.remove(&redemption_id);
                }
                prefetch.clear();
""",
    """                for redemption_id in removed {
                    queue.remove(&redemption_id);
                    // Баллы за удалённые заявки возвращаем: CANCELED в Twitch.
                    let _ = events.send(MusicEvent::Skipped {
                        redemption_id,
                    });
                }
                prefetch.clear();
""",
)
s = sub_once(
    s,
    """                } else {
                    queue.remove(&redemption_id);
                }
            }
            Ok(Cmd::MoveUp(redemption_id)) => {
""",
    """                } else {
                    queue.remove(&redemption_id);
                    // Вернуть баллы и за удалённую из очереди заявку.
                    let _ = events.send(MusicEvent::Skipped { redemption_id });
                }
            }
            Ok(Cmd::MoveUp(redemption_id)) => {
""",
)

# --- overlay_seconds == 0: показывать, пока играет трек ---
s = sub_once(
    s,
    """    /// До какого момента показывать строку «Сейчас играет» в оверлее.
    let mut overlay_until: Option<std::time::Instant> = None;
""",
    """    /// До какого момента показывать строку «Сейчас играет» в оверлее.
    let mut overlay_until: Option<std::time::Instant> = None;
    /// Показывать оверлей всё время, пока играет текущий трек (настройка 0).
    let mut overlay_forever = false;
""",
)
s = sub_once(
    s,
    """            Ok(Cmd::ChatCommand) => {
                // Зритель попросил показать трек ещё раз.
                overlay_until =
                    Some(std::time::Instant::now() + std::time::Duration::from_secs(if config.overlay_seconds == 0 {
                        3600
                    } else {
                        config.overlay_seconds.max(1)
                    }));
            }
""",
    """            Ok(Cmd::ChatCommand) => {
                // Зритель или стример попросил показать трек ещё раз.
                if config.overlay_seconds == 0 {
                    overlay_forever = true;
                    overlay_until = None;
                } else {
                    overlay_forever = false;
                    overlay_until = Some(
                        std::time::Instant::now()
                            + std::time::Duration::from_secs(config.overlay_seconds.max(1)),
                    );
                }
            }
""",
)
s = sub_once(
    s,
    """                // Строка «Сейчас играет» показывается десять секунд после старта.
                overlay_until = Some(
                    std::time::Instant::now() + std::time::Duration::from_secs(if config.overlay_seconds == 0 {
                        3600
                    } else {
                        config.overlay_seconds.max(1)
                    }),
                );
""",
    """                // Строка «Сейчас играет» показывается заданное время после старта.
                // 0 — показывать всё время, пока играет трек.
                if config.overlay_seconds == 0 {
                    overlay_forever = true;
                    overlay_until = None;
                } else {
                    overlay_forever = false;
                    overlay_until = Some(
                        std::time::Instant::now()
                            + std::time::Duration::from_secs(config.overlay_seconds.max(1)),
                    );
                }
""",
)
s = sub_once(
    s,
    """            snapshot.overlay_ms = overlay_until
                .map(|until| {
                    until
                        .saturating_duration_since(std::time::Instant::now())
                        .as_millis() as u64
                })
                .unwrap_or(0);
""",
    """            snapshot.overlay_ms = if overlay_forever && current.is_some() {
                u64::MAX
            } else {
                overlay_until
                    .map(|until| {
                        until
                            .saturating_duration_since(std::time::Instant::now())
                            .as_millis() as u64
                    })
                    .unwrap_or(0)
            };
""",
)

# --- чат: переподключение при смене канала + уборка старых _MEI ---
s = sub_once(
    s,
    """    log_ytdlp(&version, &exe);
    super::chat::spawn(&config.channel, tx.clone());
""",
    """    log_ytdlp(&version, &exe);
    let mut chat_channel = config.channel.clone();
    super::chat::spawn(&chat_channel, tx.clone());
    // Старые распакованные каталоги PyInstaller от yt-dlp копятся в TEMP
    // после таймаутов: чистим их при старте службы.
    super::ytdlp::cleanup_stale_temp_dirs(&temp_dir);
""",
)
s = sub_once(
    s,
    """            Ok(Cmd::Configure(new_config)) => {
                config = *new_config;
                queue.set_limits(config.max_queue, config.max_duration_sec);
                player.set_volume(config.volume).ok();
            }
""",
    """            Ok(Cmd::Configure(new_config)) => {
                config = *new_config;
                queue.set_limits(config.max_queue, config.max_duration_sec);
                player.set_volume(config.volume).ok();
                // Twitch могли подключить уже после старта — тогда канал
                // появился только сейчас, и команда !трек должна заработать.
                if config.channel != chat_channel && !config.channel.trim().is_empty() {
                    chat_channel = config.channel.clone();
                    super::chat::spawn(&chat_channel, tx.clone());
                }
            }
""",
)

service.write_text(s, encoding="utf-8")
print("service patched")

# --- chat.rs: PONG и блокирующее чтение вместо ложных обрывов ---
CHAT = r'''//! Чтение чата Twitch без авторизации.
//!
//! Подключаемся к IRC анонимно (`justinfan…`): этого достаточно, чтобы видеть
//! сообщения канала, и не нужно токенов, ни новых прав у приложения.
//! Слушаем команду, которая заново показывает строку «Сейчас играет».
//!
//! Важно: Twitch присылает `PING` и ждёт `PONG`. Без ответа соединение
//! рвётся; раньше это выглядело как «обрыв каждые 10 минут» из-за своего
//! read-timeout. Теперь читаем блокирующе и отвечаем на keepalive.

use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::sync::mpsc::Sender;
use std::thread;
use std::time::Duration;

use super::service::Cmd;

/// Команды, которые показывают оверлей.
const COMMANDS: [&str; 2] = ["!трек", "!track"];

const SERVER: (&str, u16) = ("irc.chat.twitch.tv", 6667);

/// Запускает фоновое чтение чата канала.
pub fn spawn(channel: &str, tx: Sender<Cmd>) {
    let channel = channel.trim().to_lowercase();
    if channel.is_empty() {
        log::info!("Чат: канал не известен, команда !трек недоступна");
        return;
    }

    let spawned = thread::Builder::new()
        .name("music-chat".to_string())
        .spawn(move || loop {
            match TcpStream::connect(SERVER) {
                Ok(stream) => {
                    let Ok(mut writer) = stream.try_clone() else {
                        thread::sleep(Duration::from_secs(15));
                        continue;
                    };
                    let hello = format!(
                        "PASS SCHMOOPIIE\r\nNICK justinfan12345\r\nJOIN #{channel}\r\n"
                    );
                    let _ = writer.write_all(hello.as_bytes());

                    let reader = BufReader::new(stream);
                    for line in reader.lines().map_while(Result::ok) {
                        // Twitch присылает PING и ждёт PONG — иначе рвёт связь.
                        if line.starts_with("PING") {
                            let _ = writer.write_all(b"PONG :tmi.twitch.tv\r\n");
                            continue;
                        }
                        if !line.contains("PRIVMSG") {
                            continue;
                        }
                        let lower = line.to_lowercase();
                        if COMMANDS.iter().any(|command| lower.contains(command)) {
                            log::info!("Чат: команда показа оверлея");
                            let _ = tx.send(Cmd::ChatCommand);
                        }
                    }
                    log::warn!("Чат: соединение закрыто, переподключаемся");
                }
                Err(err) => {
                    log::warn!("Чат: не удалось подключиться ({err}), переподключаемся");
                }
            }
            thread::sleep(Duration::from_secs(15));
        });

    if let Err(err) = spawned {
        log::error!("Чат: не удалось запустить чтение: {err}");
    }
}
'''
chat.write_text(CHAT, encoding="utf-8")
print("chat rewritten")

# --- ytdlp.rs: уборка старых _MEI ---
y = ytdlp.read_text(encoding="utf-8")
anchor = "impl VideoMeta {"
cleanup = r'''/// Убирает старые каталоги PyInstaller (`_MEI*`), оставшиеся в TEMP
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

'''
assert anchor in y
y = y.replace(anchor, cleanup + anchor, 1)
ytdlp.write_text(y, encoding="utf-8")
print("ytdlp patched")
