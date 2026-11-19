//! Проверка службы треков: заявки → проверка → очередь → воспроизведение.
//!
//! Запуск:
//! ```text
//! cargo run --example music_service -- [путь к yt-dlp.exe]
//! ```
//!
//! Служба получает три «активации награды» (две настоящие ссылки и одну
//! из Яндекс Музыки), играет по одной и переключается по команде «пропустить»,
//! чтобы не слушать треки целиком.

use std::time::{Duration, Instant};

use reward_sounds::config::AppPaths;
use reward_sounds::music::{Config, MusicEvent, MusicService};

fn main() {
    let ytdlp_arg = std::env::args().nth(1).unwrap_or_default();

    let paths = AppPaths::resolve();
    let temp_dir = paths.data_dir.join("tmp");
    let _ = std::fs::create_dir_all(&temp_dir);

    let config = Config {
        enabled: true,
        reward_id: "test-reward".to_string(),
        max_queue: 10,
        max_duration_sec: 480,
        volume: 0.7,
        pause_yandex: false,
        request_cooldown_sec: 0,
        blocked_videos: Vec::new(),
        channel: String::new(),
        restore_queue: false,
        overlay_seconds: 10,
        overlay_position: "top".to_string(),
        overlay_font: 17,
        cookies_file: String::new(),
    };

    let service = MusicService::spawn(config, ytdlp_arg, temp_dir);
    println!("служба запущена");

    service.request(
        "redemption-1",
        "viewer0",
        "вот трек https://youtu.be/9bZkp7q19f0",
        "2026-11-14T10:00:01Z",
    );
    service.request(
        "redemption-2",
        "viewer1",
        "https://youtu.be/dQw4w9WgXcQ",
        "2026-11-14T10:00:02Z",
    );
    service.request(
        "redemption-3",
        "viewer2",
        "https://music.yandex.ru/album/43177815/track/153919218",
        "2026-11-14T10:00:03Z",
    );

    let started_at = Instant::now();
    let mut started_count = 0usize;
    let mut skip_at: Option<Instant> = None;
    let mut next_report = Instant::now() + Duration::from_secs(3);

    loop {
        for event in service.poll_events() {
            match &event {
                MusicEvent::Queued {
                    redemption_id,
                    title,
                    position,
                } => println!("[+] {redemption_id}: «{title}» в очереди (позиция {position})"),
                MusicEvent::Started {
                    redemption_id,
                    title,
                } => {
                    started_count += 1;
                    println!("[▶] {redemption_id}: «{title}»");
                    // Слушаем по 5 секунд, потом переходим дальше.
                    skip_at = Some(Instant::now() + Duration::from_secs(5));
                }
                MusicEvent::Finished { redemption_id } => {
                    println!("[✓] {redemption_id}: сыграно до конца")
                }
                MusicEvent::Rejected {
                    redemption_id,
                    reason,
                } => println!("[✗] {redemption_id}: отказ — {reason}"),
                MusicEvent::Failed {
                    redemption_id,
                    reason,
                } => println!("[!] {redemption_id}: ошибка — {reason}"),
                MusicEvent::Skipped { redemption_id, .. } => {
                    println!("[→] {redemption_id}: пропущено")
                }
            }
        }

        if let Some(deadline) = skip_at {
            if Instant::now() >= deadline {
                service.skip("демо-пропуск");
                skip_at = None;
            }
        }

        if Instant::now() >= next_report {
            next_report = Instant::now() + Duration::from_secs(3);
            let snapshot = service.snapshot();
            match &snapshot.current {
                Some(item) => println!(
                    "    играет «{}» · {} · в очереди {} · в памяти {:?}",
                    item.label(),
                    snapshot.player.time_label(),
                    snapshot.pending().saturating_sub(1),
                    snapshot.prefetched
                ),
                None => println!(
                    "    пауза · в очереди {} · yt-dlp {:?}",
                    snapshot.pending(),
                    snapshot.ytdlp_version
                ),
            }
        }

        let idle = service.snapshot().current.is_none() && service.snapshot().pending() == 0;
        if started_count >= 2 && idle {
            break;
        }
        if started_at.elapsed() > Duration::from_secs(120) {
            println!("стоп по таймауту");
            break;
        }

        std::thread::sleep(Duration::from_millis(150));
    }

    println!("\nитоговое состояние очереди:");
    for item in service.snapshot().items {
        println!(
            "  {:<14} «{}» · @{} · {}",
            item.redemption_id,
            item.label(),
            item.user_login,
            item.state.label()
        );
    }
}
