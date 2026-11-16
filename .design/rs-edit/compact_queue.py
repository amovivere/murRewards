# -*- coding: utf-8 -*-
import pathlib
P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")

def sub(old, new):
    global s
    assert old in s, "NOT FOUND: " + old[:110]
    s = s.replace(old, new, 1)

# Очередь: без межстрочных отступов и с меньшими полями.
sub("""            .inner_margin(egui::Margin::symmetric(16.0, 12.0))
            .show(ui, |ui| {
            ui.set_width(ui.available_width());

            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(format!("Очередь · {} из {}", pending.len(), max_queue))
""",
"""            .inner_margin(egui::Margin::symmetric(16.0, 10.0))
            .show(ui, |ui| {
            ui.set_width(ui.available_width());
            ui.spacing_mut().item_spacing.y = 0.0;

            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(format!("Очередь · {} из {}", pending.len(), max_queue))
""")
# заголовок очереди и строки: вернуть небольшой отступ только после заголовка
sub("""            ui.add_space(6.0);

            if pending.is_empty() {
""",
"""            ui.add_space(4.0);

            if pending.is_empty() {
""")
# manual hint компактнее
sub("""            hint(
                ui,
                "Ручная очередь не тратит баллы зрителей — удобно для проверки.",
            );
""",
"""            ui.add_space(2.0);
            ui.label(
                RichText::new("Ручная очередь не тратит баллы зрителей — удобно для проверки.")
                    .size(11.0)
                    .color(with_alpha(TEXT_DIM, 190)),
            );
""")
# Между шапкой плеера и очередью/ниже — чуть меньше воздуха.
s = s.replace("        ui.add_space(10.0);\n        self.music_player_card(ui, &snapshot);\n        ui.add_space(10.0);",
              "        ui.add_space(8.0);\n        self.music_player_card(ui, &snapshot);\n        ui.add_space(8.0);", 1)
P.write_text(s, encoding="utf-8")
print("queue compacted")