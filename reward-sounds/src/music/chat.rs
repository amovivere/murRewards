//! Чтение чата Twitch без авторизации.
//!
//! Подключаемся к IRC анонимно (`justinfan…`): этого достаточно, чтобы видеть
//! сообщения канала, и не нужно токенов, ни новых прав у приложения.
//! Слушаем команду, которая заново показывает строку «Сейчас играет».
//!
//! Важно: Twitch присылает `PING` и ждёт `PONG`. Без ответа соединение
//! рвётся; раньше это выглядело как «обрыв каждые 10 минут» из-за своего
//! read-timeout. Теперь читаем блокирующе и отвечаем на keepalive.

use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::sync::mpsc::Sender;
use std::thread;
use std::time::Duration;

use super::service::Cmd;

/// Команды, которые показывают оверлей.
const COMMANDS: [&str; 2] = ["!трек", "!track"];

const SERVER: (&str, u16) = ("irc.chat.twitch.tv", 6667);

/// Запускает фоновое чтение чата канала.
pub fn spawn(channel: &str, tx: Sender<Cmd>) {
    let channel = channel.trim().to_lowercase();
    if channel.is_empty() {
        log::info!("Чат: канал не известен, команда !трек недоступна");
        return;
    }

    let spawned = thread::Builder::new()
        .name("music-chat".to_string())
        .spawn(move || loop {
            match TcpStream::connect(SERVER) {
                Ok(stream) => {
                    let Ok(mut writer) = stream.try_clone() else {
                        thread::sleep(Duration::from_secs(15));
                        continue;
                    };
                    let hello = format!(
                        "PASS SCHMOOPIIE\r\nNICK justinfan12345\r\nJOIN #{channel}\r\n"
                    );
                    let _ = writer.write_all(hello.as_bytes());
                    log::info!("Чат: подключён к каналу #{channel}, команда !трек доступна");

                    let reader = BufReader::new(stream);
                    for line in reader.lines().map_while(Result::ok) {
                        // Twitch присылает PING и ждёт PONG — иначе рвёт связь.
                        if line.starts_with("PING") {
                            let _ = writer.write_all(b"PONG :tmi.twitch.tv\r\n");
                            continue;
                        }
                        if !line.contains("PRIVMSG") {
                            continue;
                        }
                        let lower = line.to_lowercase();
                        if COMMANDS.iter().any(|command| lower.contains(command)) {
                            log::info!("Чат: команда показа оверлея");
                            let _ = tx.send(Cmd::ChatCommand);
                        }
                    }
                    log::warn!("Чат: соединение закрыто, переподключаемся");
                }
                Err(err) => {
                    log::warn!("Чат: не удалось подключиться ({err}), переподключаемся");
                }
            }
            thread::sleep(Duration::from_secs(15));
        });

    if let Err(err) = spawned {
        log::error!("Чат: не удалось запустить чтение: {err}");
    }
}
