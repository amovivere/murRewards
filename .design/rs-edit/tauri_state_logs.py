import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\core.rs")
s=p.read_text(encoding="utf-8")
s=s.replace('        log::debug!("Tauri core: событий Twitch — {}", events.len());',
            '        log::info!("Tauri core: событий Twitch — {}", events.len());')
s=s.replace("""pub fn get_state(core: State<'_, Arc<AppCore>>) -> CoreView {
    core.drain_events();
    core.view()
}""","""pub fn get_state(core: State<'_, Arc<AppCore>>) -> CoreView {
    core.drain_events();
    let view = core.view();
    log::info!(
        "Tauri core: get_state rewards={} loading={} error={:?}",
        view.rewards.len(),
        view.rewards_loading,
        view.rewards_error
    );
    view
}""")
p.write_text(s,encoding="utf-8")
print("state logs")