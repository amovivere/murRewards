import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.js")
s=p.read_text(encoding="utf-8")
s=s.replace("""    if (state.connected) {
      const pill = $('.toolbar .pill.active', content);""","""    if (state.connected && state.tab === 'music') {
      const pill = $('.toolbar .pill.active', content);""")
p.write_text(s,encoding="utf-8")
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\core.rs")
s=p.read_text(encoding="utf-8")
s=s.replace("""    let view = core.view();
    log::info!(
        "Tauri core: get_state rewards={} loading={} error={:?}",
        view.rewards.len(),
        view.rewards_loading,
        view.rewards_error
    );
    view""","""    core.view()""")
p.write_text(s,encoding="utf-8")
print("log polish")