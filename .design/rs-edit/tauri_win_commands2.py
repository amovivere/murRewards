import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\main.rs")
s=p.read_text(encoding="utf-8")
s=s.replace('''#[tauri::command]
fn win_minimize(window: tauri::WebviewWindow) {
    let _ = window.minimize();
}

#[tauri::command]
fn win_toggle_maximize(window: tauri::WebviewWindow) {
    let maximized = window.is_maximized().unwrap_or(false);
    let _ = if maximized {
        window.unmaximize()
    } else {
        window.maximize()
    };
}''','''#[tauri::command]
fn win_minimize(window: tauri::WebviewWindow) {
    let _ = window.set_minimized(true);
}

#[tauri::command]
fn win_toggle_maximize(window: tauri::WebviewWindow) {
    let maximized = window.is_maximized().unwrap_or(false);
    let _ = window.set_maximized(!maximized);
}''')
p.write_text(s,encoding="utf-8")
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.js")
s=p.read_text(encoding="utf-8")
# не блокируем fallback на Tauri API: всегда вызываем свои команды, JS API не используем
s=s.replace('''        try {
          if (action === 'min' && win) await win.minimize();
          else if (action === 'max' && win) await win.toggleMaximize();
          else if (action === 'close' && win) await win.close();
          else if (action === 'min') invoke('win_minimize');
          else if (action === 'max') invoke('win_toggle_maximize');
          else if (action === 'close') invoke('win_close');
        } catch (err) {
          console.warn('window action failed', action, err);
        }''','''        try {
          if (action === 'min') await invoke('win_minimize');
          else if (action === 'max') await invoke('win_toggle_maximize');
          else if (action === 'close') await invoke('win_close');
        } catch (err) {
          console.warn('window action failed', action, err);
        }''')
p.write_text(s,encoding="utf-8")
print("set_minimized/set_maximized")