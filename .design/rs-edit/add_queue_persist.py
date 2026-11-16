# -*- coding: utf-8 -*-
"""Сохранение и восстановление очереди музыки."""
import pathlib

ROOT = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src")
service = ROOT / "music" / "service.rs"
app = ROOT / "app.rs"

s = service.read_text(encoding="utf-8")


def sub_once(text: str, old: str, new: str) -> str:
    assert old in text, "NOT FOUND: " + old[:100]
    return text.replace(old, new, 1)


# Config: флаг восстановления.
s = sub_once(
    s,
    """    /// Сколько секунд показывать строку в оверлее.
    pub overlay_seconds: u64,
""",
    """    /// Восстанавливать очередь после перезапуска.
    pub restore_queue: bool,
    /// Сколько секунд показывать строку в оверлее.
    pub overlay_seconds: u64,
""",
)
s = sub_once(
    s,
    """            pause_yandex: true,
            channel: String::new(),
            overlay_seconds: 10,
""",
    """            pause_yandex: true,
            channel: String::new(),
            restore_queue: true,
            overlay_seconds: 10,
""",
)

# Восстановление очереди после вычисления data_dir.
s = sub_once(
    s,
    """    let mut exe = YtDlp::locate(&ytdlp_path, &data_dir);
""",
    """    let queue_file = data_dir.join("queue.json");
    if config.restore_queue {
        let mut restored = Queue::load(&queue_file);
        restored.set_limits(config.max_queue, config.max_duration_sec);
        let pending = restored.pending();
        if pending > 0 {
            log::info!("Музыка: восстановлена очередь заявок ({pending})");
        }
        queue = restored;
    }
    let mut exe = YtDlp::locate(&ytdlp_path, &data_dir);
""",
)

# Сохранение в ключевых точках изменения очереди.
save_after = [
    (
        """                        let _ = events.send(MusicEvent::Queued {
                            redemption_id,
                            title,
                            position,
                        });
""",
        """                        let _ = events.send(MusicEvent::Queued {
                            redemption_id,
                            title,
                            position,
                        });
                        persist_queue(&queue, &queue_file, config.restore_queue);
""",
    ),
    (
        """                if clear_queue_mode_placeholder {
""",
        "",
    ),
]

# Универсальные замены по уникальным фрагментам.
s = sub_once(
    s,
    """                for redemption_id in removed {
                    queue.remove(&redemption_id);
                    // Баллы за удалённые заявки возвращаем: CANCELED в Twitch.
                    let _ = events.send(MusicEvent::Skipped {
                        redemption_id,
                    });
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
                persist_queue(&queue, &queue_file, config.restore_queue);
""",
)
s = sub_once(
    s,
    """                    let _ = events.send(MusicEvent::Skipped {
                        redemption_id: item.redemption_id,
                    });
                }
            }
            Ok(Cmd::ClearQueue) => {
""",
    """                    let _ = events.send(MusicEvent::Skipped {
                        redemption_id: item.redemption_id,
                    });
                    persist_queue(&queue, &queue_file, config.restore_queue);
                }
            }
            Ok(Cmd::ClearQueue) => {
""",
)
s = sub_once(
    s,
    """                } else {
                    queue.remove(&redemption_id);
                    // Вернуть баллы и за удалённую из очереди заявку.
                    let _ = events.send(MusicEvent::Skipped { redemption_id });
                }
""",
    """                } else {
                    queue.remove(&redemption_id);
                    // Вернуть баллы и за удалённую из очереди заявку.
                    let _ = events.send(MusicEvent::Skipped { redemption_id });
                }
                persist_queue(&queue, &queue_file, config.restore_queue);
""",
)
s = sub_once(
    s,
    """            Ok(Cmd::MoveUp(redemption_id)) => {
                queue.move_up(&redemption_id);
            }
""",
    """            Ok(Cmd::MoveUp(redemption_id)) => {
                if queue.move_up(&redemption_id) {
                    persist_queue(&queue, &queue_file, config.restore_queue);
                }
            }
""",
)
s = sub_once(
    s,
    """                    let _ = queue.push(copy);
                }
            }
            Err(RecvTimeoutError::Timeout) => {}
""",
    """                    let _ = queue.push(copy);
                    persist_queue(&queue, &queue_file, config.restore_queue);
                }
            }
            Err(RecvTimeoutError::Timeout) => {}
""",
)
s = sub_once(
    s,
    """                queue.complete(&item.redemption_id, ItemState::Done);
                // Сбрасываем плеер: ползунок не должен оставаться на прошлом треке.
                player.stop().ok();
""",
    """                queue.complete(&item.redemption_id, ItemState::Done);
                persist_queue(&queue, &queue_file, config.restore_queue);
                // Сбрасываем плеер: ползунок не должен оставаться на прошлом треке.
                player.stop().ok();
""",
)
s = sub_once(
    s,
    """            } else if let Some(error) = player_state.error.clone() {
                queue.fail(&item.redemption_id, error.clone());
""",
    """            } else if let Some(error) = player_state.error.clone() {
                queue.fail(&item.redemption_id, error.clone());
                persist_queue(&queue, &queue_file, config.restore_queue);
""",
)
s = sub_once(
    s,
    """                let _ = events.send(MusicEvent::Started {
                    redemption_id,
                    title,
                });
""",
    """                let _ = events.send(MusicEvent::Started {
                    redemption_id,
                    title,
                });
                persist_queue(&queue, &queue_file, config.restore_queue);
""",
)
s = sub_once(
    s,
    """    player.stop().ok();
    log::info!("Музыка: служба остановлена");
""",
    """    persist_queue(&queue, &queue_file, config.restore_queue);
    player.stop().ok();
    log::info!("Музыка: служба остановлена");
""",
)

# Free-функция сохранения.
s = s.replace(
    "/// Пишет в журнал, найден ли `yt-dlp`.",
    """/// Сохраняет очередь на диск (если восстановление включено).
fn persist_queue(queue: &Queue, path: &Path, enabled: bool) {
    if !enabled {
        return;
    }
    if let Err(err) = queue.save(path) {
        log::warn!("Музыка: не удалось сохранить очередь: {err}");
    }
}

/// Пишет в журнал, найден ли `yt-dlp`.""",
    1,
)
assert "fn persist_queue(" in s
service.write_text(s, encoding="utf-8")
print("service queue persistence added")

# app: конфиг музыки получает флаг.
a = app.read_text(encoding="utf-8")
a = a.replace(
    """            pause_yandex: settings.music.pause_yandex,
            channel: settings.twitch.login.clone(),
            overlay_seconds: settings.music.overlay_seconds,
""",
    """            pause_yandex: settings.music.pause_yandex,
            channel: settings.twitch.login.clone(),
            restore_queue: settings.music.restore_queue,
            overlay_seconds: settings.music.overlay_seconds,
""",
)
a = a.replace(
    """            pause_yandex: self.settings.music.pause_yandex,
            channel: self.settings.twitch.login.clone(),
            overlay_seconds: self.settings.music.overlay_seconds,
""",
    """            pause_yandex: self.settings.music.pause_yandex,
            channel: self.settings.twitch.login.clone(),
            restore_queue: self.settings.music.restore_queue,
            overlay_seconds: self.settings.music.overlay_seconds,
""",
)
app.write_text(a, encoding="utf-8")
print("app config patched")
