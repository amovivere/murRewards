import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.js")
s=p.read_text(encoding="utf-8")
s=s.replace("""    const poll = async () => {
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
    setInterval(poll, 1500);""","""    const poll = async () => {
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
    setInterval(poll, 1500);""")
p.write_text(s,encoding="utf-8")
print("poll debug")