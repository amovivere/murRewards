//! Автозапуск вместе с Windows.
//!
//! Значение пишется в `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run` —
//! это не требует прав администратора и легко отключается.
//! При автозапуске приложение стартует сразу в трее (`--minimized`).

use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use std::path::Path;
use std::ptr;

use windows_sys::Win32::Foundation::{ERROR_FILE_NOT_FOUND, ERROR_SUCCESS};
use windows_sys::Win32::System::Registry::{
    RegCloseKey, RegCreateKeyExW, RegDeleteValueW, RegGetValueW, RegOpenKeyExW, RegSetValueExW,
    HKEY, HKEY_CURRENT_USER, KEY_SET_VALUE, REG_OPTION_NON_VOLATILE, REG_SZ, RRF_RT_REG_SZ,
};

const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const VALUE_NAME: &str = "RewardSounds";
const ARGUMENT: &str = "--minimized";

/// Включён ли автозапуск для текущего exe.
pub fn is_enabled() -> bool {
    let Ok(exe) = std::env::current_exe() else {
        return false;
    };

    let mut buffer = [0u16; 2048];
    let mut size = (buffer.len() * 2) as u32;
    let status = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            wide(RUN_KEY).as_ptr(),
            wide(VALUE_NAME).as_ptr(),
            RRF_RT_REG_SZ,
            ptr::null_mut(),
            buffer.as_mut_ptr() as *mut core::ffi::c_void,
            &mut size,
        )
    };
    if status != ERROR_SUCCESS {
        return false;
    }

    let length = (size as usize / 2).saturating_sub(1).min(buffer.len());
    let value = String::from_utf16_lossy(&buffer[..length]);
    refers_to_exe(&value, &exe)
}

/// Включает или выключает автозапуск.
pub fn set_enabled(enabled: bool) -> Result<(), String> {
    if enabled {
        let exe = std::env::current_exe()
            .map_err(|err| format!("Не удалось определить путь программы: {err}"))?;
        let command = command_line(&exe);

        let mut key: HKEY = ptr::null_mut();
        let mut disposition: u32 = 0;
        let status = unsafe {
            RegCreateKeyExW(
                HKEY_CURRENT_USER,
                wide(RUN_KEY).as_ptr(),
                0,
                ptr::null(),
                REG_OPTION_NON_VOLATILE,
                KEY_SET_VALUE,
                ptr::null(),
                &mut key,
                &mut disposition,
            )
        };
        if status != ERROR_SUCCESS {
            return Err(format!(
                "Не удалось открыть реестр для автозапуска (код {status})"
            ));
        }

        let data: Vec<u16> = command.encode_utf16().chain(std::iter::once(0)).collect();
        let status = unsafe {
            RegSetValueExW(
                key,
                wide(VALUE_NAME).as_ptr(),
                0,
                REG_SZ,
                data.as_ptr() as *const u8,
                (data.len() * 2) as u32,
            )
        };
        unsafe { RegCloseKey(key) };

        if status != ERROR_SUCCESS {
            return Err(format!("Не удалось записать автозапуск (код {status})"));
        }
        log::info!("Автозапуск включён: {command}");
        Ok(())
    } else {
        let mut key: HKEY = ptr::null_mut();
        let status = unsafe {
            RegOpenKeyExW(
                HKEY_CURRENT_USER,
                wide(RUN_KEY).as_ptr(),
                0,
                KEY_SET_VALUE,
                &mut key,
            )
        };
        if status != ERROR_SUCCESS {
            return Ok(());
        }

        let status = unsafe { RegDeleteValueW(key, wide(VALUE_NAME).as_ptr()) };
        unsafe { RegCloseKey(key) };

        if status == ERROR_SUCCESS || status == ERROR_FILE_NOT_FOUND {
            log::info!("Автозапуск выключен");
            Ok(())
        } else {
            Err(format!("Не удалось убрать автозапуск (код {status})"))
        }
    }
}

fn wide(text: &str) -> Vec<u16> {
    OsStr::new(text)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

/// Командная строка автозапуска: `"путь" --minimized`.
fn command_line(exe: &Path) -> String {
    format!("\"{}\" {ARGUMENT}", exe.display())
}

/// Относится ли сохранённое значение реестра к нашему exe.
fn refers_to_exe(value: &str, exe: &Path) -> bool {
    let value = value.to_lowercase();
    let exe_text = exe.to_string_lossy().to_lowercase();
    value.contains(&exe_text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_quoted_command_line() {
        let line = command_line(Path::new(r"C:\Program Files\Reward Sounds\Reward Sounds.exe"));
        assert_eq!(
            line,
            r#""C:\Program Files\Reward Sounds\Reward Sounds.exe" --minimized"#
        );
    }

    #[test]
    fn recognizes_our_exe_in_registry_value() {
        let exe = Path::new(r"C:\Tools\Reward Sounds.exe");
        assert!(refers_to_exe(
            r#""C:\Tools\Reward Sounds.exe" --minimized"#,
            exe
        ));
        assert!(refers_to_exe(r#"C:\tools\reward sounds.exe"#, exe));
        assert!(!refers_to_exe(r#""C:\Other\App.exe""#, exe));
    }
}
