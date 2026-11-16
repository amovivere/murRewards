//! Защищённое хранение токенов Twitch.
//!
//! Токены шифруются встроенным в Windows DPAPI (`CryptProtectData`): ключ
//! привязан к учётной записи Windows, поэтому файл настроек не даёт токен
//! ни другому пользователю компьютера, ни при копировании на другую машину.
//! В `config.toml` попадает только шифротекст в hex-виде, открытый токен
//! никогда не записывается на диск и не попадает в журнал.

use std::ptr;

use windows_sys::Win32::Foundation::LocalFree;
use windows_sys::Win32::Security::Cryptography::{
    CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
};

/// Шифрует строку и возвращает hex-строку шифротекста.
pub fn protect(plaintext: &str) -> Result<String, String> {
    let mut data = plaintext.as_bytes().to_vec();
    let input = CRYPT_INTEGER_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_mut_ptr(),
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: ptr::null_mut(),
    };

    // SAFETY: входной буфер жив до конца вызова, выходной освобождается через LocalFree.
    let ok = unsafe {
        CryptProtectData(
            &input,
            ptr::null(),
            ptr::null(),
            ptr::null(),
            ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };

    if ok == 0 {
        return Err("Не удалось зашифровать токен средствами Windows".to_string());
    }

    let encrypted = unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize) }
        .to_vec();
    unsafe {
        LocalFree(output.pbData as *mut core::ffi::c_void);
    }

    Ok(to_hex(&encrypted))
}

/// Расшифровывает hex-строку, полученную из [`protect`].
pub fn unprotect(hex: &str) -> Result<String, String> {
    if hex.trim().is_empty() {
        return Err("Токен отсутствует".to_string());
    }

    let mut encrypted =
        from_hex(hex.trim()).ok_or_else(|| "Данные токена повреждены".to_string())?;
    let input = CRYPT_INTEGER_BLOB {
        cbData: encrypted.len() as u32,
        pbData: encrypted.as_mut_ptr(),
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: ptr::null_mut(),
    };

    // SAFETY: аналогично protect; описание не запрашивается (null).
    let ok = unsafe {
        CryptUnprotectData(
            &input,
            ptr::null_mut(),
            ptr::null(),
            ptr::null(),
            ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };

    if ok == 0 {
        return Err(
            "Не удалось расшифровать токен: данные сохранены под другой учётной записью Windows"
                .to_string(),
        );
    }

    let decrypted = unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize) }
        .to_vec();
    unsafe {
        LocalFree(output.pbData as *mut core::ffi::c_void);
    }

    String::from_utf8(decrypted).map_err(|_| "Токен повреждён".to_string())
}

fn to_hex(bytes: &[u8]) -> String {
    let mut result = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        result.push_str(&format!("{byte:02x}"));
    }
    result
}

fn from_hex(text: &str) -> Option<Vec<u8>> {
    if text.len() % 2 != 0 {
        return None;
    }
    let mut result = Vec::with_capacity(text.len() / 2);
    let bytes = text.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        let pair = std::str::from_utf8(&bytes[index..index + 2]).ok()?;
        result.push(u8::from_str_radix(pair, 16).ok()?);
        index += 2;
    }
    Some(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hex_round_trip() {
        let data = vec![0u8, 1, 15, 16, 255, 128];
        let text = to_hex(&data);
        assert_eq!(text, "00010f10ff80");
        assert_eq!(from_hex(&text).unwrap(), data);
        assert!(from_hex("abc").is_none());
        assert!(from_hex("zz").is_none());
    }

    #[test]
    fn dpapi_round_trip() {
        let secret = "secret-token-пример-123";
        let encrypted = protect(secret).expect("шифрование должно работать");
        assert_ne!(encrypted, secret, "шифротекст не должен совпадать с токеном");
        assert!(encrypted.chars().all(|c| c.is_ascii_hexdigit()));

        let restored = unprotect(&encrypted).expect("расшифровка должна работать");
        assert_eq!(restored, secret);
    }

    #[test]
    fn unprotect_rejects_garbage() {
        assert!(unprotect("").is_err());
        assert!(unprotect("zzzz").is_err());
        assert!(unprotect("00").is_err());
    }
}
