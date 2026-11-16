# -*- coding: utf-8 -*-
"""Трей, single-instance и close-to-tray для Tauri."""
import pathlib

# feature tray-icon
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\Cargo.toml")
s = p.read_text(encoding="utf-8")
s = s.replace('tauri = { version = "2", features = [] }', 'tauri = { version = "2", features = ["tray-icon", "image-png"] }')
p.write_text(s, encoding="utf-8")

# методы AppCore
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\core.rs")
s = p.read_text(encoding="utf-8")
needle = """    fn lock(&self) -> MutexGuard<'_, Inner> {"""
assert needle in s
s = s.replace(needle, """    pub fn close_to_tray(&self) -> bool {
        self.lock().settings.close_to_tray
    }

    pub fn start_minimized(&self) -> bool {
        self.lock().settings.start_minimized
    }

    fn lock(&self) -> MutexGuard<'_, Inner> {""", 1)
p.write_text(s, encoding="utf-8")

# main.rs
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\main.rs")
s = p.read_text(encoding="utf-8")
s = s.replace("use tauri::Manager;", """use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WindowEvent};

fn show_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}""")

s = s.replace("""fn main() {
    tauri::Builder::default()""", """fn main() {
    // Один экземпляр: второй процесс тихо выходит, чтобы не запускать
    // второй EventSub/аудиодвижок. Порт — локальный «замок».
    let _single_instance = match std::net::TcpListener::bind("127.0.0.1:47831") {
        Ok(listener) => listener,
        Err(_) => return,
    };

    tauri::Builder::default()""")

s = s.replace("""            let state = core::AppCore::start();
            app.manage(state);""", """            let state = core::AppCore::start();
            let start_minimized = state.start_minimized();
            let close_to_tray = state.close_to_tray();
            app.manage(state);""")

s = s.replace("""            let _ = window.show();
            Ok(())""", """            let window_for_close = window.clone();
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

            if start_minimized {
                let _ = window.hide();
            } else {
                let _ = window.show();
                let _ = window.set_focus();
            }
            Ok(())""")
p.write_text(s, encoding="utf-8")
print("tray/single-instance patched")
