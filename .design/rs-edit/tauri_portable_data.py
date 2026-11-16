import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\main.rs")
s=p.read_text(encoding="utf-8")
s=s.replace('''        .setup(|app| {
            use tauri::WebviewWindowBuilder;
            let window = WebviewWindowBuilder::new(''','''        .setup(|app| {
            use tauri::WebviewWindowBuilder;
            let data_dir = app
                .path()
                .app_local_data_dir()
                .map_err(|err| -> Box<dyn std::error::Error> { Box::new(err) })?
                .join("EBWebView");
            std::fs::create_dir_all(&data_dir)?;
            let window = WebviewWindowBuilder::new(''')
s=s.replace('''            .center()
            .data_directory(std::path::PathBuf::from(
                r"C:\\Users\\mur\\AppData\\Local\\RewardSoundsTauri\\EBWebView",
            ))
            .additional_browser_args("--no-sandbox --disable-gpu-sandbox --disable-features=RendererCodeIntegrity")
            .build();''','''            .center()
            .data_directory(data_dir)
            .build();''')
p.write_text(s,encoding="utf-8")
print("portable data dir")