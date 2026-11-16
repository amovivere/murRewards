use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::Path;

fn hash_dir(path: &Path, hasher: &mut DefaultHasher) {
    let Ok(entries) = std::fs::read_dir(path) else {
        return;
    };
    let mut entries: Vec<_> = entries.flatten().collect();
    entries.sort_by_key(|entry| entry.path());
    for entry in entries {
        let path = entry.path();
        if path.is_dir() {
            hash_dir(&path, hasher);
        } else if let Ok(bytes) = std::fs::read(&path) {
            path.file_name().map(|name| name.hash(hasher));
            bytes.hash(hasher);
        }
    }
}

fn main() {
    // Меняем переменную окружения при каждом изменении UI, чтобы Cargo
    // перекомпилировал main и обновил встроенные ассеты `generate_context!`.
    let mut hasher = DefaultHasher::new();
    hash_dir(Path::new("ui"), &mut hasher);
    println!("cargo:rerun-if-changed=ui");
    println!("cargo:rustc-env=REWARD_SOUNDS_UI_HASH={:016x}", hasher.finish());
    tauri_build::build()
}
