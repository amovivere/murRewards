import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\main.rs")
s=p.read_text(encoding="utf-8")
s=s.replace('''            .decorations(false)
            .center()
            .build();''','''            .decorations(false)
            .center()
            .data_directory(std::path::PathBuf::from(
                r"C:\\Users\\mur\\AppData\\Local\\RewardSoundsTauri\\EBWebView",
            ))
            .additional_browser_args("--no-sandbox --disable-gpu-sandbox --disable-features=RendererCodeIntegrity")
            .build();''')
p.write_text(s,encoding="utf-8")
print("data dir + args")