//! Аудиодвижок.
//!
//! Устройство вывода звука в Windows (WASAPI) нельзя создавать на UI-потоке:
//! объект не является «перемещаемым» между потоками. Поэтому здесь используется
//! отдельный фоновый поток:
//!
//! * интерфейс отправляет ему команды по каналу (`play`, `stop`, `volume`);
//! * поток держит открытым аудиовыход и микширует все одновременные звуки;
//! * статус (устройство, что играет, ошибки) отдаётся в UI через `Arc<Mutex<..>>`.
//!
//! Такая схема не блокирует интерфейс даже при проблемах со звуком и позволяет
//! воспроизводить несколько наград одновременно.

use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, Source};

/// Форматы, которые поддерживает приложение.
pub const SUPPORTED_EXTENSIONS: [&str; 4] = ["mp3", "wav", "ogg", "flac"];

/// Идентификатор тестового сигнала (не показывается как звук наград).
pub const TEST_TONE_ID: &str = "__tone__";

/// Похоже ли расширение файла на поддерживаемый аудиоформат.
pub fn is_supported_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            SUPPORTED_EXTENSIONS
                .iter()
                .any(|known| known.eq_ignore_ascii_case(ext))
        })
        .unwrap_or(false)
}

/// Человеческое название формата: `mp3` -> `MP3`.
pub fn format_label(path: &Path) -> String {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_uppercase())
        .unwrap_or_else(|| "ФАЙЛ".to_string())
}

/// Понятное сообщение, если формат не поддерживается.
pub fn unsupported_format_message(path: &Path) -> String {
    let ext = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_uppercase())
        .unwrap_or_else(|| "без расширения".to_string());
    format!(
        "Формат «{ext}» не поддерживается. Reward Sounds играет MP3, WAV, OGG и FLAC."
    )
}

/// Длительность звукового файла в секундах (для подписи на карточке).
///
/// Декодер читает заголовок и оценивает длительность; для VBR-MP3 возможна
/// погрешность в доли секунды — для интерфейса этого достаточно. Файл не
/// загружается в память целиком, поэтому вызов дешёвый, но его всё равно
/// стоит кэшировать при отрисовке списка.
pub fn probe_duration_sec(path: &Path) -> Option<u64> {
    let file = std::fs::File::open(path).ok()?;
    let decoder = Decoder::new(std::io::BufReader::new(file)).ok()?;
    let duration = decoder.total_duration()?;
    let secs = duration.as_secs();
    if secs == 0 {
        None
    } else {
        Some(secs)
    }
}

/// Измеренная громкость файла.
#[derive(Debug, Clone, Copy)]
pub struct Loudness {
    /// Среднеквадратичный уровень (0.0–1.0).
    pub rms: f32,
    /// Пиковый уровень (0.0–1.0).
    pub peak: f32,
}

impl Loudness {
    /// Уровень RMS в дБFS (отрицательное число).
    pub fn rms_db(&self) -> f32 {
        20.0 * self.rms.max(1e-6).log10()
    }
}

/// Считает RMS и пик аудиофайла, чтобы выровнять громкость звуков.
pub fn measure_loudness(path: &Path) -> Result<Loudness, String> {
    let file = std::fs::File::open(path)
        .map_err(|err| format!("Не удалось открыть файл: {err}"))?;
    let decoder = Decoder::new(std::io::BufReader::new(file))
        .map_err(|err| format!("Не удалось прочитать аудио: {err}"))?;

    let mut sum = 0.0_f64;
    let mut count = 0_u64;
    let mut peak = 0.0_f32;

    for sample in decoder {
        let value = sample as f32 / i16::MAX as f32;
        sum += (value as f64) * (value as f64);
        count += 1;
        peak = peak.max(value.abs());
    }

    if count == 0 {
        return Err("Файл не содержит звука".to_string());
    }

    Ok(Loudness {
        rms: (sum / count as f64).sqrt() as f32,
        peak,
    })
}

/// Подбирает множитель громкости, чтобы звук сравнялся с целевым уровнем.
///
/// Учитывается пик: громкость не поднимается до клиппинга.
pub fn normalization_volume(loudness: Loudness, target_rms: f32) -> f32 {
    let gain = target_rms.max(1e-4) / loudness.rms.max(1e-5);
    let peak_limit = 0.98 / loudness.peak.max(1e-5);
    gain.min(peak_limit).clamp(0.2, 2.0)
}

/// Целевой уровень для выравнивания (примерно −18 дБFS).
pub const NORMALIZE_TARGET_RMS: f32 = 0.125;

/// Текущее состояние аудиодвижка (снимок для интерфейса).
#[derive(Debug, Clone, Default)]
pub struct Status {
    /// Название устройства вывода, если оно открыто.
    pub device: Option<String>,
    /// Идентификаторы звуков, которые играют прямо сейчас.
    pub active: Vec<String>,
}

impl Status {
    pub fn is_ready(&self) -> bool {
        self.device.is_some()
    }
}

enum Cmd {
    Play {
        id: String,
        path: PathBuf,
        volume: f32,
    },
    Tone {
        volume: f32,
    },
    StopId(String),
    StopAll,
    SetVolume(f32),
    SetIdVolume {
        id: String,
        volume: f32,
    },
    /// Переоткрыть устройство вывода (кнопка «Перезапустить аудио» в настройках).
    Restart,
}

/// Публичный интерфейс аудиодвижка.
#[derive(Clone)]
pub struct AudioEngine {
    tx: Sender<Cmd>,
    status: Arc<Mutex<Status>>,
    errors: Arc<Mutex<Vec<String>>>,
}

impl AudioEngine {
    /// Запускает аудиопоток и открывает устройство вывода по умолчанию.
    pub fn spawn() -> Self {
        let (tx, rx) = mpsc::channel();
        let status = Arc::new(Mutex::new(Status::default()));
        let errors: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));

        let thread_status = Arc::clone(&status);
        let thread_errors = Arc::clone(&errors);

        let spawn_result = thread::Builder::new()
            .name("reward-sounds-audio".to_string())
            .spawn(move || run(rx, thread_status, thread_errors));

        if let Err(err) = spawn_result {
            log::error!("Не удалось запустить аудиопоток: {err}");
            if let Ok(mut errors) = errors.lock() {
                errors.push("Не удалось запустить аудиопоток. Перезапустите приложение.".into());
            }
        }

        Self { tx, status, errors }
    }

    /// Проигрывает файл. Ошибки чтения/декодирования придут через [`Self::take_errors`].
    pub fn play(&self, id: &str, path: PathBuf, volume: f32) -> Result<(), String> {
        self.send(Cmd::Play {
            id: id.to_string(),
            path,
            volume,
        })
    }

    /// Короткий тестовый сигнал для проверки устройства вывода.
    pub fn play_test_tone(&self, volume: f32) -> Result<(), String> {
        self.send(Cmd::Tone { volume })
    }

    /// Останавливает все копии звука с этим идентификатором.
    pub fn stop(&self, id: &str) -> Result<(), String> {
        self.send(Cmd::StopId(id.to_string()))
    }

    /// Останавливает всё, что звучит прямо сейчас.
    pub fn stop_all(&self) -> Result<(), String> {
        self.send(Cmd::StopAll)
    }

    /// Переоткрывает устройство вывода: помогает, если звук «пропал» после
    /// смены устройства или проблем с драйвером. Играющие звуки остановятся.
    pub fn restart(&self) -> Result<(), String> {
        self.send(Cmd::Restart)
    }

    /// Изменяет громкость уже играющих звуков и запоминает её для новых.
    pub fn set_volume(&self, volume: f32) -> Result<(), String> {
        self.send(Cmd::SetVolume(volume))
    }

    /// Изменяет громкость только одного звука (все его копии).
    ///
    /// Нужно, чтобы ползунок на карточке награды слышно менял звук,
    /// который играет прямо сейчас.
    pub fn set_id_volume(&self, id: &str, volume: f32) -> Result<(), String> {
        self.send(Cmd::SetIdVolume {
            id: id.to_string(),
            volume,
        })
    }

    pub fn snapshot(&self) -> Status {
        self.status
            .lock()
            .map(|status| status.clone())
            .unwrap_or_default()
    }

    /// Забирает накопившиеся ошибки воспроизведения (по одной на звук).
    pub fn take_errors(&self) -> Vec<String> {
        match self.errors.lock() {
            Ok(mut errors) => std::mem::take(&mut *errors),
            Err(_) => Vec::new(),
        }
    }

    fn send(&self, cmd: Cmd) -> Result<(), String> {
        self.tx.send(cmd).map_err(|_| {
            "Аудиодвижок не отвечает. Нажмите «Перезапустить аудио» в настройках.".to_string()
        })
    }
}

impl Drop for AudioEngine {
    fn drop(&mut self) {
        // Закрываем канал: аудиопоток завершится и освободит устройство.
        let (tx, _rx) = mpsc::channel();
        let _ = std::mem::replace(&mut self.tx, tx);
    }
}

fn run(
    rx: Receiver<Cmd>,
    status: Arc<Mutex<Status>>,
    errors: Arc<Mutex<Vec<String>>>,
) {
    let (stream, mut handle) = match OutputStream::try_default() {
        Ok(pair) => pair,
        Err(err) => {
            log::error!("Не удалось открыть устройство вывода звука: {err}");
            push_error(
                &errors,
                format!(
                    "Не удалось открыть устройство вывода звука. Проверьте, что колонки или наушники подключены. (Детали: {err})"
                ),
            );
            return;
        }
    };

    let mut device_name = default_device_name().unwrap_or_else(|| "Устройство по умолчанию".to_string());
    log::info!("Аудиовыход открыт: {device_name}");
    set_device(&status, Some(device_name.clone()));

    let mut stream = Some(stream);
    let mut sinks: Vec<(String, Sink)> = Vec::new();
    let mut last_device_check = Instant::now();

    loop {
        // Убираем завершившиеся звуки и обновляем статус для интерфейса.
        let mut changed = false;
        // Следим за текущим устройством вывода Windows: если пользователь
        // переключил его в системе, переоткрываем поток на новом устройстве.
        if last_device_check.elapsed() >= Duration::from_secs(5) {
            last_device_check = Instant::now();
            if let Some(current) = default_device_name() {
                if current != device_name {
                    log::info!("Аудиовыход Windows изменился: {current}");
                    for (_, sink) in &sinks {
                        sink.stop();
                    }
                    sinks.clear();
                    drop(stream.take());

                    match OutputStream::try_default() {
                        Ok((new_stream, new_handle)) => {
                            stream = Some(new_stream);
                            handle = new_handle;
                            device_name = current;
                            set_device(&status, Some(device_name.clone()));
                            log::info!("Аудиовыход переключён на {device_name}");
                        }
                        Err(err) => {
                            log::error!("Не удалось переключить аудиовыход: {err}");
                            set_device(&status, None);
                            push_error(
                                &errors,
                                format!("Не удалось переключить устройство вывода звука: {err}"),
                            );
                        }
                    }
                    changed = true;
                }
            }
        }

        let before = sinks.len();
        sinks.retain(|(id, sink)| {
            let alive = !sink.empty();
            if !alive {
                log::debug!("Воспроизведение завершено: id={id}");
            }
            alive
        });
        if sinks.len() != before {
            changed = true;
        }

        match rx.recv_timeout(Duration::from_millis(120)) {
            Ok(Cmd::Play {
                id,
                path,
                volume: requested_volume,
            }) => {
                #[cfg(test)]
                capture::record(&id, requested_volume);
                match play_file(&handle, &path, requested_volume) {
                    Ok(sink) => {
                        log::info!(
                            "Играет звук: {} (id={id}, громкость {:.0}%)",
                            path.display(),
                            requested_volume * 100.0
                        );
                        sinks.push((id, sink));
                        changed = true;
                    }
                    Err(message) => {
                        log::error!("{message}");
                        push_error(&errors, message);
                    }
                }
            }
            Ok(Cmd::Tone {
                volume: requested_volume,
            }) => match play_tone(&handle, requested_volume) {
                Ok(sink) => {
                    sinks.push((TEST_TONE_ID.to_string(), sink));
                    changed = true;
                }
                Err(message) => {
                    log::error!("{message}");
                    push_error(&errors, message);
                }
            },
            Ok(Cmd::StopId(id)) => {
                // Один и тот же звук может играть несколько раз одновременно
                // (несколько зрителей активировали награду) — останавливаем все копии.
                let mut stopped = 0;
                sinks.retain(|(sink_id, sink)| {
                    if sink_id == &id {
                        sink.stop();
                        stopped += 1;
                        false
                    } else {
                        true
                    }
                });
                if stopped > 0 {
                    log::info!("Остановлен звук id={id} (копий: {stopped})");
                    changed = true;
                }
            }
            Ok(Cmd::StopAll) => {
                log::info!("Остановлены все звуки ({} шт.)", sinks.len());
                for (_, sink) in &sinks {
                    sink.stop();
                }
                sinks.clear();
                changed = true;
            }
            Ok(Cmd::SetVolume(new_volume)) => {
                for (_, sink) in &sinks {
                    sink.set_volume(new_volume);
                }
            }
            Ok(Cmd::SetIdVolume { id, volume }) => {
                for (sink_id, sink) in &sinks {
                    if sink_id == &id {
                        sink.set_volume(volume);
                    }
                }
            }
            Ok(Cmd::Restart) => {
                log::info!("Перезапуск аудиовыхода по запросу пользователя");
                for (_, sink) in &sinks {
                    sink.stop();
                }
                sinks.clear();
                drop(stream.take());
                match OutputStream::try_default() {
                    Ok((new_stream, new_handle)) => {
                        stream = Some(new_stream);
                        handle = new_handle;
                        device_name = default_device_name()
                            .unwrap_or_else(|| "Устройство по умолчанию".to_string());
                        set_device(&status, Some(device_name.clone()));
                        log::info!("Аудиовыход перезапущен: {device_name}");
                    }
                    Err(err) => {
                        set_device(&status, None);
                        log::error!("Не удалось перезапустить аудиовыход: {err}");
                        push_error(
                            &errors,
                            format!("Не удалось перезапустить аудиовыход: {err}"),
                        );
                    }
                }
                changed = true;
            }
            Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) => {
                log::info!("Аудиодвижок остановлен");
                break;
            }
        }

        if changed {
            update_active(&status, &sinks);
        }
    }

    drop(stream);
    set_device(&status, None);
}

fn play_file(handle: &OutputStreamHandle, path: &Path, volume: f32) -> Result<Sink, String> {
    let name = crate::util::file_name(path);

    let file = std::fs::File::open(path)
        .map_err(|err| format!("Не удалось открыть файл «{name}»: {err}"))?;

    let decoder = Decoder::new(std::io::BufReader::new(file))
        .map_err(|err| format!("Не удалось прочитать аудиофайл «{name}»: {err}"))?;

    let sink = Sink::try_new(handle).map_err(|err| format!("Не удалось создать аудиопоток: {err}"))?;
    sink.set_volume(volume);
    sink.append(decoder);
    Ok(sink)
}

fn play_tone(handle: &OutputStreamHandle, volume: f32) -> Result<Sink, String> {
    let sink = Sink::try_new(handle).map_err(|err| format!("Не удалось создать аудиопоток: {err}"))?;
    sink.set_volume(volume * 0.6);
    let tone = rodio::source::SineWave::new(880.0)
        .take_duration(Duration::from_millis(450))
        .amplify(0.3);
    sink.append(tone);
    log::info!("Проверка аудиовыхода: тестовый сигнал 880 Гц");
    Ok(sink)
}

fn update_active(status: &Arc<Mutex<Status>>, sinks: &[(String, Sink)]) {
    if let Ok(mut status) = status.lock() {
        status.active = sinks.iter().map(|(id, _)| id.clone()).collect();
    }
}

fn set_device(status: &Arc<Mutex<Status>>, device: Option<String>) {
    if let Ok(mut status) = status.lock() {
        status.device = device;
    }
}

fn push_error(errors: &Arc<Mutex<Vec<String>>>, message: String) {
    if let Ok(mut errors) = errors.lock() {
        errors.push(message);
        // Не даём списку расти бесконечно.
        if errors.len() > 32 {
            errors.remove(0);
        }
    }
}

/// Название устройства вывода Windows по умолчанию.
fn default_device_name() -> Option<String> {
    use rodio::cpal::traits::HostTrait;
    use rodio::DeviceTrait;

    let host = rodio::cpal::default_host();
    let device = host.default_output_device()?;
    device.name().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalization_boosts_quiet_sounds() {
        let quiet = Loudness {
            rms: 0.02,
            peak: 0.05,
        };
        let volume = normalization_volume(quiet, NORMALIZE_TARGET_RMS);
        assert!(volume > 1.0, "тихий звук должен усиливаться: {volume}");
    }

    #[test]
    fn normalization_lowers_loud_sounds() {
        let loud = Loudness {
            rms: 0.5,
            peak: 0.95,
        };
        let volume = normalization_volume(loud, NORMALIZE_TARGET_RMS);
        assert!(volume < 0.5, "громкий звук должен приглушаться: {volume}");
    }

    #[test]
    fn normalization_respects_peak_limit() {
        let peaked = Loudness {
            rms: 0.05,
            peak: 0.99,
        };
        let volume = normalization_volume(peaked, NORMALIZE_TARGET_RMS);
        assert!(
            volume * peaked.peak <= 1.0,
            "громкость не должна приводить к клиппингу: {volume}"
        );
    }

    #[test]
    fn normalization_stays_in_reasonable_range() {
        for (rms, peak) in [(0.0001, 0.0001), (1.0, 1.0), (0.125, 0.5)] {
            let volume = normalization_volume(Loudness { rms, peak }, NORMALIZE_TARGET_RMS);
            assert!((0.2..=2.0).contains(&volume), "{volume}");
        }
    }

    #[test]
    fn rms_db_is_negative_for_normal_levels() {
        let loudness = Loudness {
            rms: 0.125,
            peak: 0.5,
        };
        let db = loudness.rms_db();
        assert!((db + 18.0).abs() < 0.5, "ожидалось около −18 дБFS: {db}");
    }
}

/// Запись запрошенной громкости в тестах: проверяем, что до аудиопотока
/// доходит именно та громкость, которую посчитали настройки.
#[cfg(test)]
pub(crate) mod capture {
    use std::sync::{Mutex, OnceLock};
    use std::time::{Duration, Instant};

    fn store() -> &'static Mutex<Vec<(String, f32)>> {
        static STORE: OnceLock<Mutex<Vec<(String, f32)>>> = OnceLock::new();
        STORE.get_or_init(|| Mutex::new(Vec::new()))
    }

    pub fn reset() {
        if let Ok(mut values) = store().lock() {
            values.clear();
        }
    }

    pub fn record(id: &str, volume: f32) {
        if let Ok(mut values) = store().lock() {
            values.push((id.to_string(), volume));
        }
    }

    /// Ждёт запрос на воспроизведение с указанным id и возвращает громкость.
    pub fn wait_for(id: &str, timeout: Duration) -> Option<f32> {
        let started = Instant::now();
        loop {
            if let Ok(values) = store().lock() {
                if let Some((_, volume)) = values.iter().rev().find(|(saved, _)| saved == id) {
                    return Some(*volume);
                }
            }
            if started.elapsed() >= timeout {
                return None;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
    }
}
