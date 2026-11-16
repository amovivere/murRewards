import json, pathlib
conf=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\tauri.conf.json")
data=json.loads(conf.read_text(encoding="utf-8"))
data["app"]["windows"]=[]
conf.write_text(json.dumps(data, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
main=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\main.rs")
s=main.read_text(encoding="utf-8")
s=s.replace('''        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title("Reward Sounds");
                let _ = window.show();
            }
            Ok(())
        })''','''        .setup(|app| {
            use tauri::WebviewWindowBuilder;
            let window = WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Reward Sounds")
            .inner_size(1220.0, 840.0)
            .min_inner_size(980.0, 680.0)
            .decorations(false)
            .center()
            .build()
            .map_err(|err| -> Box<dyn std::error::Error> { Box::new(err) })?;
            let _ = window.show();
            Ok(())
        })''')
main.write_text(s,encoding="utf-8")
print("manual window")