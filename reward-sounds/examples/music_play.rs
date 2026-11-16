//! Проверка воспроизведения: ссылка → метаданные → аудио в память → звук.
//!
//! Запуск:
//! ```text
//! cargo run --example music_play -- https://youtu.be/dQw4w9WgXcQ [путь к yt-dlp.exe]
//! ```
//!
//! Пример играет трек ~3 секунды, перематывает к концу и ждёт, пока плеер
//! сообщит об окончании. Так проверяются старт, перемотка и определение конца,
//! не проигрывая три с половиной минуты.

use std::time::Duration;

use reward_sounds::config::AppPaths;
use reward_sounds::music::{links, Player, YtDlp};

fn main() {
    let mut args = std::env::args().skip(1);
    let input = args.next().unwrap_or_default();
    let ytdlp_arg = args
        .next()
        .or_else(|| std::env::var("YTDLP_PATH").ok())
        .unwrap_or_default();

    if input.trim().is_empty() {
        eprintln!("использование: music_play <ссылка> [путь к yt-dlp.exe]");
        std::process::exit(2);
    }

    let link = match links::parse(&input) {
        Ok(link) => link,
        Err(err) => {
            eprintln!("ссылка не принята: {}", err.message());
            std::process::exit(1);
        }
    };

    let paths = AppPaths::resolve();
    let Some(exe) = YtDlp::locate(&ytdlp_arg, &paths.data_dir) else {
        eprintln!("yt-dlp не найден");
        std::process::exit(1);
    };

    let temp_dir = paths.data_dir.join("tmp");
    let _ = std::fs::create_dir_all(&temp_dir);
    let yt = YtDlp::new(&exe, &temp_dir);

    println!("видео: {}", link.url);
    let meta = match yt.probe(&link.url) {
        Ok(meta) => meta,
        Err(err) => {
            eprintln!("метаданные: {err}");
            std::process::exit(1);
        }
    };
    println!(
        "«{}» · {} · {}",
        meta.title,
        meta.channel,
        meta.duration_label()
    );

    let audio = match yt.download_audio(&link.url) {
        Ok(audio) => audio,
        Err(err) => {
            eprintln!("аудио: {err}");
            std::process::exit(1);
        }
    };
    println!("загружено: {} байт", audio.len());

    let player = Player::spawn(0.7);
    if let Err(err) = player.play(audio, meta.duration_sec) {
        eprintln!("плеер: {err}");
        std::process::exit(1);
    }

    // Даём треку зазвучать и смотрим состояние.
    std::thread::sleep(Duration::from_secs(3));
    let state = player.state();
    println!(
        "через 3 с: загружен={} пауза={} позиция={} · {}",
        state.loaded,
        state.paused,
        state.time_label(),
        bar(state.progress())
    );
    if let Some(err) = state.error.clone() {
        eprintln!("ошибка плеера: {err}");
    }

    // Перематываем почти к концу: проверяем seek и определение конца.
    let target = meta.duration_sec.saturating_sub(5);
    println!("перемотка на {target} с");
    if let Err(err) = player.seek(target) {
        eprintln!("перемотка: {err}");
    }

    let deadline = std::time::Instant::now() + Duration::from_secs(15);
    let mut finished = false;
    while std::time::Instant::now() < deadline {
        std::thread::sleep(Duration::from_millis(500));
        let state = player.state();
        if state.finished {
            println!("конец трека: позиция {} {}", state.time_label(), bar(state.progress()));
            finished = true;
            break;
        }
        if state.error.is_some() {
            break;
        }
    }

    if !finished {
        let state = player.state();
        println!(
            "конец не дождались: позиция {} пауза={} ошибка={:?}",
            state.time_label(),
            state.paused,
            state.error
        );
    }

    player.stop().ok();
    std::thread::sleep(Duration::from_millis(300));
}

/// Полоса прогресса для консоли: `[###-------]`.
fn bar(progress: f32) -> String {
    let filled = (progress.clamp(0.0, 1.0) * 10.0).round() as usize;
    format!("[{}{}]", "#".repeat(filled), "-".repeat(10 - filled))
}
