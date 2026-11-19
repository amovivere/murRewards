#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod core;

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::menu::{CheckMenuItem, Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Listener, Manager, WindowEvent};

/// Последняя сохранённая геометрия окна (позиция/размер в физических пикселях).
#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct WindowGeometry {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

fn geometry_path() -> std::path::PathBuf {
    reward_sounds::config::AppPaths::resolve()
        .data_dir
        .join("window.json")
}

/// Логический размер основного монитора и его масштаб (для clamp окна).
fn primary_monitor_logical(app: &tauri::App) -> (f64, f64, f64) {
    match app.primary_monitor() {
        Ok(Some(monitor)) => {
            let scale = monitor.scale_factor();
            (
                monitor.size().width as f64 / scale,
                monitor.size().height as f64 / scale,
                scale,
            )
        }
        _ => (1920.0, 1080.0, 1.0),
    }
}

fn load_geometry() -> Option<WindowGeometry> {    let text = std::fs::read_to_string(geometry_path()).ok()?;
    let geometry: WindowGeometry = serde_json::from_str(&text).ok()?;
    if geometry.width < 800 || geometry.height < 560 {
        return None;
    }
    Some(geometry)
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

/// Сохраняет позицию и размер окна (не чаще раза в 500 мс).
fn save_geometry(window: &tauri::WebviewWindow) {
    if window.is_maximized().unwrap_or(false) || window.is_minimized().unwrap_or(false) {
        return;
    }
    let Ok(position) = window.outer_position() else {
        return;
    };
    let Ok(size) = window.inner_size() else {
        return;
    };
    if size.width < 800 || size.height < 560 {
        return;
    }
    let geometry = WindowGeometry {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    };
    if let Ok(text) = serde_json::to_string(&geometry) {
        if let Err(err) = std::fs::write(geometry_path(), text) {
            log::warn!("Не удалось сохранить геометрию окна: {err}");
        }
    }
}

fn show_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/* ---------- команды кастомного заголовка окна ---------- */

#[tauri::command]
fn win_minimize(window: tauri::WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|err| err.to_string())
}

#[tauri::command]
fn win_toggle_maximize(window: tauri::WebviewWindow) -> Result<(), String> {
    let maximized = window.is_maximized().map_err(|err| err.to_string())?;
    if maximized {
        window.unmaximize().map_err(|err| err.to_string())
    } else {
        window.maximize().map_err(|err| err.to_string())
    }
}

#[tauri::command]
fn win_close(window: tauri::WebviewWindow) -> Result<(), String> {
    // Событие CloseRequested ниже решает: спрятать в трей или выйти.
    window.close().map_err(|err| err.to_string())
}

#[tauri::command]
fn win_start_drag(window: tauri::WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|err| err.to_string())
}

#[tauri::command]
fn win_hide(window: tauri::WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|err| err.to_string())
}

fn main() {
    // Один экземпляр: второй процесс показывает окно первого и выходит,
    // чтобы не запускать второй EventSub/аудиодвижок. Порт — локальный «замок».
    let _single_instance = match std::net::TcpListener::bind("127.0.0.1:47831") {
        Ok(listener) => listener,
        Err(_) => {
            log::info!("Второй экземпляр: показываем окно уже запущенного приложения");
            reward_sounds::window_ops::show_from_tray();
            return;
        }
    };

    tauri::Builder::default()
        .setup(|app| {
            use tauri::WebviewWindowBuilder;

            let paths = reward_sounds::config::AppPaths::resolve();
            let logger = reward_sounds::logging::init(&paths.log_dir);
            std::mem::forget(logger);

            let state = core::AppCore::start();
            let start_minimized = state.start_minimized();
            let close_to_tray = state.close_to_tray();
            app.manage(state);

            // Портативный профиль WebView2 рядом с exe. В AppData профиль
            // может оказаться залипшим/недоступным после аварийного завершения.
            let data_dir = std::env::current_exe()?
                .parent()
                .ok_or("нет папки приложения")?
                .join("webview-data");
            std::fs::create_dir_all(&data_dir)?;

            let geometry = load_geometry();
            let (monitor_w, monitor_h, monitor_scale) = primary_monitor_logical(app);
            // Окно рассчитано на desktop 2K: 1600×1000 логических.
            // Не даём ему выйти за рабочую область монитора.
            let max_w = (monitor_w - 24.0).max(1600.0);
            let max_h = (monitor_h - 80.0).max(1000.0);
            let devtools_args = std::env::var("REWARD_SOUNDS_DEVTOOLS_PORT")
                .ok()
                .map(|port| format!("--remote-debugging-port={port}"));
            let mut builder = WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Reward Sounds")
            .min_inner_size(1600.0, 1000.0)
            .resizable(true)
            .maximizable(true)
            .minimizable(true)
            .decorations(false)
            .data_directory(data_dir);
            if let Some(geometry) = &geometry {
                let width = (geometry.width as f64).clamp(1600.0, max_w);
                let height = (geometry.height as f64).clamp(1000.0, max_h);
                let x = (geometry.x as f64 / monitor_scale).clamp(0.0, (monitor_w - width).max(0.0));
                let y = (geometry.y as f64 / monitor_scale).clamp(0.0, (monitor_h - height).max(0.0));
                builder = builder.inner_size(width, height).position(x, y);
            } else {
                builder = builder
                    .inner_size(1600.0f64.min(max_w), 1000.0f64.min(max_h))
                    .center();
            }
            if let Some(args) = devtools_args.as_deref() {
                builder = builder.additional_browser_args(args);
            }
            let window = match builder.build() {
                Ok(window) => window,
                Err(err) => {
                    eprintln!("WEBVIEW BUILD ERROR: {err:?}");
                    return Err(Box::new(err) as Box<dyn std::error::Error>);
                }
            };
            let window_for_close = window.clone();
            let window_for_geometry = window.clone();
            let last_geometry_save = Arc::new(AtomicU64::new(0));
            window.on_window_event(move |event| {
                match event {
                    WindowEvent::CloseRequested { api, .. } => {
                        save_geometry(&window_for_geometry);
                        // Флаг читаем в момент закрытия, чтобы переключатель в
                        // настройках действовал сразу, без перезапуска.
                        let close_to_tray = window_for_close
                            .app_handle()
                            .state::<std::sync::Arc<core::AppCore>>()
                            .close_to_tray();
                        if close_to_tray {
                            api.prevent_close();
                            let _ = window_for_close.hide();
                        } else {
                            window_for_close.app_handle().exit(0);
                        }
                    }
                    WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
                        let now = now_ms();
                        if now.saturating_sub(last_geometry_save.load(Ordering::Relaxed)) >= 500 {
                            last_geometry_save.store(now, Ordering::Relaxed);
                            save_geometry(&window_for_geometry);
                        }
                    }
                    _ => {}
                }
            });

            let core_state = app.state::<std::sync::Arc<core::AppCore>>();
            let playback_on = core_state.playback_enabled();
            let show = MenuItem::with_id(app, "show", "Открыть Reward Sounds", true, None::<&str>)?;
            let playback = CheckMenuItem::with_id(
                app,
                "playback",
                "Воспроизводить звуки",
                true,
                playback_on,
                None::<&str>,
            )?;
            let stop_all =
                MenuItem::with_id(app, "stop", "Остановить все звуки", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &playback, &stop_all, &quit])?;
            let playback_for_menu = playback.clone();
            let playback_for_events = playback.clone();
            let icon = app
                .default_window_icon()
                .cloned()
                .ok_or("Не найден значок приложения")?;
            TrayIconBuilder::with_id("main-tray")
                .icon(icon)
                .tooltip("Reward Sounds")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "show" => show_main(app),
                    "playback" => {
                        let core = app.state::<std::sync::Arc<core::AppCore>>();
                        let enabled = !core.playback_enabled();
                        core.set_playback_enabled(enabled);
                        let _ = playback_for_menu.set_checked(enabled);
                    }
                    "stop" => {
                        let core = app.state::<std::sync::Arc<core::AppCore>>();
                        if let Err(err) = core.stop_all_sounds() {
                            log::warn!("Не удалось остановить звуки из трея: {err}");
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    }
                    | TrayIconEvent::DoubleClick {
                        button: MouseButton::Left,
                        ..
                    } => show_main(tray.app_handle()),
                    _ => {}
                })
                .build(app)?;
            // Галочка в трее должна совпадать с тумблером в настройках.
            app.listen("playback-changed", move |event| {
                let enabled = event.payload().trim() == "true";
                let _ = playback_for_events.set_checked(enabled);
            });
            log::info!(
                "Трей создан; start_minimized={start_minimized}, close_to_tray={close_to_tray}"
            );

            if start_minimized {
                let _ = window.hide();
            } else {
                let _ = window.show();
                let _ = window.set_focus();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            core::get_state,
            core::refresh_rewards,
            core::choose_ytdlp_cookies,
            core::check_ytdlp_cookies,
            core::choose_sound,
            core::clear_sound,
            core::set_sound_volume,
            core::preview_sound,
            core::stop_all_sounds,
            core::music_toggle_pause,
            core::music_restart,
            core::music_next,
            core::music_undo_skip,
            core::music_skip,
            core::music_seek,
            core::music_clear_queue,
            core::music_remove_item,
            core::music_move_up,
            core::music_add_manual,
            core::music_show_overlay,
            core::music_recheck,
            core::music_set_volume,
            core::music_set_enabled,
            core::twitch_start_login,
            core::twitch_cancel_login,
            core::twitch_disconnect,
            core::set_app_setting,
            core::open_url,
            core::get_chat_overlay_settings,
            core::save_chat_overlay_settings,
            core::get_logs,
            core::clear_log,
            core::create_reward,
            core::update_reward,
            core::delete_reward,
            core::set_volume,
            core::set_music_settings,
            core::set_music_reward,
            core::apply_music_price,
            core::normalize_volumes,
            core::restart_audio,
            core::test_audio,
            core::exit_app,
            core::refresh_twitch_now,
            core::restart_eventsub,
            core::pick_sound_file,
            core::preview_path,
            core::open_folder,
            win_minimize,
            win_toggle_maximize,
            win_close,
            win_start_drag,
            win_hide,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Reward Sounds");
}