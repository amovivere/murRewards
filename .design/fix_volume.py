import pathlib
base=pathlib.Path(r"F:\WorkSpaces\Mur rewards")
p=base/"reward-sounds-tauri"/"src-tauri"/"src"/"core.rs"
s=p.read_text(encoding="utf-8")
needle="""#[tauri::command]
pub fn choose_sound("""
assert needle in s
s=s.replace(needle,"""#[tauri::command]
pub fn set_volume(core: State<'_, Arc<AppCore>>, volume: f64) -> CoreView {
    {
        let mut inner = core.lock();
        inner.settings.volume = volume.clamp(0.0, 1.0);
        inner.settings.muted = false;
        let effective = inner.settings.effective_volume();
        let _ = inner.audio.set_volume(effective);
    }
    core.save();
    core.view()
}

#[tauri::command]
pub fn choose_sound(""",1)
p.write_text(s,encoding="utf-8")
p=base/"reward-sounds-tauri"/"src-tauri"/"src"/"main.rs"
s=p.read_text(encoding="utf-8")
s=s.replace("""            core::delete_reward,
        ])""","""            core::delete_reward,
            core::set_volume,
        ])""")
p.write_text(s,encoding="utf-8")
# журнал: показывать дату
p=base/"reward-sounds-tauri"/"src-tauri"/"ui"/"app.js"
s=p.read_text(encoding="utf-8")
s=s.replace("<span class=\"log-time\">${escapeHtml(entry.time.slice(11))}</span>",
            "<span class=\"log-time\">${escapeHtml(entry.time.slice(5, 19))}</span>")
p.write_text(s,encoding="utf-8")
print("set_volume + log time")