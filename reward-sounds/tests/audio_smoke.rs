//! Проверка реального аудиоконвейера: открытие устройства вывода,
//! декодирование WAV, наложение звуков и остановка воспроизведения.
//!
//! Тесты создают короткие WAV-файлы во временной папке и играют их через
//! тот же движок, что использует приложение. Если в системе нет устройства
//! вывода (например, на сервере сборки), тест аккуратно пропускается.

use std::path::PathBuf;
use std::time::{Duration, Instant};

use reward_sounds::audio::AudioEngine;

/// Записывает простой WAV (16 бит, моно, 44.1 кГц) с синусоидой.
fn write_wav(path: &std::path::Path, seconds: f32) {
    let sample_rate: u32 = 44_100;
    let samples = (sample_rate as f32 * seconds) as u32;
    let data_len = samples * 2;

    let mut data = Vec::with_capacity(44 + data_len as usize);
    data.extend_from_slice(b"RIFF");
    data.extend_from_slice(&(36 + data_len).to_le_bytes());
    data.extend_from_slice(b"WAVEfmt ");
    data.extend_from_slice(&16u32.to_le_bytes());
    data.extend_from_slice(&1u16.to_le_bytes()); // PCM
    data.extend_from_slice(&1u16.to_le_bytes()); // моно
    data.extend_from_slice(&sample_rate.to_le_bytes());
    data.extend_from_slice(&(sample_rate * 2).to_le_bytes());
    data.extend_from_slice(&2u16.to_le_bytes());
    data.extend_from_slice(&16u16.to_le_bytes());
    data.extend_from_slice(b"data");
    data.extend_from_slice(&data_len.to_le_bytes());

    for i in 0..samples {
        let t = i as f32 / sample_rate as f32;
        let value = (t * 440.0 * std::f32::consts::TAU).sin() * 0.2;
        data.extend_from_slice(&((value * i16::MAX as f32) as i16).to_le_bytes());
    }

    std::fs::write(path, data).expect("не удалось записать тестовый WAV");
}

/// Отдельная временная папка на каждый тест (тесты идут параллельно).
fn temp_wav(name: &str, seconds: f32) -> PathBuf {
    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("target")
        .join("audio-test")
        .join(name);
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("tone.wav");
    write_wav(&path, seconds);
    path
}

fn wait_until(timeout: Duration, mut check: impl FnMut() -> bool) -> bool {
    let started = Instant::now();
    while started.elapsed() < timeout {
        if check() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    check()
}

/// Ждёт, пока устройство вывода откроется. Возвращает false, если звука в системе нет.
fn wait_for_device(engine: &AudioEngine) -> bool {
    wait_until(Duration::from_secs(6), || {
        let status = engine.snapshot();
        status.device.is_some() || !engine.take_errors().is_empty()
    });
    engine.snapshot().device.is_some()
}

/// Удаляет временную папку теста.
fn cleanup(wav: &std::path::Path) {
    if let Some(dir) = wav.parent() {
        let _ = std::fs::remove_dir_all(dir);
    }
}

fn active_count(engine: &AudioEngine, id: &str) -> usize {
    engine
        .snapshot()
        .active
        .iter()
        .filter(|active| active.as_str() == id)
        .count()
}

#[test]
fn engine_plays_and_stops_real_audio() {
    let wav = temp_wav("play-stop", 3.0);
    let engine = AudioEngine::spawn();

    if !wait_for_device(&engine) {
        eprintln!("Пропуск: устройство вывода звука недоступно в этой системе");
        return;
    }

    engine
        .play("test-sound", wav.clone(), 0.25)
        .expect("команда воспроизведения не отправилась");

    let started = wait_until(Duration::from_secs(4), || {
        active_count(&engine, "test-sound") == 1
    });
    assert!(started, "звук не начал воспроизводиться");

    engine.stop_all().expect("команда остановки не отправилась");
    let stopped = wait_until(Duration::from_secs(4), || {
        engine.snapshot().active.is_empty()
    });
    assert!(stopped, "звук не остановился по команде");
    cleanup(&wav);
}

/// Главная проверка требования: одна и та же награда, активированная
/// несколькими зрителями, звучит одновременно, накладываясь сама на себя.
#[test]
fn same_sound_overlaps_itself() {
    let wav = temp_wav("overlap", 5.0);
    let engine = AudioEngine::spawn();

    if !wait_for_device(&engine) {
        eprintln!("Пропуск: устройство вывода звука недоступно в этой системе");
        return;
    }

    for _ in 0..3 {
        engine
            .play("dup", wav.clone(), 0.15)
            .expect("команда воспроизведения не отправилась");
    }

    wait_until(Duration::from_secs(5), || active_count(&engine, "dup") == 3);
    let count = active_count(&engine, "dup");
    assert_eq!(
        count, 3,
        "три копии одного звука должны играть одновременно, а играет {count}"
    );

    // «Остановить» у звука должен выключить все его копии сразу.
    engine.stop("dup").expect("команда остановки не отправилась");
    let stopped = wait_until(Duration::from_secs(4), || active_count(&engine, "dup") == 0);
    assert!(stopped, "не все копии звука остановились");
    cleanup(&wav);
}

#[test]
fn engine_reports_missing_file() {
    let engine = AudioEngine::spawn();
    if !wait_for_device(&engine) {
        eprintln!("Пропуск: устройство вывода звука недоступно в этой системе");
        return;
    }

    let missing = std::env::temp_dir().join("reward-sounds-no-such-file-12345.mp3");
    let _ = std::fs::remove_file(&missing);

    engine
        .play("missing", missing, 0.3)
        .expect("команда должна отправиться в аудиопоток");

    let got_error = wait_until(Duration::from_secs(4), || !engine.take_errors().is_empty());
    assert!(got_error, "ожидалось сообщение об ошибке открытия файла");
}

#[test]
fn playback_plays_sound_for_bound_reward() {
    use std::sync::{Arc, Mutex};

    use reward_sounds::config::Settings;
    use reward_sounds::eventsub::Redemption;
    use reward_sounds::playback::{Playback, PlaybackState};

    let wav = temp_wav("playback", 1.0);
    let engine = AudioEngine::spawn();
    if !wait_for_device(&engine) {
        eprintln!("Пропуск: устройство вывода звука недоступно в этой системе");
        return;
    }

    let mut settings = Settings::default();
    settings.set_reward_sound("reward-1", "Награда", wav.to_str().unwrap());
    let state = Arc::new(Mutex::new(PlaybackState::default()));
    state.lock().unwrap().sync(&settings);

    let playback = Playback::new(engine.clone(), Arc::clone(&state));
    playback.play(&Redemption {
        redemption_id: "redemption-1".to_string(),
        reward_id: "reward-1".to_string(),
        reward_title: "Награда".to_string(),
        user_login: "viewer".to_string(),
        user_input: String::new(),
        redeemed_at: "2026-11-14T10:00:01Z".to_string(),
    });

    let playing = wait_until(Duration::from_secs(4), || !engine.snapshot().active.is_empty());
    assert!(playing, "звук награды должен запуститься без участия интерфейса");

    let _ = engine.stop_all();
    cleanup(&wav);
}

#[test]
fn measures_loudness_of_generated_wav() {
    let wav = temp_wav("loudness", 1.0);

    let loudness = reward_sounds::audio::measure_loudness(&wav)
        .expect("громкость тестового WAV должна измеряться");
    assert!(
        loudness.rms > 0.05 && loudness.rms < 0.3,
        "неожиданный RMS: {}",
        loudness.rms
    );
    assert!(loudness.peak <= 1.0);

    let volume = reward_sounds::audio::normalization_volume(
        loudness,
        reward_sounds::audio::NORMALIZE_TARGET_RMS,
    );
    assert!((0.2..=2.0).contains(&volume), "громкость вне диапазона: {volume}");

    cleanup(&wav);
}
