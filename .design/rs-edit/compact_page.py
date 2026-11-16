# -*- coding: utf-8 -*-
import pathlib
P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")
def sub(old, new):
    global s
    assert old in s, "NOT FOUND: " + old[:110]
    s = s.replace(old, new, 1)

# страница: меньше воздуха между блоками
sub("        ui.add_space(6.0);\n        self.music_player_card(ui, &snapshot);\n        ui.add_space(6.0);",
    "        ui.add_space(5.0);\n        self.music_player_card(ui, &snapshot);\n        ui.add_space(5.0);")
sub("        ui.add_space(10.0);\n\n        // ---- Нижний ряд: OBS и состояние ----",
    "        ui.add_space(7.0);\n\n        // ---- Нижний ряд: OBS и состояние ----")
# плеер: меньше паддинг/зазоры
sub(".inner_margin(egui::Margin::symmetric(16.0, 14.0))\n            .show(ui, |ui| {\n            ui.set_width(ui.available_width());\n            ui.spacing_mut().item_spacing = Vec2::ZERO;",
    ".inner_margin(egui::Margin::symmetric(16.0, 11.0))\n            .show(ui, |ui| {\n            ui.set_width(ui.available_width());\n            ui.spacing_mut().item_spacing = Vec2::ZERO;")
sub("                    ui.add_space(7.0);\n                    let total = if playing { snapshot.player.duration_sec } else { 0 };",
    "                    ui.add_space(4.0);\n                    let total = if playing { snapshot.player.duration_sec } else { 0 };")
sub("                    ui.add_space(8.0);\n                    ui.horizontal(|ui| {\n                        ui.spacing_mut().item_spacing.x = 9.0;",
    "                    ui.add_space(5.0);\n                    ui.horizontal(|ui| {\n                        ui.spacing_mut().item_spacing.x = 9.0;")
sub("                ui.add_space(16.0);\n                let (line_rect, _) = ui.allocate_exact_size(\n                    Vec2::new(1.0, 128.0),",
    "                ui.add_space(14.0);\n                let (line_rect, _) = ui.allocate_exact_size(\n                    Vec2::new(1.0, 116.0),")
sub("                ui.add_space(16.0);\n\n                ui.allocate_ui_with_layout(\n                    Vec2::new(right_width, 132.0),",
    "                ui.add_space(14.0);\n\n                ui.allocate_ui_with_layout(\n                    Vec2::new(right_width, 120.0),")
# очередь: плотнее
sub(".inner_margin(egui::Margin::symmetric(16.0, 12.0))\n            .show(ui, |ui| {\n            ui.set_width(ui.available_width());\n            ui.spacing_mut().item_spacing = Vec2::ZERO;",
    ".inner_margin(egui::Margin::symmetric(16.0, 10.0))\n            .show(ui, |ui| {\n            ui.set_width(ui.available_width());\n            ui.spacing_mut().item_spacing = Vec2::ZERO;")
sub("            ui.add_space(8.0);\n\n            if pending.is_empty() {",
    "            ui.add_space(4.0);\n\n            if pending.is_empty() {")
sub("            ui.add_space(8.0);\n            let (line_rect, _) = ui.allocate_exact_size(",
    "            ui.add_space(4.0);\n            let (line_rect, _) = ui.allocate_exact_size(")
sub("            ui.add_space(10.0);\n\n            ui.horizontal(|ui| {\n                ui.spacing_mut().item_spacing.x = 0.0;",
    "            ui.add_space(6.0);\n\n            ui.horizontal(|ui| {\n                ui.spacing_mut().item_spacing.x = 0.0;")
P.write_text(s, encoding="utf-8")
print("page compacted")