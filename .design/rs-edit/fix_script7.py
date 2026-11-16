# -*- coding: utf-8 -*-
import pathlib
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-edit\polish_pass2.py")
s = p.read_text(encoding="utf-8")
old = '''fn secondary_button(ui: &mut egui::Ui, label: &str) -> egui::Response {
    styled_button(
        ui,
        label,
        with_alpha(Color32::WHITE, 5),
        Color32::WHITE,
        TEXT,
        with_alpha(Color32::WHITE, 70),
    )
}
'''
new = '''fn secondary_button(ui: &mut egui::Ui, label: &str) -> egui::Response {
    styled_button(
        ui,
        label,
        Color32::TRANSPARENT,
        with_alpha(Color32::WHITE, 12),
        TEXT,
        with_alpha(Color32::WHITE, 64),
    )
}
'''
assert old in s
s = s.replace(old, new)
p.write_text(s, encoding="utf-8")
print("secondary button anchor fixed")