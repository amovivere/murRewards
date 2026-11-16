import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\core.rs")
s=p.read_text(encoding="utf-8")
s=s.replace("""        if let Ok(mut state) = self.playback_state.lock() {
            state.sync(&inner.settings);
        }""","""        if let Ok(mut state) = inner.playback_state.lock() {
            state.sync(&inner.settings);
        }""")
# вызовы start_eventsub после сохранения токенов (Refreshed и Authorized)
s=s.replace("""                    if inner.settings.twitch.is_connected() {
                        self.fetch_rewards(&mut inner);
                    }
                }
            }
            twitch::Event::CodeReady {""","""                    if inner.settings.twitch.is_connected() {
                        self.fetch_rewards(&mut inner);
                    }
                }
                self.start_eventsub();
            }
            twitch::Event::CodeReady {""",1)
s=s.replace("""                self.save();
                {
                    let mut inner = self.lock();
                    self.fetch_rewards(&mut inner);
                }
            }
            twitch::Event::RewardsLoaded {""","""                self.save();
                {
                    let mut inner = self.lock();
                    self.fetch_rewards(&mut inner);
                }
                self.start_eventsub();
            }
            twitch::Event::RewardsLoaded {""",1)
p.write_text(s,encoding="utf-8")
print("fixed playback + eventsub calls")