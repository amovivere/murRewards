# -*- coding: utf-8 -*-
import pathlib
P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")

def sub(old, new):
    global s
    assert old in s, "NOT FOUND: " + old[:100]
    s = s.replace(old, new, 1)

# Copy-иконка.
sub("""    Edit,
    Check,
}""",
"""    Edit,
    Check,
    Copy,
}""")
sub("""        UiIcon::Check => {""",
"""        UiIcon::Copy => {
            let back = egui::Rect::from_min_max(
                egui::pos2(rect.left() + w * 0.16, rect.top() + h * 0.30),
                egui::pos2(rect.right() - w * 0.30, rect.bottom() - h * 0.14),
            );
            painter.rect_stroke(back, Rounding::same(2.0), stroke);
            let front = egui::Rect::from_min_max(
                egui::pos2(rect.left() + w * 0.32, rect.top() + h * 0.14),
                egui::pos2(rect.right() - w * 0.14, rect.bottom() - h * 0.30),
            );
            painter.rect_filled(front, Rounding::same(2.0), color);
        }
        UiIcon::Check => {""")
s = s.replace('icon_button(ui, UiIcon::Folder, "Скопировать ссылку", 24.0)',
              'icon_button(ui, UiIcon::Copy, "Скопировать ссылку", 24.0)', 1)

# queue_state_chip -> Response (для подсказки с причиной ошибки).
sub("""fn queue_state_chip(ui: &mut egui::Ui, state: ItemState) {
""",
"""fn queue_state_chip(ui: &mut egui::Ui, state: ItemState) -> egui::Response {
""")
sub("""    let (rect, _) = ui.allocate_exact_size(Vec2::new(width + 18.0, 22.0), Sense::hover());
    ui.painter().rect_filled(rect, Rounding::same(11.0), bg);
    ui.painter().text(
        rect.center(),
        Align2::CENTER_CENTER,
        state.label(),
        font,
        fg,
    );
}
""",
"""    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(width + 18.0, 22.0), Sense::hover());
    ui.painter().rect_filled(rect, Rounding::same(11.0), bg);
    ui.painter().text(
        rect.center(),
        Align2::CENTER_CENTER,
        state.label(),
        font,
        fg,
    );
    response
}
""")

P.write_text(s, encoding="utf-8")
print("icons/chip patched")