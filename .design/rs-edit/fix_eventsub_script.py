import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-edit\tauri_eventsub.py")
s=p.read_text(encoding="utf-8")
s=s.replace("""                eventsub::Event::Unauthorized => {
                    let mut inner = self.lock();
                    inner.eventsub_state = "stopped".to_string();
                    inner.eventsub_error = Some("Нужно обновить вход в Twitch.".into());
                    drop(inner);
                    self.start_refresh(&mut self.lock());
                }""","""                eventsub::Event::Unauthorized => {
                    let mut inner = self.lock();
                    inner.eventsub_state = "stopped".to_string();
                    inner.eventsub_error = Some("Нужно обновить вход в Twitch.".into());
                    self.start_refresh(&mut inner);
                }""")
p.write_text(s,encoding="utf-8")
print("script fixed")