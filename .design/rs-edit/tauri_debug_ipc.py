import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.js")
s=p.read_text(encoding="utf-8")
s=s.replace("""      console.warn('invoke failed', cmd, err);
      return null;""","""      console.warn('invoke failed', cmd, err);
      try {
        const f = document.getElementById('footer-text');
        if (f) f.textContent = `IPC error: ${cmd}: ${err}`;
      } catch {}
      return null;""")
s=s.replace("""    const status = await invoke('get_state');
    if (status) {
      applyCoreView(status);
      state.coreSig = coreSignature(status);
    }""","""    const status = await invoke('get_state');
    if (status) {
      applyCoreView(status);
      state.coreSig = coreSignature(status);
      setFooter('IPC: награды загружены из Rust', 0);
    } else {
      setFooter('IPC: get_state вернул пустой ответ', 0);
    }""")
p.write_text(s,encoding="utf-8")
print("debug wired")