# -*- coding: utf-8 -*-
import pathlib
# app.js patched
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.js")
s=p.read_text(encoding="utf-8")
s=s.replace("""    $$('.slider', root).forEach((slider) => {
      if (slider.id === 'top-volume') return;
""","""    $$('.slider', root).forEach((slider) => {
      if (slider.id === 'top-volume') return;
      if (slider.closest('#music-player')) return;
""")
s=s.replace("""    const meta = row.querySelectorAll('div div div')[0];
    if (meta) meta.textContent = '@manual · —';
""","""    const meta = Array.from(row.querySelectorAll('div')).find((el) => el.textContent.trim().startsWith('@'));
    if (meta) meta.textContent = '@manual · —';
""")
p.write_text(s,encoding="utf-8")

# main.rs: u32 cost + set_volume command
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\main.rs")
s=p.read_text(encoding="utf-8")
s=s.replace("    music_reward_cost: i64,", "    music_reward_cost: u32,")
s=s.replace("""#[tauri::command]
fn win_minimize(""","""/// Сохраняет общую громкость в общий конфиг приложения.
#[tauri::command]
fn set_volume(volume: f64) {
    let paths = reward_sounds::config::AppPaths::resolve();
    let (mut settings, _) = reward_sounds::config::Settings::load(&paths.config_file);
    settings.volume = volume.clamp(0.0, 1.0);
    settings.muted = false;
    if let Err(err) = settings.save(&paths.config_file) {
        log::warn!("Не удалось сохранить громкость: {err}");
    }
}

#[tauri::command]
fn win_minimize(""")
s=s.replace("""            core_status,
            win_minimize,""","""            core_status,
            set_volume,
            win_minimize,""")
p.write_text(s,encoding="utf-8")

# CSS: кнопки окна
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.css")
s=p.read_text(encoding="utf-8")
s += """
/* кнопки управления окном */
.titlebar .winbtn {
  width: 38px; height: 26px; border-radius: 7px; display: flex; align-items: center;
  justify-content: center; color: #8B8B8B; cursor: pointer; transition: background .12s, color .12s;
}
.titlebar .winbtn:hover { background: rgba(255,255,255,.08); color: #F5F5F5; }
.titlebar .winbtn-close:hover { background: #C42B1C; color: #fff; }
"""
p.write_text(s,encoding="utf-8")
print("patched")