import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\main.rs")
s=p.read_text(encoding="utf-8")
s=s.replace("    let _ = window.set_minimized(true);","    let _ = window.minimize();")
s=s.replace('''    let maximized = window.is_maximized().unwrap_or(false);
    let _ = window.set_maximized(!maximized);''','''    let maximized = window.is_maximized().unwrap_or(false);
    let _ = if maximized {
        window.unmaximize()
    } else {
        window.maximize()
    };''')
s=s.replace('''            .inner_size(1220.0, 840.0)
            .min_inner_size(980.0, 680.0)
            .decorations(false)''','''            .inner_size(1220.0, 840.0)
            .min_inner_size(980.0, 680.0)
            .resizable(true)
            .maximizable(true)
            .minimizable(true)
            .decorations(false)''')
p.write_text(s,encoding="utf-8")
print("builder flags")