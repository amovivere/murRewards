# -*- coding: utf-8 -*-
"""Настройки и авторизация Twitch в Tauri-ядре."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\core.rs")
s = P.read_text(encoding="utf-8")


def sub(old, new):
    global s
    assert old in s, "NOT FOUND: " + old[:120]
    s = s.replace(old, new, 1)


# --- DTO авторизации и поля настроек ---
sub("""/// Одна заявка в очереди музыки.""",
"""/// Состояние входа в Twitch для экрана настроек.
#[derive(Clone, Serialize, Default)]
pub struct AuthView {
    /// idle | waiting | error
    pub state: String,
    pub user_code: Option<String>,
    pub verification_uri: Option<String>,
    pub expires_in: u64,
    pub progress: Option<String>,
    pub error: Option<String>,
}

/// Одна заявка в очереди музыки.""")

sub("""    pub music_enabled: bool,
    pub music_reward_title: String,
    pub music_reward_cost: u32,
    pub music: MusicView,
}""",
"""    pub music_enabled: bool,
    pub music_reward_title: String,
    pub music_reward_cost: u32,
    pub music: MusicView,
    pub client_id: String,
    pub autostart: bool,
    pub close_to_tray: bool,
    pub start_minimized: bool,
    pub playback_enabled: bool,
    pub auth: AuthView,
}""")

# --- Inner auth ---
sub("""    files: HashMap<String, FileInfo>,
    refresh_tried: bool,
}""",
"""    files: HashMap<String, FileInfo>,
    refresh_tried: bool,
    auth: AuthView,
}""")
sub("""            files,
            refresh_tried: false,
        };""",
"""            files,
            refresh_tried: false,
            auth: AuthView {
                state: "idle".to_string(),
                ..AuthView::default()
            },
        };""")

# --- view: новые поля ---
sub("""            music: music_view(&inner.music.snapshot(), settings),
        }""",
"""            music: music_view(&inner.music.snapshot(), settings),
            client_id: settings.twitch.client_id.clone(),
            autostart: settings.autostart,
            close_to_tray: settings.close_to_tray,
            start_minimized: settings.start_minimized,
            playback_enabled: settings.playback_enabled,
            auth: inner.auth.clone(),
        }""")

# --- обработка событий авторизации ---
sub("""            twitch::Event::RewardsLoaded { rewards } => {""",
"""            twitch::Event::CodeReady {
                user_code,
                verification_uri,
                expires_in,
            } => {
                let mut inner = self.lock();
                inner.auth.state = "waiting".to_string();
                inner.auth.user_code = Some(user_code);
                inner.auth.verification_uri = Some(verification_uri);
                inner.auth.expires_in = expires_in;
                inner.auth.error = None;
                inner.auth.progress = None;
            }
            twitch::Event::Progress(text) => {
                self.lock().auth.progress = Some(text);
            }
            twitch::Event::Authorized { user, tokens } => {
                {
                    let mut inner = self.lock();
                    inner.settings.twitch.user_id = user.id.clone();
                    inner.settings.twitch.login = user.login.clone();
                    inner.settings.twitch.display_name = user.display_name.clone();
                    if let Err(err) = inner.settings.twitch.store_tokens(
                        &tokens.access,
                        &tokens.refresh,
                        tokens.expires_at,
                    ) {
                        inner.auth.state = "error".to_string();
                        inner.auth.error = Some(format!("Не удалось сохранить вход: {err}"));
                        return;
                    }
                    inner.auth.state = "idle".to_string();
                    inner.auth.user_code = None;
                    inner.auth.verification_uri = None;
                    inner.auth.progress = None;
                    inner.auth.error = None;
                    inner.refresh_tried = false;
                }
                self.save();
                {
                    let mut inner = self.lock();
                    self.fetch_rewards(&mut inner);
                }
            }
            twitch::Event::RewardsLoaded { rewards } => {""")

sub("""            twitch::Event::SessionExpired(message) => {
                {
                    let mut inner = self.lock();
                    inner.settings.twitch.clear_session();
                    inner.rewards.clear();
                    inner.loading = false;
                    inner.error = Some(message);
                }
                self.save();
            }""",
"""            twitch::Event::SessionExpired(message) => {
                {
                    let mut inner = self.lock();
                    inner.settings.twitch.clear_session();
                    inner.rewards.clear();
                    inner.loading = false;
                    inner.error = Some(message.clone());
                    inner.auth.state = "error".to_string();
                    inner.auth.error = Some(message);
                }
                self.save();
            }""")

sub("""            twitch::Event::Failed(message) => {
                let mut inner = self.lock();
                inner.loading = false;
                inner.error = Some(message);
            }""",
"""            twitch::Event::Failed(message) => {
                let mut inner = self.lock();
                inner.loading = false;
                inner.auth.state = "error".to_string();
                inner.auth.error = Some(message.clone());
                inner.error = Some(message);
            }""")

# --- команды настроек/авторизации ---
sub("""#[tauri::command]
pub fn music_toggle_pause""",
"""#[tauri::command]
pub fn twitch_start_login(
    core: State<'_, Arc<AppCore>>,
    client_id: String,
) -> Result<CoreView, String> {
    let id = client_id.trim().to_string();
    if id.len() < 20 || !id.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err("Client ID должен состоять примерно из 30 букв и цифр без пробелов.".into());
    }
    {
        let mut inner = core.lock();
        inner.settings.twitch.client_id = id.clone();
        inner.auth = AuthView {
            state: "waiting".to_string(),
            progress: Some("Открываем страницу Twitch…".to_string()),
            ..AuthView::default()
        };
        inner.twitch.sign_in(&id);
    }
    core.save();
    Ok(core.view())
}

#[tauri::command]
pub fn twitch_cancel_login(core: State<'_, Arc<AppCore>>) -> CoreView {
    {
        let mut inner = core.lock();
        inner.twitch.cancel();
        inner.auth = AuthView {
            state: "idle".to_string(),
            ..AuthView::default()
        };
    }
    core.view()
}

#[tauri::command]
pub fn twitch_disconnect(core: State<'_, Arc<AppCore>>) -> CoreView {
    {
        let mut inner = core.lock();
        inner.settings.twitch.clear_session();
        inner.rewards.clear();
        inner.loading = false;
        inner.error = None;
        inner.auth = AuthView {
            state: "idle".to_string(),
            ..AuthView::default()
        };
    }
    core.save();
    core.view()
}

#[tauri::command]
pub fn set_app_setting(
    core: State<'_, Arc<AppCore>>,
    key: String,
    value: String,
) -> Result<CoreView, String> {
    {
        let mut inner = core.lock();
        match key.as_str() {
            "autostart" => {
                let enabled = value == "1" || value.eq_ignore_ascii_case("true");
                if let Err(err) = reward_sounds::autostart::set_enabled(enabled) {
                    return Err(format!("Не удалось изменить автозапуск: {err}"));
                }
                inner.settings.autostart = enabled;
            }
            "close_to_tray" => {
                inner.settings.close_to_tray = value == "1" || value.eq_ignore_ascii_case("true");
            }
            "start_minimized" => {
                inner.settings.start_minimized = value == "1" || value.eq_ignore_ascii_case("true");
            }
            "playback_enabled" => {
                inner.settings.playback_enabled = value == "1" || value.eq_ignore_ascii_case("true");
            }
            "muted" => {
                inner.settings.muted = value == "1" || value.eq_ignore_ascii_case("true");
                let volume = inner.settings.effective_volume();
                let _ = inner.audio.set_volume(volume);
                inner.music.set_volume(inner.settings.music.volume_f32());
            }
            "volume" => {
                let volume = value.parse::<f64>().map_err(|_| "Некорректная громкость")?;
                inner.settings.volume = volume.clamp(0.0, 1.0);
                inner.settings.muted = false;
                let effective = inner.settings.effective_volume();
                let _ = inner.audio.set_volume(effective);
            }
            other => return Err(format!("Неизвестная настройка: {other}")),
        }
    }
    core.save();
    Ok(core.view())
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    if url.starts_with("https://twitch.tv/activate")
        || url.starts_with("https://www.twitch.tv/activate")
        || url.starts_with("https://dev.twitch.tv/")
    {
        webbrowser::open(&url).map_err(|err| err.to_string())?;
        Ok(())
    } else {
        Err("Недопустимая ссылка".into())
    }
}

#[tauri::command]
pub fn music_toggle_pause""")

P.write_text(s, encoding="utf-8")
print("settings auth backend")
