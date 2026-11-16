//! Мелкие вспомогательные функции.

use std::path::Path;

/// Размер файла в понятном виде: «1,8 МБ», «320 КБ», «900 Б».
pub fn format_size(bytes: u64) -> String {
    const KB: f64 = 1024.0;
    let value = bytes as f64;

    if value < KB {
        format!("{bytes} Б")
    } else if value < KB * KB {
        format!("{:.0} КБ", value / KB)
    } else if value < KB * KB * KB {
        format!("{:.1} МБ", value / (KB * KB))
    } else {
        format!("{:.2} ГБ", value / (KB * KB * KB))
    }
}

/// Имя файла без папки.
pub fn file_name(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| path.display().to_string())
}

/// Имя файла без расширения — используется как название звука по умолчанию.
pub fn file_stem(path: &Path) -> String {
    path.file_stem()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| file_name(path))
}

/// Громкость в процентах: 0.8 -> «80%».
pub fn format_volume(volume: f32) -> String {
    format!("{:.0}%", (volume.clamp(0.0, 1.0) * 100.0).round())
}

/// Русское склонение: 1 звук, 2 звука, 5 звуков.
pub fn plural_ru<'a>(count: usize, one: &'a str, few: &'a str, many: &'a str) -> &'a str {
    let last_two = count % 100;
    if (11..=14).contains(&last_two) {
        return many;
    }
    match count % 10 {
        1 => one,
        2..=4 => few,
        _ => many,
    }
}

/// Открыть папку в стандартном проводнике Windows.
pub fn open_in_explorer(path: &Path) {
    let target = if path.is_dir() {
        path.to_path_buf()
    } else {
        path.parent().map(Path::to_path_buf).unwrap_or_default()
    };

    if target.as_os_str().is_empty() {
        return;
    }

    if let Err(err) = std::process::Command::new("explorer").arg(&target).spawn() {
        log::warn!("Не удалось открыть проводник: {err}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plurals_are_correct() {
        assert_eq!(plural_ru(1, "звук", "звука", "звуков"), "звук");
        assert_eq!(plural_ru(2, "звук", "звука", "звуков"), "звука");
        assert_eq!(plural_ru(5, "звук", "звука", "звуков"), "звуков");
        assert_eq!(plural_ru(11, "звук", "звука", "звуков"), "звуков");
        assert_eq!(plural_ru(21, "звук", "звука", "звуков"), "звук");
        assert_eq!(plural_ru(112, "звук", "звука", "звуков"), "звуков");
    }

    #[test]
    fn sizes_are_human_readable() {
        assert_eq!(format_size(900), "900 Б");
        assert_eq!(format_size(2048), "2 КБ");
        assert_eq!(format_size(3 * 1024 * 1024), "3.0 МБ");
    }

    #[test]
    fn volume_formatting() {
        assert_eq!(format_volume(0.804), "80%");
        assert_eq!(format_volume(1.5), "100%");
    }
}
