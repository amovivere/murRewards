//! Декодирование трека из памяти.
//!
//! YouTube отдаёт **fragmented MP4** с AAC. Встроенная обёртка rodio на таком
//! потоке падает, поэтому дорожку разбираем сами: symphonia читает контейнер и
//! кодек, а мы отдаём готовый PCM как обычный [`rodio::Source`].
//!
//! Весь трек декодируется один раз при запуске: 3–4 минуты занимают ~35 МБ
//! памяти. Зато аудиопоток потом читает готовый массив без разбора пакетов —
//! на границах пакетов ничего не щёлкает, а перемотка сводится к сдвигу индекса.

use std::time::Duration;

use rodio::source::SeekError;
use rodio::Source;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::errors::Error as SymphoniaError;
use symphonia::core::formats::{FormatOptions, SeekMode, SeekTo};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use symphonia::core::units::Time;

/// Готовый к воспроизведению трек.
pub struct DecodedTrack {
    pub source: PcmSource,
    pub duration: Option<Duration>,
    pub sample_rate: u32,
    pub channels: u16,
}

/// Источник сэмплов поверх заранее декодированного PCM.
pub struct PcmSource {
    samples: Vec<i16>,
    cursor: usize,
    channels: u16,
    sample_rate: u32,
    duration: Option<Duration>,
}

impl PcmSource {
    /// Позиция воспроизведения в секундах.
    pub fn position(&self) -> Duration {
        let frames = self.cursor / self.channels.max(1) as usize;
        Duration::from_millis(frames as u64 * 1000 / self.sample_rate.max(1) as u64)
    }
}

impl Iterator for PcmSource {
    type Item = i16;

    fn next(&mut self) -> Option<i16> {
        let value = self.samples.get(self.cursor).copied();
        if value.is_some() {
            self.cursor += 1;
        }
        value
    }
}

impl Source for PcmSource {
    fn current_frame_len(&self) -> Option<usize> {
        let left = self.samples.len().saturating_sub(self.cursor);
        Some(left / self.channels.max(1) as usize)
    }

    fn channels(&self) -> u16 {
        self.channels
    }

    fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    fn total_duration(&self) -> Option<Duration> {
        self.duration
    }

    fn try_seek(&mut self, pos: Duration) -> Result<(), SeekError> {
        let frames = (pos.as_secs_f64() * self.sample_rate as f64) as usize;
        let index = frames * self.channels.max(1) as usize;
        self.cursor = index.min(self.samples.len());
        Ok(())
    }
}

/// Разбирает байты трека и декодирует его целиком.
pub fn open(bytes: Vec<u8>) -> Result<DecodedTrack, String> {
    let media = MediaSourceStream::new(Box::new(std::io::Cursor::new(bytes)), Default::default());

    let mut hint = Hint::new();
    hint.with_extension("m4a");

    let probed = symphonia::default::get_probe()
        .format(
            &hint,
            media,
            &FormatOptions {
                enable_gapless: true,
                ..Default::default()
            },
            &MetadataOptions::default(),
        )
        .map_err(|err| format!("не удалось разобрать аудио: {err}"))?;

    let track = probed
        .format
        .default_track()
        .ok_or_else(|| "в потоке нет аудиодорожки".to_string())?;

    let track_id = track.id;
    let params = track.codec_params.clone();

    let sample_rate = params.sample_rate.unwrap_or(44_100);
    let channels = params
        .channels
        .map(|channels| channels.count() as u16)
        .unwrap_or(2)
        .max(1);

    let duration = params
        .n_frames
        .map(|frames| Duration::from_millis(frames * 1000 / sample_rate.max(1) as u64));

    let mut format = probed.format;
    let mut decoder = symphonia::default::get_codecs()
        .make(&params, &DecoderOptions::default())
        .map_err(|err| format!("кодек не поддерживается: {err}"))?;

    let mut samples: Vec<i16> = Vec::new();
    let mut buffer: Option<SampleBuffer<i16>> = None;

    loop {
        let packet = match format.next_packet() {
            Ok(packet) => packet,
            Err(_) => break,
        };
        if packet.track_id() != track_id {
            continue;
        }

        match decoder.decode(&packet) {
            Ok(decoded) => {
                let spec = *decoded.spec();
                if buffer.is_none() {
                    buffer = Some(SampleBuffer::new(decoded.capacity() as u64, spec));
                }
                if let Some(buffer) = buffer.as_mut() {
                    buffer.copy_interleaved_ref(decoded);
                    samples.extend_from_slice(buffer.samples());
                }
            }
            // Битая рамка не должна обрывать трек.
            Err(SymphoniaError::DecodeError(_)) => continue,
            Err(_) => break,
        }
    }

    if samples.is_empty() {
        return Err("в треке не оказалось звука".to_string());
    }

    // Дополняем хвост тишиной, чтобы перемотка «в конец» не обрывала звук резко.
    let channels_usize = channels as usize;
    let tail = 2048 * channels_usize;
    samples.extend(std::iter::repeat(0).take(tail));

    Ok(DecodedTrack {
        source: PcmSource {
            samples,
            cursor: 0,
            channels,
            sample_rate,
            duration,
        },
        duration,
        sample_rate,
        channels,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_garbage() {
        assert!(open(vec![0u8; 128]).is_err());
    }

    #[test]
    fn rejects_empty_input() {
        assert!(open(Vec::new()).is_err());
    }
}
