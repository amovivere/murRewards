//! Скрытие окна «в трей» без остановки цикла отрисовки.
//!
//! eframe/winit перестаёт присылать обновления, если окно действительно
//! скрыть (`Visible(false)`). Поэтому окно не скрывается, а уводится за
//! пределы экрана и убирается из панели задач. Для системы окно остаётся
//! видимым, приложение продолжает обрабатывать награды и события трея.

use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use std::ptr;

use windows_sys::Win32::Foundation::{HWND, RECT};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    FindWindowW, GetSystemMetrics, GetWindowLongPtrW, GetWindowRect, SetForegroundWindow,
    SetWindowLongPtrW, SetWindowPos, ShowWindow, GWL_EXSTYLE, SM_CXSCREEN, SM_CYSCREEN,
    SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOSIZE, SWP_NOZORDER, SWP_SHOWWINDOW, SW_RESTORE,
    WS_EX_APPWINDOW, WS_EX_TOOLWINDOW,
};

const OFF_SCREEN: i32 = -32000;

fn wide(text: &str) -> Vec<u16> {
    OsStr::new(text)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

fn app_window() -> Option<HWND> {
    let title = wide("Reward Sounds");
    let hwnd = unsafe { FindWindowW(ptr::null(), title.as_ptr()) };
    if hwnd.is_null() {
        None
    } else {
        Some(hwnd)
    }
}

/// Убирает окно с экрана и из панели задач, не скрывая его для Windows.
pub fn hide_to_tray() {
    let Some(hwnd) = app_window() else {
        return;
    };

    unsafe {
        set_tool_window(hwnd, true);
        SetWindowPos(
            hwnd,
            ptr::null_mut(),
            OFF_SCREEN,
            OFF_SCREEN,
            0,
            0,
            SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
        );
    }
}

/// Возвращает окно на экран по центру и активирует его.
pub fn show_from_tray() {
    let Some(hwnd) = app_window() else {
        return;
    };

    unsafe {
        set_tool_window(hwnd, false);

        let mut rect: RECT = std::mem::zeroed();
        GetWindowRect(hwnd, &mut rect);
        let width = (rect.right - rect.left).max(880);
        let height = (rect.bottom - rect.top).max(620);

        let screen_width = GetSystemMetrics(SM_CXSCREEN);
        let screen_height = GetSystemMetrics(SM_CYSCREEN);
        let x = ((screen_width - width) / 2).max(0);
        let y = ((screen_height - height) / 2).max(0);

        SetWindowPos(
            hwnd,
            ptr::null_mut(),
            x,
            y,
            width,
            height,
            SWP_SHOWWINDOW | SWP_NOZORDER | SWP_FRAMECHANGED,
        );
        ShowWindow(hwnd, SW_RESTORE);
        SetForegroundWindow(hwnd);
    }
}

/// Управляет признаком «окно только в трее» (не показывать в панели задач).
unsafe fn set_tool_window(hwnd: HWND, hidden: bool) {
    let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
    let new_style = if hidden {
        (style | WS_EX_TOOLWINDOW) & !WS_EX_APPWINDOW
    } else {
        (style & !WS_EX_TOOLWINDOW) | WS_EX_APPWINDOW
    };

    if new_style != style {
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_style as isize);
    }
}
