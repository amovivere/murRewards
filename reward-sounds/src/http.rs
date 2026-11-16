//! HTTP и WebSocket через проверенные библиотеки.
//!
//! REST-запросы — `reqwest` (blocking), WebSocket — `tungstenite`.
//! Обе библиотеки используются в фоновых потоках сервисов, поэтому
//! интерфейс приложения не блокируется.

use std::net::TcpStream;
use std::sync::OnceLock;
use std::time::Duration;

use reqwest::blocking::{Client, RequestBuilder};
use reqwest::Method;
use tungstenite::client::IntoClientRequest;
use tungstenite::stream::MaybeTlsStream;
use tungstenite::{Message, WebSocket as TungsteniteSocket};

const USER_AGENT: &str = concat!("RewardSounds/", env!("CARGO_PKG_VERSION"), " (Windows)");
const TIMEOUT: Duration = Duration::from_secs(25);
const READ_TIMEOUT: Duration = Duration::from_millis(500);

/// Ответ сервера.
#[derive(Debug, Clone)]
pub struct Response {
    pub status: u16,
    pub body: String,
}

impl Response {
    pub fn is_success(&self) -> bool {
        (200..300).contains(&self.status)
    }
}

/// Общий клиент (с системным прокси, если он настроен).
fn client() -> Result<&'static Client, String> {
    static CLIENT: OnceLock<Result<Client, String>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            Client::builder()
                .user_agent(USER_AGENT)
                .timeout(TIMEOUT)
                .build()
                .map_err(|err| format!("Не удалось подготовить HTTP-клиент: {err}"))
        })
        .as_ref()
        .map_err(Clone::clone)
}

/// Клиент без прокси — для локальных адресов (тесты, отладка).
fn local_client() -> Result<&'static Client, String> {
    static CLIENT: OnceLock<Result<Client, String>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            Client::builder()
                .user_agent(USER_AGENT)
                .timeout(TIMEOUT)
                .no_proxy()
                .build()
                .map_err(|err| format!("Не удалось подготовить локальный HTTP-клиент: {err}"))
        })
        .as_ref()
        .map_err(Clone::clone)
}

fn pick_client(url: &str) -> Result<&'static Client, String> {
    let host = url
        .split_once("://")
        .map(|(_, rest)| rest)
        .and_then(|rest| rest.split(['/', ':']).next())
        .unwrap_or_default();
    if host.starts_with("127.") || host == "localhost" || host == "[::1]" {
        local_client()
    } else {
        client()
    }
}

fn send(
    method: Method,
    url: &str,
    headers: &[(String, String)],
    body: Option<Vec<u8>>,
    content_type: Option<&str>,
) -> Result<Response, String> {
    let client = pick_client(url)?;
    let mut request: RequestBuilder = client.request(method, url);
    for (name, value) in headers {
        request = request.header(name.as_str(), value.as_str());
    }
    if let Some(content_type) = content_type {
        request = request.header("Content-Type", content_type);
    }
    if let Some(body) = body {
        request = request.body(body);
    }

    let response = request
        .send()
        .map_err(|err| format!("Ошибка сети: {err}"))?;
    let status = response.status().as_u16();
    let body = response
        .text()
        .map_err(|err| format!("Не удалось прочитать ответ: {err}"))?;

    Ok(Response { status, body })
}

/// Отправляет GET-запрос.
pub fn get(url: &str, headers: &[(String, String)]) -> Result<Response, String> {
    send(Method::GET, url, headers, None, None)
}

/// Отправляет POST с телом `application/x-www-form-urlencoded`.
pub fn post_form(
    url: &str,
    headers: &[(String, String)],
    form: &[(&str, &str)],
) -> Result<Response, String> {
    let body = form
        .iter()
        .map(|(key, value)| format!("{}={}", form_encode(key), form_encode(value)))
        .collect::<Vec<_>>()
        .join("&");

    send(
        Method::POST,
        url,
        headers,
        Some(body.into_bytes()),
        Some("application/x-www-form-urlencoded"),
    )
}

/// Отправляет POST без тела.
pub fn post(url: &str, headers: &[(String, String)]) -> Result<Response, String> {
    send(Method::POST, url, headers, None, None)
}

/// Отправляет DELETE-запрос.
pub fn delete(url: &str, headers: &[(String, String)]) -> Result<Response, String> {
    send(Method::DELETE, url, headers, None, None)
}

/// Отправляет POST с JSON-телом.
pub fn post_json(
    url: &str,
    headers: &[(String, String)],
    body: &str,
) -> Result<Response, String> {
    send(
        Method::POST,
        url,
        headers,
        Some(body.as_bytes().to_vec()),
        Some("application/json"),
    )
}

/// Отправляет PATCH с JSON-телом.
pub fn patch_json(
    url: &str,
    headers: &[(String, String)],
    body: &str,
) -> Result<Response, String> {
    send(
        Method::PATCH,
        url,
        headers,
        Some(body.as_bytes().to_vec()),
        Some("application/json"),
    )
}

/// Кодирование значения для формы/query-string.
pub fn form_encode(value: &str) -> String {
    let mut result = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                result.push(byte as char)
            }
            _ => result.push_str(&format!("%{byte:02X}")),
        }
    }
    result
}

/// Сообщение WebSocket.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WsMessage {
    Text(String),
    Closed,
    /// Данных не было за время ожидания — соединение живо.
    Timeout,
}

/// WebSocket-клиент (TLS через системный планировщик).
pub struct WebSocket {
    socket: TungsteniteSocket<MaybeTlsStream<TcpStream>>,
}

impl WebSocket {
    /// Подключается к `ws://` или `wss://` адресу с дополнительными заголовками.
    pub fn connect(url: &str, headers: &[(String, String)]) -> Result<Self, String> {
        let mut request = url
            .into_client_request()
            .map_err(|err| format!("Некорректный адрес WebSocket: {err}"))?;

        {
            let request_headers = request.headers_mut();
            for (name, value) in headers {
                let name = reqwest::header::HeaderName::from_bytes(name.as_bytes())
                    .map_err(|err| format!("Некорректный заголовок {name}: {err}"))?;
                let value = reqwest::header::HeaderValue::from_str(value)
                    .map_err(|err| format!("Некорректное значение заголовка {name}: {err}"))?;
                request_headers.insert(name, value);
            }
        }

        let (socket, response) = tungstenite::connect(request)
            .map_err(|err| format!("Не удалось подключиться к Twitch: {err}"))?;

        if response.status().as_u16() != 101 {
            return Err(format!(
                "Сервер не подтвердил WebSocket-соединение (HTTP {})",
                response.status().as_u16()
            ));
        }

        let mut socket = WebSocket { socket };
        socket.set_read_timeout()?;
        Ok(socket)
    }

    fn set_read_timeout(&mut self) -> Result<(), String> {
        let timeout = Some(READ_TIMEOUT);
        match self.socket.get_mut() {
            MaybeTlsStream::Plain(stream) => stream
                .set_read_timeout(timeout)
                .map_err(|err| format!("Не удалось настроить ожидание данных: {err}")),
            MaybeTlsStream::NativeTls(stream) => stream
                .get_ref()
                .set_read_timeout(timeout)
                .map_err(|err| format!("Не удалось настроить ожидание данных: {err}")),
            _ => Ok(()),
        }
    }

    /// Читает одно сообщение. По таймауту возвращает `Timeout` (соединение живо).
    pub fn receive(&mut self) -> Result<WsMessage, String> {
        loop {
            match self.socket.read() {
                Ok(Message::Text(text)) => return Ok(WsMessage::Text(text.to_string())),
                Ok(Message::Binary(bytes)) => {
                    return Ok(WsMessage::Text(String::from_utf8_lossy(&bytes).to_string()))
                }
                Ok(Message::Ping(payload)) => {
                    let _ = self.socket.send(Message::Pong(payload));
                }
                Ok(Message::Pong(_)) | Ok(Message::Frame(_)) => {}
                Ok(Message::Close(_)) => return Ok(WsMessage::Closed),
                Err(tungstenite::Error::Io(err))
                    if matches!(
                        err.kind(),
                        std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                    ) =>
                {
                    return Ok(WsMessage::Timeout)
                }
                Err(tungstenite::Error::ConnectionClosed | tungstenite::Error::AlreadyClosed) => {
                    return Ok(WsMessage::Closed)
                }
                Err(err) => return Err(format!("Ошибка WebSocket: {err}")),
            }
        }
    }

    /// Аккуратно закрывает соединение.
    pub fn close(&mut self) {
        let _ = self.socket.close(None);
        let _ = self.socket.flush();
    }
}

impl Drop for WebSocket {
    fn drop(&mut self) {
        let _ = self.socket.close(None);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;
    use std::io::{Read, Write};
    use std::sync::mpsc::{self, Receiver};
    use std::sync::Arc;
    use std::thread;

    fn start_server(response: &'static str) -> (u16, Receiver<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let (sender, receiver) = mpsc::channel();
        let sender = Arc::new(std::sync::Mutex::new(sender));

        thread::spawn(move || {
            if let Ok((mut stream, _)) = listener.accept() {
                let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
                let mut request = Vec::new();
                let mut buffer = [0u8; 4096];

                loop {
                    match stream.read(&mut buffer) {
                        Ok(0) => break,
                        Ok(count) => {
                            request.extend_from_slice(&buffer[..count]);
                            let text = String::from_utf8_lossy(&request);
                            if let Some(header_end) = text.find("\r\n\r\n") {
                                let content_length = text[..header_end]
                                    .lines()
                                    .find_map(|line| {
                                        line.strip_prefix("content-length: ")
                                            .or_else(|| line.strip_prefix("Content-Length: "))
                                    })
                                    .and_then(|value| value.trim().parse::<usize>().ok())
                                    .unwrap_or(0);
                                if request.len() >= header_end + 4 + content_length {
                                    break;
                                }
                            }
                        }
                        Err(_) => break,
                    }
                }

                let _ = sender
                    .lock()
                    .unwrap()
                    .send(String::from_utf8_lossy(&request).to_string());
                let _ = stream.write_all(response.as_bytes());
                let _ = stream.flush();
            }
        });

        (port, receiver)
    }

    #[test]
    fn get_returns_status_and_body() {
        let (port, _captured) =
            start_server("HTTP/1.1 200 OK\r\nContent-Length: 11\r\nConnection: close\r\n\r\nhello world");
        let response = get(&format!("http://127.0.0.1:{port}/x"), &[]).unwrap();
        assert_eq!(response.status, 200);
        assert_eq!(response.body, "hello world");
    }

    #[test]
    fn post_form_sends_body_and_headers() {
        let (port, captured) =
            start_server("HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok");

        let response = post_form(
            &format!("http://127.0.0.1:{port}/token"),
            &[("Client-Id".to_string(), "cid".to_string())],
            &[("grant_type", "refresh_token"), ("refresh_token", "abc def")],
        )
        .unwrap();
        assert_eq!(response.status, 200);

        let request = captured.recv_timeout(Duration::from_secs(3)).unwrap();
        assert!(request.starts_with("POST /token HTTP/1.1"), "{request}");
        assert!(request.contains("content-type: application/x-www-form-urlencoded"));
        assert!(request.contains("grant_type=refresh_token"));
        assert!(request.contains("refresh_token=abc%20def"));
    }

    #[test]
    fn post_json_sends_json_body() {
        let (port, captured) =
            start_server("HTTP/1.1 202 Accepted\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}");

        let body = r#"{"type":"channel.channel_points_custom_reward_redemption.add","version":"1"}"#;
        let response = post_json(
            &format!("http://127.0.0.1:{port}/helix/eventsub/subscriptions"),
            &[("Client-Id".to_string(), "cid".to_string())],
            body,
        )
        .unwrap();
        assert_eq!(response.status, 202);

        let request = captured.recv_timeout(Duration::from_secs(3)).unwrap();
        assert!(request.starts_with("POST /helix/eventsub/subscriptions HTTP/1.1"));
        assert!(request.contains("content-type: application/json"));
        assert!(request.contains(body), "{request}");
    }

    #[test]
    fn delete_uses_delete_method() {
        let (port, captured) =
            start_server("HTTP/1.1 204 No Content\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");

        let response = delete(
            &format!("http://127.0.0.1:{port}/helix/eventsub/subscriptions?id=abc"),
            &[],
        )
        .unwrap();
        assert_eq!(response.status, 204);

        let request = captured.recv_timeout(Duration::from_secs(3)).unwrap();
        assert!(
            request.starts_with("DELETE /helix/eventsub/subscriptions?id=abc HTTP/1.1"),
            "{request}"
        );
    }

    #[test]
    fn error_status_is_returned_as_is() {
        let (port, _captured) = start_server(
            "HTTP/1.1 400 Bad Request\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}",
        );
        let response = get(&format!("http://127.0.0.1:{port}/bad"), &[]).unwrap();
        assert_eq!(response.status, 400);
    }

    #[test]
    fn encodes_form_values() {
        assert_eq!(form_encode("abc-1_~."), "abc-1_~.");
        assert_eq!(form_encode("a b"), "a%20b");
    }
}
