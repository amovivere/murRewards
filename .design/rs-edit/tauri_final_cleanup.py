import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\core.rs")
s=p.read_text(encoding="utf-8")
s=s.replace("""    FileInfo {
        name: util::file_name(Path::new(path)),
        path: path.to_string(),
        exists,
        meta: format!("{format} · {duration}"),
        volume,
    }""","""    let meta = if duration == "—" {
        format.clone()
    } else {
        format!("{format} · {duration}")
    };
    FileInfo {
        name: util::file_name(Path::new(path)),
        path: path.to_string(),
        exists,
        meta,
        volume,
    }""")
p.write_text(s,encoding="utf-8")
# убираем remote debugging из релизной сборки
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\main.rs")
s=p.read_text(encoding="utf-8")
s=s.replace("\n            .additional_browser_args(\"--remote-debugging-port=9333\")","")
p.write_text(s,encoding="utf-8")
# убираем отладочные счётчики опроса (сам опрос оставляем)
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.js")
s=p.read_text(encoding="utf-8")
s=s.replace("""    const poll = async () => {
      window.__poll = (window.__poll || 0) + 1;
      try {
        if (!state.core) return;
        const view = await invoke('get_state');
        window.__pollView = view
          ? { n: view.rewards?.length || 0, loading: view.rewards_loading }
          : null;
        if (!view) return;
        const signature = coreSignature(view);
        applyCoreView(view);
        if (state.tab === 'rewards' && signature !== state.coreSig) {
          state.coreSig = signature;
          renderCoreRewards(view);
        }
      } catch (err) {
        window.__pollErr = String(err);
      }
    };
    setTimeout(poll, 600);
    setInterval(poll, 1500);""","""    const poll = async () => {
      if (!state.core) return;
      const view = await invoke('get_state');
      if (!view) return;
      const signature = coreSignature(view);
      applyCoreView(view);
      if (state.tab === 'rewards' && signature !== state.coreSig) {
        state.coreSig = signature;
        renderCoreRewards(view);
      }
    };
    setTimeout(poll, 800);
    setInterval(poll, 1500);""")
p.write_text(s,encoding="utf-8")
print("meta fallback, port off, poll cleanup")