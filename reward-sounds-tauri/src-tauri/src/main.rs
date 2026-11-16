#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod core;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WindowEvent};

fn show_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn main() {
    // Один экземпляр: второй процесс тихо выходит, чтобы не запускать
    // второй EventSub/аудиодвижок. Порт — локальный «замок».
    let _single_instance = match std::net::TcpListener::bind("127.0.0.1:47831") {
        Ok(listener) => listener,
        Err(_) => return,
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

            let data_dir = app
                .path()
                .app_local_data_dir()
                .map_err(|err| -> Box<dyn std::error::Error> { Box::new(err) })?
                .join("EBWebView");
            std::fs::create_dir_all(&data_dir)?;
            let window = WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Reward Sounds")
            .inner_size(1220.0, 840.0)
            .min_inner_size(980.0, 680.0)
            .resizable(true)
            .maximizable(true)
            .minimizable(true)
            .decorations(false)
            .center()
            .data_directory(data_dir)
            .build();
            let window = match window {
                Ok(window) => window,
                Err(err) => {
                    eprintln!("WEBVIEW BUILD ERROR: {err:?}");
                    return Err(Box::new(err) as Box<dyn std::error::Error>);
                }
            };
            let window_for_close = window.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    if close_to_tray {
                        api.prevent_close();
                        let _ = window_for_close.hide();
                    } else {
                        window_for_close.app_handle().exit(0);
                    }
                }
            });

            let show = MenuItem::with_id(app, "show", "Открыть Reward Sounds", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            let icon = app
                .default_window_icon()
                .cloned()
                .ok_or("Не найден значок приложения")?;
            TrayIconBuilder::with_id("main-tray")
                .icon(icon)
                .tooltip("Reward Sounds")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main(app),
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
            core::choose_sound,
            core::clear_sound,
            core::set_sound_volume,
            core::preview_sound,
            core::stop_all_sounds,
            core::music_toggle_pause,
            core::music_restart,
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
            core::get_logs,
            core::create_reward,
            core::update_reward,
            core::delete_reward,
            core::set_volume,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Reward Sounds");
}
