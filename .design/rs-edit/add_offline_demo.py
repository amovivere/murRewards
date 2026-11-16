# -*- coding: utf-8 -*-
import pathlib
P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")
old = """        if std::env::var_os("REWARD_SOUNDS_DEMO_LIST").is_some() {
            self.settings.grid_view = false;
        }
"""
new = """        if std::env::var_os("REWARD_SOUNDS_DEMO_LIST").is_some() {
            self.settings.grid_view = false;
        }
        if std::env::var_os("REWARD_SOUNDS_DEMO_OFFLINE").is_some() {
            // Для скриншота первого запуска: локальные привязки есть, Twitch нет.
            self.settings.twitch.clear_session();
            self.settings.twitch.login.clear();
            self.settings.twitch.display_name.clear();
            self.settings.twitch.user_id.clear();
            self.twitch_state = TwitchState::Disconnected;
            self.eventsub_state = EventSubState::Stopped;
        }
"""
assert old in s
s = s.replace(old, new, 1)
P.write_text(s, encoding="utf-8")
print("offline demo option added")