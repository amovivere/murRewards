//! Проверка очереди: несколько ссылок → проверка → очередь → воспроизведение.
//!
//! Запуск:
//! ```text
//! cargo run --example music_queue -- <ссылка1> <ссылка2> ... [путь к yt-dlp.exe]
//! ```
//!
//! Каждый трек играет ~1 секунду, затем перематывается к концу — так проверяется
//! вся цепочка (очередь, предзагрузка, «сыграно»), не проигрывая всё целиком.

use std::time::{Duration, Instant};

use reward_sounds::config::AppPaths;
use reward_sounds::music::{
    links, ItemState, Player, Prefetch, Prefetched, Queue, QueueItem, YtDlp,
};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let (inputs, ytdlp_arg) = split_args(args);

    if inputs.is_empty() {
        eprintln!("использование: music_queue <ссылка1> <ссылка2> ... [путь к yt-dlp.exe]");
        std::process::exit(2);
    }

    let paths = AppPaths::resolve();
    let Some(exe) = YtDlp::locate(&ytdlp_arg, &paths.data_dir) else {
        eprintln!("yt-dlp не найден");
        std::process::exit(1);
    };
    let temp_dir = paths.data_dir.join("tmp");
    let _ = std::fs::create_dir_all(&temp_dir);
    let yt = YtDlp::new(&exe, &temp_dir);

    // Заявки приходят с разным временем активации — очередь должна их упорядочить.
    let mut queue = Queue::new(10, 480);
    for (index, input) in inputs.iter().enumerate() {
        let link = match links::parse(input) {
            Ok(link) => link,
            Err(err) => {
                println!("ссылка «{input}» не принята: {}", err.message());
                continue;
            }
        };

        let meta = match yt.probe(&link.url) {
            Ok(meta) => meta,
            Err(err) => {
                println!("{}: метаданные не получены: {err}", link.video_id);
                continue;
            }
        };
        if meta.is_live {
            println!("{}: прямой эфир — пропускаем", link.video_id);
            continue;
        }

        let mut item = QueueItem::new(
            format!("redemption-{index}"),
            &link.video_id,
            &link.url,
            format!("viewer{index}"),
            format!("2026-11-14T10:00:0{index}Z"),
        );
        item.apply_meta(&meta);

        match queue.push(item) {
            Ok(()) => println!(
                "принято: «{}» · {} · {}",
                meta.title,
                meta.channel,
                meta.duration_label()
            ),
            Err(reject) => println!("отказ: {}", reject.message()),
        }
    }

    println!("\nочередь ({}):", queue.pending());
    for (position, item) in queue.items().iter().enumerate() {
        println!(
            "  {}. «{}» · @{} · {}",
            position + 1,
            item.label(),
            item.user_login,
            item.state.label()
        );
    }
    println!();

    let player = Player::spawn(0.7);
    let mut prefetch = Prefetch::new();

    while let Some(item) = queue.take_next() {
        println!("--- старт: «{}» (@{})", item.label(), item.user_login);

        let bytes = match prefetch.take(&item.video_id) {
            Some(ready) => {
                println!("  из предзагрузки: {} байт", ready.bytes.len());
                ready.bytes
            }
            None => match yt.download_audio(&item.url) {
                Ok(bytes) => {
                    println!("  загружено: {} байт", bytes.len());
                    bytes
                }
                Err(err) => {
                    println!("  ошибка загрузки: {err}");
                    queue.fail(&item.redemption_id, err.to_string());
                    continue;
                }
            },
        };

        if let Err(err) = player.play(bytes, item.duration_sec) {
            println!("  плеер: {err}");
            queue.fail(&item.redemption_id, err);
            continue;
        }

        // Пока трек играет — заранее тянем следующий.
        if let Some(next) = queue
            .items()
            .iter()
            .find(|candidate| candidate.state == ItemState::Queued)
        {
            match yt.download_audio(&next.url) {
                Ok(bytes) => {
                    let ready = Prefetched {
                        video_id: next.video_id.clone(),
                        bytes,
                        duration_sec: next.duration_sec,
                    };
                    if prefetch.store(ready) {
                        println!("  предзагрузка следующей: «{}»", next.label());
                    }
                }
                Err(err) => println!("  предзагрузка не удалась: {err}"),
            }
        }

        // Проверяем конец трека, не проигрывая его целиком.
        std::thread::sleep(Duration::from_millis(900));
        let target = item.duration_sec.saturating_sub(3);
        if let Err(err) = player.seek(target) {
            println!("  перемотка: {err}");
        }

        let deadline = Instant::now() + Duration::from_secs(20);
        let mut finished = false;
        while Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(200));
            let state = player.state();
            if state.finished {
                finished = true;
                break;
            }
            if let Some(err) = state.error.clone() {
                println!("  ошибка плеера: {err}");
                queue.fail(&item.redemption_id, err);
                break;
            }
        }

        if finished {
            println!("  сыграно: {}", player.state().time_label());
            queue.complete(&item.redemption_id, ItemState::Done);
        } else {
            println!("  конец не дождались");
            queue.complete(&item.redemption_id, ItemState::Skipped);
        }
    }

    player.stop().ok();
    println!("\nитог: сыграно {}, в очереди {}",
        queue.items().iter().filter(|item| item.state == ItemState::Done).count(),
        queue.pending()
    );
}

/// Последний аргумент считаем путём к yt-dlp, если он похож на путь к файлу.
fn split_args(args: Vec<String>) -> (Vec<String>, String) {
    let mut inputs = args;
    let mut ytdlp = String::new();
    if let Some(last) = inputs.last() {
        if last.to_ascii_lowercase().ends_with(".exe") {
            ytdlp = inputs.pop().unwrap_or_default();
        }
    }
    (inputs, ytdlp)
}
