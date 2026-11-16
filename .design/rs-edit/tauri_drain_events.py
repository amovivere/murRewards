import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\core.rs")
s=p.read_text(encoding="utf-8")
# убираем фоновый поток (для прототипа события забираем при запросах состояния)
s=s.replace("""        let events = Arc::clone(&core);
        thread::Builder::new()
            .name("reward-sounds-tauri-twitch".to_string())
            .spawn(move || events.event_loop())
            .ok();

        core.bootstrap();""","""        core.bootstrap();""")
# добавляем drain_events и заменяем event_loop
s=s.replace("""    fn event_loop(&self) {
        loop {
            let events = {
                let inner = self.lock();
                inner.twitch.poll()
            };
            for event in events {
                self.handle_event(event);
            }
            thread::sleep(Duration::from_millis(120));
        }
    }""","""    /// Забирает накопившиеся события Twitch. Вызывается командами состояния:
    /// UI опрашивает get_state раз в 1,5 с, этого достаточно для наград.
    fn drain_events(&self) {
        let events = {
            let inner = self.lock();
            inner.twitch.poll()
        };
        if events.is_empty() {
            return;
        }
        log::debug!("Tauri core: событий Twitch — {}", events.len());
        for event in events {
            self.handle_event(event);
        }
    }""")
s=s.replace("""#[tauri::command]
pub fn get_state(core: State<'_, Arc<AppCore>>) -> CoreView {
    core.view()
}""","""#[tauri::command]
pub fn get_state(core: State<'_, Arc<AppCore>>) -> CoreView {
    core.drain_events();
    core.view()
}""")
s=s.replace("""pub fn refresh_rewards(core: State<'_, Arc<AppCore>>) -> CoreView {
    {""","""pub fn refresh_rewards(core: State<'_, Arc<AppCore>>) -> CoreView {
    core.drain_events();
    {""")
# thread/Duration больше не нужны
s=s.replace("use std::thread;\nuse std::time::Duration;\n","")
p.write_text(s,encoding="utf-8")
print("drain_events")