import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\core.rs")
s=p.read_text(encoding="utf-8")
needle="""                self.save();
                {
                    let mut inner = self.lock();
                    if inner.settings.twitch.is_connected() {
                        self.fetch_rewards(&mut inner);
                    }
                }
            }
            twitch::Event::CodeReady {"""
rep="""                self.save();
                self.start_eventsub();
                {
                    let mut inner = self.lock();
                    if inner.settings.twitch.is_connected() {
                        self.fetch_rewards(&mut inner);
                    }
                }
            }
            twitch::Event::CodeReady {"""
assert needle in s
s=s.replace(needle,rep,1)
needle2="""                self.save();
                {
                    let mut inner = self.lock();
                    self.fetch_rewards(&mut inner);
                }
            }
            twitch::Event::RewardsLoaded {"""
rep2="""                self.save();
                self.start_eventsub();
                {
                    let mut inner = self.lock();
                    self.fetch_rewards(&mut inner);
                }
            }
            twitch::Event::RewardsLoaded {"""
assert needle2 in s
s=s.replace(needle2,rep2,1)
p.write_text(s,encoding="utf-8")
print("start_eventsub in auth branches")