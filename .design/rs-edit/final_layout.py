# -*- coding: utf-8 -*-
import pathlib
P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")

def sub(old, new):
    global s
    assert old in s, "NOT FOUND: " + old[:110]
    s = s.replace(old, new, 1)

# Плеер: обложка 80 и меньше зазоров внутри.
sub("ui.allocate_exact_size(Vec2::splat(94.0), Sense::hover());",
    "ui.allocate_exact_size(Vec2::splat(80.0), Sense::hover());")
sub("Vec2::new(left_width, 132.0),", "Vec2::new(left_width, 118.0),")
sub("Vec2::new(right_width, 132.0),", "Vec2::new(right_width, 118.0),")
sub("""                let (line_rect, _) = ui.allocate_exact_size(
                    Vec2::new(1.0, 118.0),
                    Sense::hover(),
                );""",
"""                let (line_rect, _) = ui.allocate_exact_size(
                    Vec2::new(1.0, 108.0),
                    Sense::hover(),
                );""")
sub("""                    ui.add_space(8.0);
                    let total = if playing { snapshot.player.duration_sec } else { 0 };
""",
"""                    ui.add_space(5.0);
                    let total = if playing { snapshot.player.duration_sec } else { 0 };
""")
sub("""                    ui.add_space(6.0);
                    ui.horizontal(|ui| {
                        ui.spacing_mut().item_spacing.x = 8.0;
                        let buttons_width = 3.0 * 38.0 + 2.0 * 8.0;
""",
"""                    ui.add_space(4.0);
                    ui.horizontal(|ui| {
                        ui.spacing_mut().item_spacing.x = 8.0;
                        let buttons_width = 3.0 * 38.0 + 2.0 * 8.0;
""")

# Нижние карточки: плотнее по вертикали.
sub("""                    .inner_margin(egui::Margin::symmetric(16.0, 10.0))
                    .show(ui, |ui| {
                    ui.set_width(ui.available_width());
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new("OBS — строка «Сейчас играет»")
""",
"""                    .inner_margin(egui::Margin::symmetric(14.0, 8.0))
                    .show(ui, |ui| {
                    ui.set_width(ui.available_width());
                    ui.spacing_mut().item_spacing.y = 4.0;
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new("OBS — строка «Сейчас играет»")
""")
sub("""                    .inner_margin(egui::Margin::symmetric(16.0, 10.0))
                    .show(ui, |ui| {
                    ui.set_width(ui.available_width());
                    ui.label(
                        RichText::new("Состояние")
""",
"""                    .inner_margin(egui::Margin::symmetric(14.0, 8.0))
                    .show(ui, |ui| {
                    ui.set_width(ui.available_width());
                    ui.spacing_mut().item_spacing.y = 4.0;
                    ui.label(
                        RichText::new("Состояние")
""")

# Онбординг: чуть меньше зарезервированная высота, чтобы нижняя карточка дышала.
sub("Vec2::new(left_width, 432.0),", "Vec2::new(left_width, 402.0),")
sub("Vec2::new(right_width, 432.0),", "Vec2::new(right_width, 402.0),")

P.write_text(s, encoding="utf-8")
print("final layout tweaks applied")