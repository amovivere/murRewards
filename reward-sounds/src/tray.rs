//! Системный трей Windows.
//!
//! Реализован напрямую через `Shell_NotifyIconW` + скрытое окно с циклом
//! сообщений — без сторонних библиотек. Пункты меню приходят в оконную
//! процедуру как `WM_COMMAND`, поэтому выбор работает даже когда окно
//! приложения скрыто. Дополнительно окно приложения показывается напрямую,
//! чтобы «Открыть» срабатывало мгновенно.

use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use std::ptr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Duration;

use windows_sys::Win32::Foundation::{GetLastError, HWND, LPARAM, LRESULT, POINT, WPARAM};
use windows_sys::Win32::Graphics::Gdi::{
    CreateBitmap, CreateDIBSection, DeleteObject, GetDC, ReleaseDC, BITMAPINFO, BITMAPINFOHEADER,
    BI_RGB, DIB_RGB_COLORS, HGDIOBJ,
};
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
use windows_sys::Win32::UI::Shell::{
    Shell_NotifyIconW, NIF_ICON, NIF_MESSAGE, NIF_TIP, NIM_ADD, NIM_DELETE, NOTIFYICONDATAW,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    AppendMenuW, CreateIconIndirect, CreatePopupMenu, CreateWindowExW, DefWindowProcW,
    DestroyIcon, DestroyMenu, DestroyWindow, DispatchMessageW, GetCursorPos,
    LoadIconW as LoadIcon, PeekMessageW, PostMessageW, PostQuitMessage, RegisterClassW,
    SetForegroundWindow, TrackPopupMenu, TranslateMessage, ICONINFO, IDI_APPLICATION,
    MF_CHECKED, MF_SEPARATOR, MF_STRING, MSG, PM_REMOVE, TPM_RIGHTBUTTON,
    WM_APP, WM_CLOSE, WM_COMMAND, WM_DESTROY, WM_LBUTTONDBLCLK, WM_LBUTTONUP, WM_NULL,
    WM_RBUTTONUP, WNDCLASSW,
};

/// События трея для приложения.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Event {
    Open,
    TogglePlayback,
    StopAll,
    Exit,
}

/// Команды приложения в трей.
enum Command {
    SetEnabled(bool),
    Shutdown,
}

struct Shared {
    events: Sender<Event>,
    enabled: Arc<AtomicBool>,
    /// Контекст egui: трей просит интерфейс перерисоваться, чтобы событие
    /// обработалось сразу, а не ждало движения мыши над окном.
    ctx: eframe::egui::Context,
}

static SHARED: OnceLock<Mutex<Shared>> = OnceLock::new();

/// Публичный интерфейс трея.
pub struct Tray {
    commands: Sender<Command>,
    events: Receiver<Event>,
    enabled: Arc<AtomicBool>,
    available: Arc<AtomicBool>,
}

impl Tray {
    pub fn spawn(enabled: bool, ctx: eframe::egui::Context) -> Self {
        let (command_tx, command_rx) = mpsc::channel();
        let (event_tx, event_rx) = mpsc::channel();
        let enabled_flag = Arc::new(AtomicBool::new(enabled));
        let available_flag = Arc::new(AtomicBool::new(false));

        let thread_enabled = Arc::clone(&enabled_flag);
        let thread_available = Arc::clone(&available_flag);
        if let Err(err) = thread::Builder::new()
            .name("reward-sounds-tray".to_string())
            .spawn(move || run(event_tx, thread_enabled, thread_available, command_rx, ctx))
        {
            log::error!("Не удалось запустить поток трея: {err}");
        }

        Self {
            commands: command_tx,
            events: event_rx,
            enabled: enabled_flag,
            available: available_flag,
        }
    }

    /// Заглушка без потока и иконки: нужна для демо-режима и тестов.
    pub fn disabled() -> Self {
        let (command_tx, _command_rx) = mpsc::channel();
        let (_event_tx, event_rx) = mpsc::channel();
        Self {
            commands: command_tx,
            events: event_rx,
            enabled: Arc::new(AtomicBool::new(false)),
            available: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Обновляет состояние пункта «Воспроизводить звуки» в меню.
    pub fn set_enabled(&self, enabled: bool) {
        self.enabled.store(enabled, Ordering::SeqCst);
        let _ = self.commands.send(Command::SetEnabled(enabled));
    }

    pub fn poll(&self) -> Vec<Event> {
        self.events.try_iter().collect()
    }

    /// Удалось ли добавить иконку в трей (иначе окно нельзя скрывать).
    pub fn is_available(&self) -> bool {
        self.available.load(Ordering::SeqCst)
    }

    pub fn shutdown(&self) {
        let _ = self.commands.send(Command::Shutdown);
    }
}

impl Drop for Tray {
    fn drop(&mut self) {
        self.shutdown();
    }
}

fn run(
    events: Sender<Event>,
    enabled: Arc<AtomicBool>,
    available: Arc<AtomicBool>,
    commands: Receiver<Command>,
    ctx: eframe::egui::Context,
) {
    let _ = SHARED.set(Mutex::new(Shared {
        events: events.clone(),
        enabled: Arc::clone(&enabled),
        ctx,
    }));

    unsafe {
        let hinstance = GetModuleHandleW(ptr::null());
        let class_name = wide("RewardSoundsTrayWindow");
        let window_class = WNDCLASSW {
            style: 0,
            lpfnWndProc: Some(window_proc),
            cbClsExtra: 0,
            cbWndExtra: 0,
            hInstance: hinstance,
            hIcon: ptr::null_mut(),
            hCursor: ptr::null_mut(),
            hbrBackground: ptr::null_mut(),
            lpszMenuName: ptr::null(),
            lpszClassName: class_name.as_ptr(),
        };
        RegisterClassW(&window_class);

        let title = wide("RewardSoundsTrayHost");
        let hwnd = CreateWindowExW(
            0,
            class_name.as_ptr(),
            title.as_ptr(),
            0x8000_0000u32, // WS_POPUP: без заголовка и рамки
            0,
            0,
            0,
            0,
            ptr::null_mut(),
            ptr::null_mut(),
            hinstance,
            ptr::null_mut(),
        );
        if hwnd.is_null() {
            log::error!("Не удалось создать скрытое окно для трея");
            return;
        }

        let icon = create_tray_icon();

        let mut icon_data: NOTIFYICONDATAW = std::mem::zeroed();
        icon_data.cbSize = std::mem::size_of::<NOTIFYICONDATAW>() as u32;
        icon_data.hWnd = hwnd;
        icon_data.uID = 1;
        icon_data.uFlags = NIF_ICON | NIF_MESSAGE | NIF_TIP;
        icon_data.uCallbackMessage = WM_APP + 1;
        icon_data.hIcon = icon;

        let tooltip: Vec<u16> = OsStr::new("Reward Sounds")
            .encode_wide()
            .take(127)
            .collect();
        icon_data.szTip[..tooltip.len()].copy_from_slice(&tooltip);

        // Проводник может быть ещё не готов сразу после входа в систему,
        // поэтому пробуем несколько раз с паузой.
        let mut added = false;
        for attempt in 0..6 {
            if Shell_NotifyIconW(NIM_ADD, &icon_data) != 0 {
                added = true;
                break;
            }
            let code = GetLastError();
            log::warn!("Не удалось добавить иконку в трей (попытка {attempt}, код {code})");
            thread::sleep(Duration::from_millis(500));
        }
        available.store(added, Ordering::SeqCst);
        if added {
            log::info!("Иконка добавлена в системный трей");
        } else {
            log::error!("Трей недоступен: окно нельзя скрывать в трей");
        }

        let mut running = true;
        while running {
            let mut message: MSG = std::mem::zeroed();
            while PeekMessageW(&mut message, ptr::null_mut(), 0, 0, PM_REMOVE) != 0 {
                TranslateMessage(&message);
                DispatchMessageW(&message);
            }

            loop {
                match commands.try_recv() {
                    Ok(Command::SetEnabled(value)) => {
                        enabled.store(value, Ordering::SeqCst);
                    }
                    Ok(Command::Shutdown) => {
                        running = false;
                        break;
                    }
                    Err(mpsc::TryRecvError::Empty) => break,
                    Err(mpsc::TryRecvError::Disconnected) => {
                        running = false;
                        break;
                    }
                }
            }

            if running {
                thread::sleep(Duration::from_millis(50));
            }
        }

        Shell_NotifyIconW(NIM_DELETE, &icon_data);
        DestroyWindow(hwnd);
        if !icon.is_null() {
            DestroyIcon(icon);
        }
    }
}

unsafe extern "system" fn window_proc(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    // Пункт меню трея (WM_COMMAND приходит от TrackPopupMenu).
    if message == WM_COMMAND {
        let command = (wparam & 0xFFFF) as u32;
        log::info!("Трей: выбран пункт меню {command}");
        match command {
            1 => {
                show_app_window();
                send_event(Event::Open);
            }
            2 => send_event(Event::TogglePlayback),
            3 => send_event(Event::StopAll),
            4 => send_event(Event::Exit),
            _ => {}
        }
        return 0;
    }

    if message == WM_APP + 1 {
        let mouse_message = (lparam as u32) & 0xFFFF;
        if mouse_message == WM_LBUTTONUP || mouse_message == WM_LBUTTONDBLCLK {
            show_app_window();
            send_event(Event::Open);
        } else if mouse_message == WM_RBUTTONUP {
            show_menu(hwnd);
        }
        return 0;
    }

    match message {
        WM_CLOSE => {
            DestroyWindow(hwnd);
            0
        }
        WM_DESTROY => {
            PostQuitMessage(0);
            0
        }
        _ => DefWindowProcW(hwnd, message, wparam, lparam),
    }
}

/// Показывает окно приложения напрямую — чтобы «Открыть» срабатывало сразу.
unsafe fn show_app_window() {
    crate::window_ops::show_from_tray();
}

unsafe fn show_menu(hwnd: HWND) {
    let enabled = SHARED
        .get()
        .and_then(|shared| shared.lock().ok())
        .map(|shared| shared.enabled.load(Ordering::SeqCst))
        .unwrap_or(true);

    let menu = CreatePopupMenu();
    if menu.is_null() {
        return;
    }

    AppendMenuW(menu, MF_STRING, 1, wide("Открыть Reward Sounds").as_ptr());
    AppendMenuW(menu, MF_SEPARATOR, 0, ptr::null());
    let playback_flags = MF_STRING | if enabled { MF_CHECKED } else { 0 };
    AppendMenuW(
        menu,
        playback_flags,
        2,
        wide("Воспроизводить звуки").as_ptr(),
    );
    AppendMenuW(
        menu,
        MF_STRING,
        3,
        wide("Остановить все звуки").as_ptr(),
    );
    AppendMenuW(menu, MF_SEPARATOR, 0, ptr::null());
    AppendMenuW(menu, MF_STRING, 4, wide("Выход").as_ptr());

    let mut point: POINT = std::mem::zeroed();
    GetCursorPos(&mut point);

    SetForegroundWindow(hwnd);
    // Без TPM_RETURNCMD выбранный пункт приходит в оконную процедуру
    // как WM_COMMAND — это надёжнее для скрытого окна-владельца.
    TrackPopupMenu(
        menu,
        TPM_RIGHTBUTTON,
        point.x,
        point.y,
        0,
        hwnd,
        ptr::null(),
    );
    DestroyMenu(menu);
    PostMessageW(hwnd, WM_NULL, 0, 0);
}

fn send_event(event: Event) {
    if let Some(shared) = SHARED.get() {
        if let Ok(shared) = shared.lock() {
            let _ = shared.events.send(event);
            // Будим UI: без этого при простое окна событие ждало бы ввода.
            shared.ctx.request_repaint();
        }
    }
}

/// Создаёт иконку трея из иконки приложения (32-битная с прозрачностью).
unsafe fn create_tray_icon() -> windows_sys::Win32::UI::WindowsAndMessaging::HICON {
    let data = crate::icon::app_icon();
    let width = data.width as i32;
    let height = data.height as i32;

    let screen_dc = GetDC(ptr::null_mut());

    let mut bitmap_info: BITMAPINFO = std::mem::zeroed();
    bitmap_info.bmiHeader = BITMAPINFOHEADER {
        biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
        biWidth: width,
        biHeight: -height,
        biPlanes: 1,
        biBitCount: 32,
        biCompression: BI_RGB,
        biSizeImage: 0,
        biXPelsPerMeter: 0,
        biYPelsPerMeter: 0,
        biClrUsed: 0,
        biClrImportant: 0,
    };

    let mut bits: *mut core::ffi::c_void = ptr::null_mut();
    let color_bitmap = CreateDIBSection(
        screen_dc,
        &bitmap_info,
        DIB_RGB_COLORS,
        &mut bits,
        ptr::null_mut(),
        0,
    );

    if color_bitmap.is_null() || bits.is_null() {
        ReleaseDC(ptr::null_mut(), screen_dc);
        return fallback_icon();
    }

    let pixels = std::slice::from_raw_parts_mut(bits as *mut u8, (width * height * 4) as usize);
    let rgba = &data.rgba;
    for index in 0..(width * height) as usize {
        let source = index * 4;
        pixels[source] = rgba[source + 2];
        pixels[source + 1] = rgba[source + 1];
        pixels[source + 2] = rgba[source];
        pixels[source + 3] = rgba[source + 3];
    }

    // Монохромная маска (нужна для CreateIconIndirect).
    let mask_row_bytes = (((width + 15) / 16) * 2) as usize;
    let mask_bytes = vec![0u8; mask_row_bytes * height as usize];
    let mask_bitmap = CreateBitmap(
        width,
        height,
        1,
        1,
        mask_bytes.as_ptr() as *const core::ffi::c_void,
    );

    let icon_info = ICONINFO {
        fIcon: 1,
        xHotspot: 0,
        yHotspot: 0,
        hbmMask: mask_bitmap,
        hbmColor: color_bitmap,
    };
    let icon = CreateIconIndirect(&icon_info);

    DeleteObject(color_bitmap as HGDIOBJ);
    DeleteObject(mask_bitmap as HGDIOBJ);
    ReleaseDC(ptr::null_mut(), screen_dc);

    if icon.is_null() {
        fallback_icon()
    } else {
        icon
    }
}

unsafe fn fallback_icon() -> windows_sys::Win32::UI::WindowsAndMessaging::HICON {
    LoadIcon(ptr::null_mut(), IDI_APPLICATION)
}

fn wide(text: &str) -> Vec<u16> {
    OsStr::new(text)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_icon_from_app_icon() {
        let icon = unsafe { create_tray_icon() };
        assert!(!icon.is_null(), "иконка трея должна создаваться");
        unsafe { DestroyIcon(icon) };
    }

    #[test]
    fn window_class_registers() {
        unsafe {
            let hinstance = GetModuleHandleW(ptr::null());
            let name = wide("RewardSoundsTrayTestWindow");
            let class = WNDCLASSW {
                style: 0,
                lpfnWndProc: Some(DefWindowProcW),
                cbClsExtra: 0,
                cbWndExtra: 0,
                hInstance: hinstance,
                hIcon: ptr::null_mut(),
                hCursor: ptr::null_mut(),
                hbrBackground: ptr::null_mut(),
                lpszMenuName: ptr::null(),
                lpszClassName: name.as_ptr(),
            };
            assert_ne!(
                RegisterClassW(&class),
                0,
                "класс окна трея должен регистрироваться"
            );
        }
    }

    #[test]
    fn wm_command_routes_menu_choices() {
        let (tx, rx) = mpsc::channel();
        SHARED.get_or_init(|| {
            Mutex::new(Shared {
                events: tx,
                enabled: Arc::new(AtomicBool::new(true)),
                ctx: eframe::egui::Context::default(),
            })
        });

        unsafe {
            window_proc(ptr::null_mut(), WM_COMMAND, 2, 0);
            window_proc(ptr::null_mut(), WM_COMMAND, 3, 0);
            window_proc(ptr::null_mut(), WM_COMMAND, 4, 0);
        }

        let events: Vec<Event> = rx.try_iter().collect();
        assert_eq!(
            events,
            vec![Event::TogglePlayback, Event::StopAll, Event::Exit]
            ,
            "пункты меню должны превращаться в события для приложения"
        );
    }
}
