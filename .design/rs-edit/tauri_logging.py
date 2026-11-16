import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\main.rs")
s=p.read_text(encoding="utf-8")
s=s.replace("""            use tauri::WebviewWindowBuilder;

            let state = core::AppCore::start();""","""            use tauri::WebviewWindowBuilder;

            let paths = reward_sounds::config::AppPaths::resolve();
            let logger = reward_sounds::logging::init(&paths.log_dir);
            std::mem::forget(logger);

            let state = core::AppCore::start();""")
p.write_text(s,encoding="utf-8")
print("logging enabled")