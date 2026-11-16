//! Reward Sounds — точка входа.
//!
//! Обычный запуск: `reward-sounds.exe`.
//! Запуск свёрнутым: `reward-sounds.exe --minimized` (используется автозапуском).
//! В релизной сборке консоль не открывается (`windows_subsystem = "windows"`).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;

use eframe::egui;
use reward_sounds::app::RewardSoundsApp;
use reward_sounds::config::{AppPaths, Settings};
use reward_sounds::{icon, logging, theme};

fn main() -> eframe::Result<()> {
    let paths = AppPaths::resolve();
    let logger = logging::init(&paths.log_dir);
    // Демо-режим: отдельные mutex и заголовок окна, чтобы не конфликтовать
    // с рабочей копией при показе примеров и съёмке скриншотов.
    let demo = std::env::var_os("REWARD_SOUNDS_DEMO").is_some();
    log::info!(
        "Запуск Reward Sounds v{} (Windows){}",
        reward_sounds::VERSION,
        if demo { " [демо]" } else { "" }
    );

    if let Err(err) = paths.ensure_dirs() {
        log::error!("Не удалось создать папки данных: {err}");
    }

    // Один экземпляр: при повторном запуске показываем уже открытое окно.
    if !ensure_single_instance(demo) {
        log::info!("Reward Sounds уже запущен — открыто существующее окно");
        return Ok(());
    }

    // Запуск свёрнутым: флаг от автозапуска или настройка «только иконка в трее».
    let start_hidden = std::env::args().any(|arg| arg == "--minimized")
        || Settings::load(&paths.config_file).0.start_minimized;

    let mut viewport = egui::ViewportBuilder::default()
        .with_title(if demo {
            "Reward Sounds — демо"
        } else {
            "Reward Sounds"
        })
        .with_inner_size([1220.0, 840.0])
        .with_min_inner_size([980.0, 680.0])
        .with_icon(Arc::new(icon::app_icon()));
    if start_hidden {
        // Сразу за пределами экрана, чтобы не было мигания при автозапуске.
        viewport = viewport.with_position([-32000.0, -32000.0]);
    }

    let options = eframe::NativeOptions {
        viewport,
        centered: !start_hidden,
        // 4×MSAA: тонкие скруглённые рамки чипов/кнопок выглядят заметно чище.
        multisampling: 4,
        ..Default::default()
    };

    let result = eframe::run_native(
        "Reward Sounds",
        options,
        Box::new(move |cc| {
            theme::apply(&cc.egui_ctx);
            Ok(Box::new(RewardSoundsApp::new(cc, paths, logger, start_hidden)))
        }),
    );

    if let Err(err) = &result {
        log::error!("Не удалось запустить окно приложения: {err}");
        show_error_box(&format!(
            "Reward Sounds не смог открыть окно.\n\n{err}\n\nПодробности записаны в журнал:\n%APPDATA%\\RewardSounds\\logs\\reward-sounds.log"
        ));
    }

    result
}

/// Показывает системное окно с ошибкой — на случай, если окно приложения
/// вообще не открылось (в релизной сборке консоли нет).
fn show_error_box(message: &str) {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};

        let to_wide = |text: &str| -> Vec<u16> {
            std::ffi::OsStr::new(text)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect()
        };

        let text = to_wide(message);
        let caption = to_wide("Reward Sounds");

        // SAFETY: строки завершены нулём и живут до конца вызова.
        unsafe {
            MessageBoxW(
                std::ptr::null_mut(),
                text.as_ptr(),
                caption.as_ptr(),
                MB_OK | MB_ICONERROR,
            );
        }
    }

    #[cfg(not(windows))]
    {
        eprintln!("{message}");
    }
}

/// Не даёт запустить второй экземпляр приложения.
#[cfg(windows)]
fn ensure_single_instance(demo: bool) -> bool {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Foundation::GetLastError;
    use windows_sys::Win32::System::Threading::CreateMutexW;

    let name = if demo {
        r"Local\RewardSoundsSingleInstanceDemo"
    } else {
        r"Local\RewardSoundsSingleInstance"
    };
    let name: Vec<u16> = std::ffi::OsStr::new(name)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    // SAFETY: имя с завершающим нулём, дескриптор держим до конца процесса.
    let handle = unsafe { CreateMutexW(std::ptr::null(), 0, name.as_ptr()) };
    if handle.is_null() {
        return true;
    }

    const ERROR_ALREADY_EXISTS: u32 = 183;
    if unsafe { GetLastError() } == ERROR_ALREADY_EXISTS {
        if !demo {
            show_existing_window();
        }
        return false;
    }

    true
}

#[cfg(not(windows))]
fn ensure_single_instance(_demo: bool) -> bool {
    true
}

/// Показывает окно уже запущенного экземпляра.
#[cfg(windows)]
fn show_existing_window() {
    reward_sounds::window_ops::show_from_tray();
}
