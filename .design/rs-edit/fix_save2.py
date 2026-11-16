import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\core.rs")
s=p.read_text(encoding="utf-8")
s=s.replace("""        if let Ok(mut state) = playback_state.lock() {
            state.sync(&settings);
        }
    }""","""        let mut state = playback_state
            .lock()
            .unwrap_or_else(|err| err.into_inner());
        state.sync(&settings);
        drop(state);
    }""")
p.write_text(s,encoding="utf-8")
print("explicit drop")