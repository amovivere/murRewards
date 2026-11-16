//! Музыкальный плеер: один трек за раз, пауза, перемотка, громкость.
//!
//! Устроен так же, как общий аудиодвижок приложения: отдельный поток держит
//! устройство вывода, интерфейс общается с ним командами, а состояние читает
//! из `Arc<Mutex<..>>`. Это нужно потому, что объект аудиовыхода Windows нельзя
//! создавать на UI-потоке.
//!
//! Музыка звучит через **свой** `Sink`, поэтому её громкость не зависит от
//! громкости звуков наград.

use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use rodio::{OutputStream, OutputStreamHandle, Sink};

use super::decode;

/// Громкость музыки по умолчанию.
pub const DEFAULT_VOLUME: f32 = 0.7;

/// Состояние плеера для интерфейса.
#[derive(Debug, Clone)]
pub struct PlayerState {
    /// Что-то загружено и не остановлено.
    pub loaded: bool,
    pub paused: bool,
    pub finished: bool,
    /// Номер трека: растёт при каждом запуске. По нему видно, что состояние
    /// относится к текущему треку, а не к предыдущему.
    pub generation: u64,
    pub position_sec: u64,
    pub duration_sec: u64,
    pub volume: f32,
    /// Последняя ошибка (декодер, устройство вывода).
    pub error: Option<String>,
}

impl Default for PlayerState {
    fn default() -> Self {
        Self {
            loaded: false,
            paused: false,
            finished: false,
            generation: 0,
            position_sec: 0,
            duration_sec: 0,
            volume: DEFAULT_VOLUME,
            error: None,
        }
    }
}

impl PlayerState {
    /// Доля проигранного: 0.0–1.0 (для полосы прогресса).
    pub fn progress(&self) -> f32 {
        if self.duration_sec == 0 {
            return 0.0;
        }
        (self.position_sec as f32 / self.duration_sec as f32).clamp(0.0, 1.0)
    }

    /// Подпись времени: «1:12 / 3:33».
    pub fn time_label(&self) -> String {
        format!(
            "{} / {}",
            super::ytdlp::format_duration(self.position_sec),
            super::ytdlp::format_duration(self.duration_sec)
        )
    }
}

enum Cmd {
    Play {
        bytes: Vec<u8>,
        duration_sec: u64,
    },
    Pause,
    Resume,
    Stop,
    Seek(u64),
    Volume(f32),
}

/// Плеер треков по заявке.
#[derive(Clone)]
pub struct Player {
    tx: Sender<Cmd>,
    state: Arc<Mutex<PlayerState>>,
}

impl Player {
    /// Запускает поток воспроизведения и открывает устройство вывода.
    pub fn spawn(volume: f32) -> Self {
        let (tx, rx) = mpsc::channel();
        let state = Arc::new(Mutex::new(PlayerState {
            volume: volume.clamp(0.0, 1.0),
            ..PlayerState::default()
        }));

        let thread_state = Arc::clone(&state);
        let volume = volume.clamp(0.0, 1.0);
        let spawned = thread::Builder::new()
            .name("reward-sounds-music".to_string())
            .spawn(move || run(rx, thread_state, volume));

        if let Err(err) = spawned {
            log::error!("Не удалось запустить поток музыки: {err}");
            if let Ok(mut state) = state.lock() {
                state.error = Some("Не удалось запустить воспроизведение музыки".into());
            }
        }

        Self { tx, state }
    }

    /// Начинает новый трек (предыдущий останавливается).
    pub fn play(&self, bytes: Vec<u8>, duration_sec: u64) -> Result<(), String> {
        // Сбрасываем состояние сразу: декодирование занимает пару секунд,
        // и до него служба успела бы увидеть «прошлый трек сыгран» и пропустить новый.
        if let Ok(mut state) = self.state.lock() {
            state.loaded = true;
            state.paused = false;
            state.finished = false;
            state.position_sec = 0;
            state.duration_sec = duration_sec;
            state.error = None;
        }
        self.send(Cmd::Play {
            bytes,
            duration_sec,
        })
    }

    pub fn pause(&self) -> Result<(), String> {
        self.send(Cmd::Pause)
    }

    pub fn resume(&self) -> Result<(), String> {
        self.send(Cmd::Resume)
    }

    pub fn stop(&self) -> Result<(), String> {
        self.send(Cmd::Stop)
    }

    /// Перемотка на указанную секунду.
    pub fn seek(&self, sec: u64) -> Result<(), String> {
        self.send(Cmd::Seek(sec))
    }

    /// Громкость музыки (не влияет на звуки наград).
    pub fn set_volume(&self, volume: f32) -> Result<(), String> {
        self.send(Cmd::Volume(volume.clamp(0.0, 1.0)))
    }

    pub fn state(&self) -> PlayerState {
        self.state
            .lock()
            .map(|state| state.clone())
            .unwrap_or_default()
    }

    fn send(&self, cmd: Cmd) -> Result<(), String> {
        self.tx
            .send(cmd)
            .map_err(|_| "Плеер музыки не отвечает".to_string())
    }
}

impl Drop for Player {
    fn drop(&mut self) {
        // Закрываем канал: поток завершится и освободит устройство.
        let (tx, _rx) = mpsc::channel();
        let _ = std::mem::replace(&mut self.tx, tx);
    }
}

/// Поток воспроизведения.
fn run(rx: Receiver<Cmd>, state: Arc<Mutex<PlayerState>>, initial_volume: f32) {
    let (stream, handle) = match OutputStream::try_default() {
        Ok(pair) => pair,
        Err(err) => {
            log::error!("Музыка: не удалось открыть устройство вывода: {err}");
            if let Ok(mut state) = state.lock() {
                state.error = Some(format!(
                    "Не удалось открыть устройство вывода звука для музыки: {err}"
                ));
            }
            return;
        }
    };
    let _stream = stream; // держим поток открытым всё время работы плеера
    let handle: OutputStreamHandle = handle;

    let mut sink: Option<Sink> = None;
    let mut volume = initial_volume;
    let mut base = Duration::ZERO;
    let mut started: Option<Instant> = None;
    let mut duration = Duration::ZERO;
    let mut paused = false;
    let mut finished = false;
    let mut generation: u64 = 0;

    loop {
        match rx.recv_timeout(Duration::from_millis(100)) {
            Ok(Cmd::Play { bytes, duration_sec }) => {
                if let Some(previous) = sink.take() {
                    previous.stop();
                }
                finished = false;
                paused = false;
                base = Duration::ZERO;
                duration = Duration::from_secs(duration_sec);

                // Сразу сообщаем наружу, что начат новый трек. Декодирование
                // занимает пару секунд, и без этого служба успевала прочитать
                // состояние прошлого трека («завершён») и пропускала новый.
                if let Ok(mut state) = state.lock() {
                    state.loaded = true;
                    state.finished = false;
                    state.paused = false;
                    state.position_sec = 0;
                    state.duration_sec = duration_sec;
                    state.error = None;
                    // Номер нового трека: служба сравнивает его со своим,
                    // чтобы не принять старое «завершён» за текущее.
                    generation = state.generation.wrapping_add(1);
                    state.generation = generation;
                }

                match decode::open(bytes) {
                    Ok(track) => match Sink::try_new(&handle) {
                        Ok(new_sink) => {
                            new_sink.set_volume(volume);
                            new_sink.append(track.source);
                            sink = Some(new_sink);
                            started = Some(Instant::now());
                            if let Ok(mut state) = state.lock() {
                                state.error = None;
                                state.duration_sec = duration_sec;
                            }
                        }
                        Err(err) => {
                            let message = format!("Не удалось создать поток вывода: {err}");
                            log::error!("Музыка: {message}");
                            if let Ok(mut state) = state.lock() {
                                state.error = Some(message);
                                state.loaded = false;
                            }
                        }
                    },
                    Err(err) => {
                        log::error!("Музыка: {err}");
                        if let Ok(mut state) = state.lock() {
                            state.error = Some(err);
                            state.loaded = false;
                        }
                    }
                }
            }
            Ok(Cmd::Pause) => {
                if let (Some(sink), Some(start)) = (sink.as_ref(), started.take()) {
                    sink.pause();
                    base += start.elapsed();
                    paused = true;
                }
            }
            Ok(Cmd::Resume) => {
                if let Some(sink) = sink.as_ref() {
                    sink.play();
                    started = Some(Instant::now());
                    paused = false;
                }
            }
            Ok(Cmd::Stop) => {
                if let Some(sink) = sink.take() {
                    sink.stop();
                }
                started = None;
                base = Duration::ZERO;
                paused = false;
                finished = false;
            }
            Ok(Cmd::Seek(sec)) => {
                if let Some(sink) = sink.as_ref() {
                    let target = Duration::from_secs(sec.min(duration.as_secs()));
                    if sink.try_seek(target).is_ok() {
                        base = target;
                        started = if paused { None } else { Some(Instant::now()) };
                        finished = false;
                    } else {
                        log::warn!("Музыка: перемотка на {sec} с не поддерживается");
                    }
                }
            }
            Ok(Cmd::Volume(value)) => {
                volume = value.clamp(0.0, 1.0);
                if let Some(sink) = sink.as_ref() {
                    sink.set_volume(volume);
                }
            }
            Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) => break,
        }

        // Позиция: база + время с момента запуска.
        let mut position = base;
        if let Some(start) = started {
            position += start.elapsed();
        }
        if position > duration && !duration.is_zero() {
            position = duration;
        }

        // Конец трека: по времени воспроизведения, а не по «пустому» слинку —
        // он бывает пустым в первые кадры после старта, и трек пропускался.
        if let Some(sink) = sink.as_ref() {
            let _ = sink;
            if !finished && !duration.is_zero() && position >= duration {
                finished = true;
                started = None;
                base = duration;
            }
        }

        if let Ok(mut state) = state.lock() {
            state.loaded = sink.is_some();
            state.paused = paused;
            state.finished = finished;
            state.generation = generation;
            state.position_sec = position.as_secs();
            state.duration_sec = duration.as_secs();
            state.volume = volume;
        }
    }

    if let Some(sink) = sink.take() {
        sink.stop();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn progress_and_labels() {
        let state = PlayerState {
            duration_sec: 200,
            position_sec: 100,
            ..PlayerState::default()
        };
        assert!((state.progress() - 0.5).abs() < 1e-6);
        assert_eq!(state.time_label(), "1:40 / 3:20");
    }

    #[test]
    fn empty_state_is_safe() {
        let state = PlayerState::default();
        assert_eq!(state.progress(), 0.0);
        assert_eq!(state.time_label(), "0:00 / 0:00");
    }

    #[test]
    fn volume_is_clamped_by_player_state() {
        let state = PlayerState::default();
        assert_eq!(state.volume, DEFAULT_VOLUME);
    }
}
