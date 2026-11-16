import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\core.rs")
s=p.read_text(encoding="utf-8")
s=s.replace("""        if let Ok(mut state) = inner.playback_state.lock() {
            state.sync(&inner.settings);
        }
    }""","""        {
            if let Ok(mut state) = inner.playback_state.lock() {
                state.sync(&inner.settings);
            }
        }
    }""")
p.write_text(s,encoding="utf-8")
print("scoped playback lock")