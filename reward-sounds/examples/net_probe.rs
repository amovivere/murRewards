//! Диагностика сети: HTTPS-запрос к Twitch и WebSocket EventSub.
//!
//! Запуск: `cargo run --example net_probe`

use reward_sounds::http::{self, WsMessage};

fn main() {
    println!("== HTTPS ==");
    match http::get("https://api.twitch.tv/helix/users", &[]) {
        Ok(response) => println!("HTTP {}: {}", response.status, first_chars(&response.body)),
        Err(err) => println!("Ошибка: {err}"),
    }

    println!("== WebSocket ==");
    match http::WebSocket::connect("wss://eventsub.wss.twitch.tv/ws", &[]) {
        Ok(mut socket) => {
            for _ in 0..10 {
                match socket.receive() {
                    Ok(WsMessage::Text(text)) => {
                        println!("получено: {}", first_chars(&text));
                        if text.contains("session_welcome") {
                            break;
                        }
                    }
                    Ok(WsMessage::Timeout) => println!("ожидание..."),
                    Ok(WsMessage::Closed) => {
                        println!("соединение закрыто");
                        break;
                    }
                    Err(err) => {
                        println!("Ошибка: {err}");
                        break;
                    }
                }
            }
            socket.close();
        }
        Err(err) => println!("Ошибка подключения: {err}"),
    }
}

fn first_chars(text: &str) -> String {
    text.chars().take(160).collect()
}
