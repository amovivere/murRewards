import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\core.rs")
s=p.read_text(encoding="utf-8")
start=s.index("    fn save(&self) {")
end=s.index("    /// При запуске: обновляет токен", start)
new='''    fn save(&self) {
        let (playback_state, settings) = {
            let inner = self.lock();
            if let Err(err) = inner.settings.save(&self.paths.config_file) {
                log::warn!("Не удалось сохранить настройки: {err}");
            }
            (Arc::clone(&inner.playback_state), inner.settings.clone())
        };
        if let Ok(mut state) = playback_state.lock() {
            state.sync(&settings);
        }
    }

'''
s=s[:start]+new+s[end:]
p.write_text(s,encoding="utf-8")
print("save rewritten")