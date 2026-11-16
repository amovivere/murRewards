//! Разбор ссылок из текста заявки.
//!
//! Зритель вставляет в награду что угодно: чистую ссылку, ссылку с текстом
//! («вот трек https://…»), короткую ссылку `youtu.be`, ссылку из мобильного
//! приложения с хвостом параметров. Задача — вытащить первую ссылку и понять,
//! на что она указывает.

use url::Url;

/// Ссылка на конкретное видео YouTube.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrackLink {
    /// Идентификатор видео: 11 символов `[A-Za-z0-9_-]`.
    pub video_id: String,
    /// Канонический адрес: `https://www.youtube.com/watch?v=<id>`.
    pub url: String,
}

impl TrackLink {
    /// Короткая подпись для интерфейса и журнала.
    pub fn short(&self) -> &str {
        &self.video_id
    }
}

/// Почему ссылку не удалось принять.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LinkError {
    /// В тексте вообще нет ссылки.
    NoLink,
    /// Ссылка на другой сервис (например, Яндекс Музыка).
    UnsupportedService(String),
    /// Похоже на YouTube, но видео не разобрать.
    BadVideoId(String),
}

impl LinkError {
    /// Текст для зрителя и журнала.
    pub fn message(&self) -> String {
        match self {
            LinkError::NoLink => "Не нашёл ссылку в заявке".to_string(),
            LinkError::UnsupportedService(service) => {
                format!("Поддерживается только YouTube, а тут {service}")
            }
            LinkError::BadVideoId(reason) => format!("Не понял ссылку YouTube: {reason}"),
        }
    }
}

/// Сколько символов в идентификаторе видео YouTube.
const VIDEO_ID_LEN: usize = 11;

/// Разбирает текст заявки и возвращает ссылку на видео.
pub fn parse(text: &str) -> Result<TrackLink, LinkError> {
    let raw = find_first_url(text).ok_or(LinkError::NoLink)?;
    let url = Url::parse(&raw).map_err(|err| LinkError::BadVideoId(err.to_string()))?;

    let host = url.host_str().unwrap_or_default().to_ascii_lowercase();
    let host = host.strip_prefix("www.").unwrap_or(&host).to_string();

    if host == "youtu.be" {
        let id = url
            .path_segments()
            .and_then(|mut segments| segments.next())
            .unwrap_or_default();
        return finish(id);
    }

    if matches!(
        host.as_str(),
        "youtube.com" | "m.youtube.com" | "music.youtube.com" | "youtube-nocookie.com"
    ) {
        let path = url.path();

        if path == "/watch" || path == "/watch/" {
            match url.query_pairs().find(|(key, _)| key.as_ref() == "v") {
                Some((_, value)) => return finish(&value),
                None => return Err(LinkError::BadVideoId("в ссылке нет параметра v".into())),
            }
        }

        for prefix in ["/shorts/", "/live/", "/embed/", "/v/", "/e/"] {
            if let Some(rest) = path.strip_prefix(prefix) {
                let id = rest.split(['/', '?']).next().unwrap_or_default();
                return finish(id);
            }
        }

        if path.starts_with("/clip/") {
            return Err(LinkError::BadVideoId(
                "это клип, нужна ссылка на видео".into(),
            ));
        }

        return Err(LinkError::BadVideoId(format!(
            "неизвестный адрес YouTube: {path}"
        )));
    }

    if host.starts_with("music.yandex.") {
        return Err(LinkError::UnsupportedService("Яндекс Музыка".into()));
    }
    if host.is_empty() {
        return Err(LinkError::BadVideoId("в ссылке нет домена".into()));
    }

    Err(LinkError::UnsupportedService(host))
}

/// Проверяет идентификатор и собирает канонический адрес.
fn finish(video_id: &str) -> Result<TrackLink, LinkError> {
    let id = video_id.trim();
    let valid = id.len() == VIDEO_ID_LEN
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');

    if !valid {
        return Err(LinkError::BadVideoId(format!(
            "идентификатор видео «{id}» выглядит неверно"
        )));
    }

    Ok(TrackLink {
        video_id: id.to_string(),
        url: canonical_url(id),
    })
}

/// Канонический адрес видео.
pub fn canonical_url(video_id: &str) -> String {
    format!("https://www.youtube.com/watch?v={video_id}")
}

/// Находит в тексте первую ссылку.
///
/// Понимает `http://`, `https://` и адреса без схемы (`youtu.be/…`,
/// `youtube.com/watch?v=…`), которые часто присылают из мобильного приложения.
pub fn find_first_url(text: &str) -> Option<String> {
    let mut best: Option<(usize, String)> = None;

    for scheme in ["https://", "http://"] {
        if let Some(pos) = find_ascii_ci(text, scheme) {
            let candidate = take_url_token(&text[pos..]);
            if best.as_ref().map_or(true, |(best_pos, _)| pos < *best_pos) {
                best = Some((pos, candidate));
            }
        }
    }

    for host in [
        "youtu.be/",
        "youtube.com/",
        "m.youtube.com/",
        "music.youtube.com/",
    ] {
        if let Some(pos) = find_ascii_ci(text, host) {
            let token = take_url_token(&text[pos..]);
            if best.as_ref().map_or(true, |(best_pos, _)| pos < *best_pos) {
                best = Some((pos, format!("https://{token}")));
            }
        }
    }

    best.map(|(_, url)| url)
}

/// Отрезает ссылку от текста и убирает знаки препинания на конце.
fn take_url_token(text: &str) -> String {
    let end = text
        .find(|c: char| c.is_whitespace() || c == '\n' || c == '\r')
        .unwrap_or(text.len());
    let token = &text[..end];
    token
        .trim_end_matches(|c: char| {
            matches!(
                c,
                '.' | ',' | ';' | ':' | '!' | '?' | ')' | ']' | '}' | '»' | '“' | '"' | '\'' | '>'
            )
        })
        .to_string()
}

/// Поиск подстроки без учёта регистра (только ASCII).
fn find_ascii_ci(haystack: &str, needle: &str) -> Option<usize> {
    let hay = haystack.as_bytes();
    let ned = needle.as_bytes();
    if ned.is_empty() || ned.len() > hay.len() {
        return None;
    }
    (0..=hay.len() - ned.len()).find(|&index| hay[index..index + ned.len()].eq_ignore_ascii_case(ned))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn id(text: &str) -> String {
        parse(text).expect("ссылка должна разбираться").video_id
    }

    #[test]
    fn parses_common_forms() {
        assert_eq!(id("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
        assert_eq!(id("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
        assert_eq!(id("https://youtube.com/watch?v=dQw4w9WgXcQ&t=42"), "dQw4w9WgXcQ");
        assert_eq!(id("https://m.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
        assert_eq!(id("https://music.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
        assert_eq!(id("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
        assert_eq!(id("https://www.youtube.com/live/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
        assert_eq!(id("https://www.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
        assert_eq!(id("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
    }

    #[test]
    fn extracts_link_from_text() {
        assert_eq!(
            id("вот трек https://youtu.be/dQw4w9WgXcQ спасибо"),
            "dQw4w9WgXcQ"
        );
        assert_eq!(
            id("послушай (https://www.youtube.com/watch?v=dQw4w9WgXcQ)."),
            "dQw4w9WgXcQ"
        );
    }

    #[test]
    fn accepts_links_without_scheme() {
        assert_eq!(id("youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
        assert_eq!(id("youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
    }

    #[test]
    fn builds_canonical_url() {
        let link = parse("https://youtu.be/dQw4w9WgXcQ?si=abc").unwrap();
        assert_eq!(link.url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    }

    #[test]
    fn playlist_parameter_is_ignored() {
        let link = parse("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123").unwrap();
        assert_eq!(link.video_id, "dQw4w9WgXcQ");
        assert!(!link.url.contains("list"));
    }

    #[test]
    fn rejects_other_services() {
        assert_eq!(
            parse("https://music.yandex.ru/album/1/track/2"),
            Err(LinkError::UnsupportedService("Яндекс Музыка".into()))
        );
        assert_eq!(
            parse("https://open.spotify.com/track/123"),
            Err(LinkError::UnsupportedService("open.spotify.com".into()))
        );
    }

    #[test]
    fn rejects_text_without_link() {
        assert_eq!(parse("просто сообщение"), Err(LinkError::NoLink));
        assert_eq!(parse(""), Err(LinkError::NoLink));
    }

    #[test]
    fn rejects_broken_video_ids() {
        assert!(matches!(
            parse("https://youtu.be/short"),
            Err(LinkError::BadVideoId(_))
        ));
        assert!(matches!(
            parse("https://www.youtube.com/watch?v="),
            Err(LinkError::BadVideoId(_))
        ));
        assert!(matches!(
            parse("https://www.youtube.com/clip/Ugkx123"),
            Err(LinkError::BadVideoId(_))
        ));
    }

    #[test]
    fn trims_trailing_punctuation() {
        assert_eq!(find_first_url("смотри https://youtu.be/dQw4w9WgXcQ!!!").unwrap(), "https://youtu.be/dQw4w9WgXcQ");
        assert_eq!(find_first_url("(https://youtu.be/dQw4w9WgXcQ)").unwrap(), "https://youtu.be/dQw4w9WgXcQ");
    }

    #[test]
    fn message_is_human_readable() {
        assert!(LinkError::NoLink.message().contains("ссылку"));
        assert!(LinkError::UnsupportedService("Spotify".into())
            .message()
            .contains("Spotify"));
    }
}
