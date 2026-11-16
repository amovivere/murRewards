# -*- coding: utf-8 -*-
import pathlib
P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")
def sub(old, new):
    global s
    assert old in s, "NOT FOUND: " + old[:110]
    s = s.replace(old, new, 1)

# компактные state-чипы: 24 px, как в макете
sub("""    let font = FontId::new(11.0, egui::FontFamily::Proportional);
    let width = ui
        .painter()
        .layout_no_wrap(state.label().to_string(), font.clone(), fg)
        .size()
        .x;
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(width + 18.0, 22.0), Sense::hover());
    ui.painter().rect_filled(rect, Rounding::same(11.0), bg);
    ui.painter().text(
        rect.center(),
        Align2::CENTER_CENTER,
        state.label(),
        font,
        fg,
    );
""",
"""    let font = FontId::new(11.2, egui::FontFamily::Proportional);
    let width = ui
        .painter()
        .layout_no_wrap(state.label().to_string(), font.clone(), fg)
        .size()
        .x;
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(width + 18.0, 24.0), Sense::hover());
    ui.painter().rect_filled(rect, Rounding::same(12.0), bg);
    ui.painter().text(
        rect.center(),
        Align2::CENTER_CENTER,
        state.label(),
        font,
        fg,
    );
""")
# «В очередь» — стандартная высота 34
sub("""                if compact_secondary_button(ui, "В очередь").clicked()
                    && !self.music_manual_input.trim().is_empty()
""",
"""                if secondary_button(ui, "В очередь").clicked()
                    && !self.music_manual_input.trim().is_empty()
""")
P.write_text(s, encoding="utf-8")
print("chip and button sizes")