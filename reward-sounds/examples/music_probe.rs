//! Проверка пайплайна «ссылка → метаданные → аудио в память».
//!
//! Запуск (путь к `yt-dlp.exe` берётся из `YTDLP_PATH` или второго аргумента):
//!
//! ```text
//! cargo run --example music_probe -- https://youtu.be/dQw4w9WgXcQ
//! cargo run --example music_probe -- https://youtu.be/dQw4w9WgXcQ D:\tools\yt-dlp.exe
//! ```
//!
//! Пример ничего не играет и ничего не сохраняет: он показывает, что ссылка
//! разбирается, `yt-dlp` отвечает и аудио действительно приходит в память.

use std::path::PathBuf;
use std::time::Instant;

use reward_sounds::config::AppPaths;
use reward_sounds::music::{links, YtDlp};

fn main() {
    let mut args = std::env::args().skip(1);
    let input = args.next().unwrap_or_default();
    let ytdlp_arg = args
        .next()
        .or_else(|| std::env::var("YTDLP_PATH").ok())
        .unwrap_or_default();

    if input.trim().is_empty() {
        eprintln!("использование: music_probe <ссылка> [путь к yt-dlp.exe]");
        std::process::exit(2);
    }

    let link = match links::parse(&input) {
        Ok(link) => link,
        Err(err) => {
            eprintln!("ссылка не принята: {}", err.message());
            std::process::exit(1);
        }
    };
    println!("видео: {} · {}", link.video_id, link.url);

    let paths = AppPaths::resolve();
    let Some(exe) = YtDlp::locate(&ytdlp_arg, &paths.data_dir) else {
        eprintln!(
            "yt-dlp не найден. Положите yt-dlp.exe рядом с программой или укажите путь вторым аргументом"
        );
        std::process::exit(1);
    };

    let temp_dir = paths.data_dir.join("tmp");
    let _ = std::fs::create_dir_all(&temp_dir);
    let yt = YtDlp::new(&exe, &temp_dir);

    println!("yt-dlp: {}", exe.display());
    match yt.version() {
        Some(version) => println!("версия: {version}"),
        None => println!("версия: не определилась"),
    }

    let started = Instant::now();
    let meta = match yt.probe(&link.url) {
        Ok(meta) => meta,
        Err(err) => {
            eprintln!("метаданные не получены: {err}");
            std::process::exit(1);
        }
    };
    println!(
        "метаданные за {} мс: «{}» · {} · {} · live={}",
        started.elapsed().as_millis(),
        meta.title,
        meta.channel,
        meta.duration_label(),
        meta.is_live
    );

    let started = Instant::now();
    let audio = match yt.download_audio(&link.url) {
        Ok(audio) => audio,
        Err(err) => {
            eprintln!("аудио не загрузилось: {err}");
            std::process::exit(1);
        }
    };
    println!(
        "аудио за {} мс: {} ({})",
        started.elapsed().as_millis(),
        reward_sounds::util::format_size(audio.len() as u64),
        audio.len()
    );

    let head: Vec<String> = audio
        .iter()
        .take(12)
        .map(|byte| format!("{byte:02x}"))
        .collect();
    println!("первые байты: {}", head.join(" "));
    println!(
        "контейнер MP4: {}",
        audio.windows(4).take(64).any(|window| window == b"ftyp")
    );

    symphonia_probe(&audio);

    // Ничего не сохраняем: буфер живёт только внутри этого процесса.
    let temp: PathBuf = temp_dir;
    println!("временная папка yt-dlp: {}", temp.display());
}

/// Проверяет, читает ли symphonia поток напрямую (без обёртки rodio)
/// и умеет ли перематывать.
fn symphonia_probe(audio: &[u8]) {
    use symphonia::core::codecs::DecoderOptions;
    use symphonia::core::errors::Error as SError;
    use symphonia::core::formats::{FormatOptions, SeekMode, SeekTo};
    use symphonia::core::io::MediaSourceStream;
    use symphonia::core::meta::MetadataOptions;
    use symphonia::core::probe::Hint;
    use symphonia::core::units::Time;

    let source = MediaSourceStream::new(
        Box::new(std::io::Cursor::new(audio.to_vec())),
        Default::default(),
    );
    let mut hint = Hint::new();
    hint.with_extension("m4a");

    let probed = match symphonia::default::get_probe().format(
        &hint,
        source,
        &FormatOptions::default(),
        &MetadataOptions::default(),
    ) {
        Ok(probed) => probed,
        Err(err) => {
            println!("symphonia: формат не открылся: {err}");
            return;
        }
    };

    let mut format = probed.format;
    let Some(track) = format.default_track() else {
        println!("symphonia: нет дорожек");
        return;
    };
    let track_id = track.id;
    let params = track.codec_params.clone();
    println!(
        "symphonia: дорожка {track_id} · кодек {:?} · {} Гц · кадров {:?} · база времени {:?}",
        params.codec, params.sample_rate.unwrap_or(0), params.n_frames, params.time_base
    );

    let mut decoder = match symphonia::default::get_codecs()
        .make(&params, &DecoderOptions::default())
    {
        Ok(decoder) => decoder,
        Err(err) => {
            println!("symphonia: декодер не создался: {err}");
            return;
        }
    };

    let mut packets = 0usize;
    let mut frames = 0usize;
    let mut first_error = None;
    loop {
        match format.next_packet() {
            Ok(packet) => match decoder.decode(&packet) {
                Ok(buffer) => {
                    packets += 1;
                    frames += buffer.frames();
                    if packets >= 40 {
                        break;
                    }
                }
                Err(SError::DecodeError(err)) => {
                    first_error = Some(format!("ошибка декодирования: {err}"));
                    break;
                }
                Err(SError::IoError(err)) => {
                    first_error = Some(format!("ошибка ввода-вывода: {err}"));
                    break;
                }
                Err(err) => {
                    first_error = Some(format!("{err}"));
                    break;
                }
            },
            Err(err) => {
                first_error = Some(format!("пакеты кончились: {err}"));
                break;
            }
        }
    }
    println!(
        "symphonia: декодировано пакетов {packets}, кадров {frames}{}",
        first_error
            .map(|err| format!(" · {err}"))
            .unwrap_or_default()
    );

    let target = SeekTo::Time {
        time: Time {
            seconds: 60,
            frac: 0.0,
        },
        track_id: Some(track_id),
    };
    match format.seek(SeekMode::Accurate, target) {
        Ok(seeked) => println!("symphonia: перемотка на 60 с удалась (кадр {})", seeked.required_ts),
        Err(err) => println!("symphonia: перемотка не удалась: {err}"),
    }
}
