# -*- coding: utf-8 -*-
import pathlib
P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")

def sub(old, new):
    global s
    assert old in s, "NOT FOUND: " + old[:110]
    s = s.replace(old, new, 1)

# Плеер: своя более компактная рамка.
sub("""        card_frame().show(ui, |ui| {
            ui.set_width(ui.available_width());
            let total_width = ui.available_width();
""",
"""        egui::Frame::none()
            .fill(CARD)
            .stroke(Stroke::new(1.0_f32, BORDER))
            .rounding(Rounding::same(18.0))
            .inner_margin(egui::Margin::symmetric(16.0, 12.0))
            .show(ui, |ui| {
            ui.set_width(ui.available_width());
            let total_width = ui.available_width();
""")
sub("ui.allocate_exact_size(Vec2::splat(80.0), Sense::hover());",
    "ui.allocate_exact_size(Vec2::splat(72.0), Sense::hover());")
sub("""                    ui.add_space(4.0);
                    ui.horizontal(|ui| {
                        ui.spacing_mut().item_spacing.x = 8.0;
                        let buttons_width = 3.0 * 38.0 + 2.0 * 8.0;
""",
"""                    ui.add_space(2.0);
                    ui.horizontal(|ui| {
                        ui.spacing_mut().item_spacing.x = 8.0;
                        let buttons_width = 3.0 * 38.0 + 2.0 * 8.0;
""")
# зазор после плеера и после очереди поменьше
s = s.replace("        ui.add_space(8.0);\n        self.music_player_card(ui, &snapshot);\n        ui.add_space(8.0);",
              "        ui.add_space(6.0);\n        self.music_player_card(ui, &snapshot);\n        ui.add_space(6.0);", 1)
P.write_text(s, encoding="utf-8")
print("player compacted")