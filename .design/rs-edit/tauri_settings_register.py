import pathlib
# Cargo: webbrowser
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\Cargo.toml")
s=p.read_text(encoding="utf-8")
if 'webbrowser' not in s:
    s=s.replace('rfd = ', 'webbrowser = "1.2"\nrfd = ')
p.write_text(s,encoding="utf-8")
# main: команды
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\main.rs")
s=p.read_text(encoding="utf-8")
s=s.replace("""            core::music_set_enabled,
        ])""","""            core::music_set_enabled,
            core::twitch_start_login,
            core::twitch_cancel_login,
            core::twitch_disconnect,
            core::set_app_setting,
            core::open_url,
        ])""")
p.write_text(s,encoding="utf-8")
print("registered settings commands")