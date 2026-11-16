import json, pathlib
# capabilities
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\capabilities\default.json")
data=json.loads(p.read_text(encoding="utf-8"))
data["permissions"]=[
 "core:default",
 "core:window:allow-minimize",
 "core:window:allow-toggle-maximize",
 "core:window:allow-close",
 "core:window:allow-start-dragging"
]
p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
# app.js window controls fallback to JS API
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.js")
s=p.read_text(encoding="utf-8")
s=s.replace("""  function bindWindowControls() {
    $$('[data-win]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.win;
        if (action === 'min') invoke('win_minimize');
        else if (action === 'max') invoke('win_toggle_maximize');
        else if (action === 'close') invoke('win_close');
      });
    });
    const titlebar = $('.titlebar');
    titlebar.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      if (event.target.closest('button')) return;
      invoke('win_start_drag');
    });
  }""","""  function tauriWindow() {
    const api = window.__TAURI__ && window.__TAURI__.window;
    return api && typeof api.getCurrentWindow === 'function' ? api.getCurrentWindow() : null;
  }

  function bindWindowControls() {
    const win = tauriWindow();
    $$('[data-win]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.win;
        try {
          if (action === 'min' && win) await win.minimize();
          else if (action === 'max' && win) await win.toggleMaximize();
          else if (action === 'close' && win) await win.close();
          else if (action === 'min') invoke('win_minimize');
          else if (action === 'max') invoke('win_toggle_maximize');
          else if (action === 'close') invoke('win_close');
        } catch (err) {
          console.warn('window action failed', action, err);
        }
      });
    });
    const titlebar = $('.titlebar');
    titlebar.addEventListener('mousedown', async (event) => {
      if (event.button !== 0) return;
      if (event.target.closest('button')) return;
      try {
        if (win) await win.startDragging();
        else invoke('win_start_drag');
      } catch (err) {
        console.warn('drag failed', err);
      }
    });
  }""")
p.write_text(s,encoding="utf-8")
print("window api patched")