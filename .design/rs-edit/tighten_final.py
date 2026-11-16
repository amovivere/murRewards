# -*- coding: utf-8 -*-
import pathlib
P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")

def sub(old, new):
    global s
    assert old in s, "NOT FOUND: " + old[:110]
    s = s.replace(old, new, 1)

# Плеер: чуть меньше зазоров и кнопки.
sub("""            .inner_margin(egui::Margin::symmetric(16.0, 12.0))
            .show(ui, |ui| {
            ui.set_width(ui.available_width());
            let total_width = ui.available_width();
""",
"""            .inner_margin(egui::Margin::symmetric(16.0, 10.0))
            .show(ui, |ui| {
            ui.set_width(ui.available_width());
            let total_width = ui.available_width();
""")
sub("""                    ui.add_space(5.0);
                    let total = if playing { snapshot.player.duration_sec } else { 0 };
""",
"""                    ui.add_space(2.0);
                    let total = if playing { snapshot.player.duration_sec } else { 0 };
""")
sub("""                    ui.add_space(4.0);
                    ui.horizontal(|ui| {
                        ui.spacing_mut().item_spacing.x = 8.0;
                        let buttons_width = 3.0 * 38.0 + 2.0 * 8.0;
""",
"""                    ui.add_space(2.0);
                    ui.horizontal(|ui| {
                        ui.spacing_mut().item_spacing.x = 8.0;
                        let buttons_width = 3.0 * 36.0 + 2.0 * 8.0;
""")
# player_icon_button: 36x32 вместо 38x34.
sub("let (rect, response) = ui.allocate_exact_size(Vec2::new(38.0, 34.0), Sense::click());",
    "let (rect, response) = ui.allocate_exact_size(Vec2::new(36.0, 32.0), Sense::click());")

# Очередь: строки чуть плотнее.
sub(""".inner_margin(egui::Margin::symmetric(10.0, 2.0))
                    .show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        ui.horizontal(|ui| {
                            let (bar_rect, _) =
                                ui.allocate_exact_size(Vec2::new(3.0, 24.0), Sense::hover());
""",
""".inner_margin(egui::Margin::symmetric(10.0, 1.0))
                    .show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        ui.horizontal(|ui| {
                            let (bar_rect, _) =
                                ui.allocate_exact_size(Vec2::new(3.0, 22.0), Sense::hover());
""")
sub("RichText::new(item.label()).size(13.8).color(TEXT),",
    "RichText::new(item.label()).size(13.4).color(TEXT),")
sub("ui.label(RichText::new(meta).size(11.2).color(TEXT_DIM));",
    "ui.label(RichText::new(meta).size(10.8).color(TEXT_DIM));")

P.write_text(s, encoding="utf-8")
print("tightened player/queue")