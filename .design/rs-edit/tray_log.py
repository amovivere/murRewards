import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\main.rs")
s=p.read_text(encoding="utf-8")
s=s.replace("""                .build(app)?;

            if start_minimized {""","""                .build(app)?;
            log::info!(
                "Трей создан; start_minimized={start_minimized}, close_to_tray={close_to_tray}"
            );

            if start_minimized {""")
p.write_text(s,encoding="utf-8")
print("tray log")