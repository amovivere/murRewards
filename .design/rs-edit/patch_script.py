# -*- coding: utf-8 -*-
import pathlib
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-edit\replace_rewards.py")
s = p.read_text(encoding="utf-8")
s = s.replace(
"""            let stop = ui.add_enabled_ui(!playing.is_empty(), |ui| {
                versioned_danger_button(ui, "Остановить всё")
            });
            if stop.inner.clicked() {
                stop_all = true;
            }""",
"""            let stop = ui
                .add_enabled_ui(!playing.is_empty(), |ui| danger_button(ui, "Остановить всё"))
                .inner;
            if stop.clicked() {
                stop_all = true;
            }""")
p.write_text(s, encoding="utf-8")
print("patched script")