import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\main.rs")
s=p.read_text(encoding="utf-8")
s=s.replace("""            core::preview_sound,
            core::stop_all_sounds,
        ])""","""            core::preview_sound,
            core::stop_all_sounds,
            core::music_toggle_pause,
            core::music_restart,
            core::music_skip,
            core::music_seek,
            core::music_clear_queue,
            core::music_remove_item,
            core::music_move_up,
            core::music_add_manual,
            core::music_show_overlay,
            core::music_recheck,
            core::music_set_volume,
            core::music_set_enabled,
        ])""")
p.write_text(s,encoding="utf-8")
print("commands registered")