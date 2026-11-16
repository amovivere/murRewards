# -*- coding: utf-8 -*-
"""Точная переделка плеера/очереди/низа «Музыки» по CSS макета."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")


def sub(old: str, new: str) -> None:
    global s
    assert old in s, "NOT FOUND: " + old[:120]
    s = s.replace(old, new, 1)


# ---------------------------------------------------------------- UiIcon: ChevronUp + Eye
sub("""    ChevronDown,
    ChevronRight,
""",
"""    ChevronDown,
    ChevronRight,
    ChevronUp,
    Eye,
""")
sub("""        UiIcon::ChevronRight => {
            painter.text(
                center,
                Align2::CENTER_CENTER,
                "›",
                FontId::new((h * 1.5).max(14.0), egui::FontFamily::Proportional),
                color,
            );
        }
""",
"""        UiIcon::ChevronRight => {
            painter.text(
                center,
                Align2::CENTER_CENTER,
                "›",
                FontId::new((h * 1.5).max(14.0), egui::FontFamily::Proportional),
                color,
            );
        }
        UiIcon::ChevronUp => {
            let stroke = Stroke::new(2.0_f32, color);
            painter.line_segment(
                [
                    egui::pos2(center.x - w * 0.22, center.y + h * 0.10),
                    egui::pos2(center.x, center.y - h * 0.18),
                ],
                stroke,
            );
            painter.line_segment(
                [
                    egui::pos2(center.x + w * 0.22, center.y + h * 0.10),
                    egui::pos2(center.x, center.y - h * 0.18),
                ],
                stroke,
            );
        }
        UiIcon::Eye => {
            let stroke = Stroke::new(1.6_f32, color);
            let mut top = Vec::new();
            let mut bottom = Vec::new();
            for step in 0..9 {
                let x = -0.44 + step as f32 * (0.88 / 8.0);
                let bend = 1.0 - (x / 0.44).powi(2);
                top.push(egui::pos2(center.x + x * w, center.y - 0.30 * h * bend));
                bottom.push(egui::pos2(center.x + x * w, center.y + 0.30 * h * bend));
            }
            painter.add(egui::Shape::line(top, stroke));
            painter.add(egui::Shape::line(bottom, stroke));
            painter.circle_filled(center, w * 0.13, color);
        }
""")

# ---------------------------------------------------------------- helpers
anchor = "/// Чип-фильтр с числом: заменяет стат-карточки и работает как фильтр."
helpers = r'''/// Маленькая кнопка действия в строке очереди (крестик/вверх).
fn queue_action_button(ui: &mut egui::Ui, icon: UiIcon, tooltip: &str) -> egui::Response {
    let (rect, response) = ui.allocate_exact_size(Vec2::splat(26.0), Sense::click());
    let rect = snap_rect(ui, rect);
    let hovered = response.hovered();
    ui.painter().rect_filled(
        rect,
        Rounding::same(8.0),
        if hovered {
            with_alpha(Color32::WHITE, 11)
        } else {
            with_alpha(Color32::WHITE, 5)
        },
    );
    paint_ui_icon(
        ui.painter(),
        rect.shrink(6.0),
        icon,
        if hovered { TEXT } else { TEXT_DIM },
    );
    response.on_hover_text(tooltip)
}

/// Крошечный цветной чип (для «загружен» и подобных пометок).
fn tiny_chip(ui: &mut egui::Ui, text: &str, color: Color32) -> egui::Response {
    let font = FontId::new(10.4, egui::FontFamily::Proportional);
    let width = ui
        .painter()
        .layout_no_wrap(text.to_owned(), font.clone(), color)
        .size()
        .x;
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(width + 16.0, 20.0), Sense::hover());
    ui.painter().rect_filled(rect, Rounding::same(10.0), with_alpha(color, 20));
    ui.painter().text(rect.center(), Align2::CENTER_CENTER, text, font, color);
    response
}

/// Вторичная кнопка с иконкой слева (например, «Оверлей OBS»).
fn secondary_icon_button(ui: &mut egui::Ui, icon: UiIcon, label: &str) -> egui::Response {
    let font = FontId::new(15.0, egui::FontFamily::Proportional);
    let text_width = ui
        .painter()
        .layout_no_wrap(label.to_owned(), font.clone(), TEXT)
        .size()
        .x;
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(text_width + 52.0, 34.0), Sense::click());
    let rect = snap_rect(ui, rect);
    let hovered = response.hovered();
    ui.painter().rect(
        rect,
        Rounding::same(17.0),
        if hovered { TEXT } else { Color32::TRANSPARENT },
        Stroke::new(2.0_f32, if hovered { TEXT } else { with_alpha(Color32::WHITE, 64) }),
    );
    let color = if hovered { BG } else { TEXT };
    let icon_rect = egui::Rect::from_center_size(
        egui::pos2(rect.left() + 20.0, rect.center().y),
        Vec2::splat(15.0),
    );
    paint_ui_icon(ui.painter(), icon_rect, icon, color);
    ui.painter().text(
        egui::pos2(rect.left() + 32.0, rect.center().y),
        Align2::LEFT_CENTER,
        label,
        font,
        color,
    );
    response
}

'''
assert anchor in s
s = s.replace(anchor, helpers + anchor, 1)

# ---------------------------------------------------------------- чипы: только заливка
sub("""    // Рамка без stroke: внешняя заливка + внутренняя, край остаётся гладким.
    let edge = if active {
        with_alpha(Color32::WHITE, 62)
    } else {
        with_alpha(Color32::WHITE, 26)
    };
    ui.painter().rect_filled(
        rect,
        Rounding::same(15.0),
        blend_over(BG, edge),
    );
    ui.painter().rect_filled(
        rect.shrink(1.0),
        Rounding::same(14.0),
        blend_over(BG, bg),
    );
""",
"""    // Только заливка: у тонких обводок на 1× заметна «лесенка».
    ui.painter().rect_filled(
        rect,
        Rounding::same(15.0),
        blend_over(BG, bg),
    );
""")

# ---------------------------------------------------------------- secondary border толще
sub("    painter.rect(rect, Rounding::same(17.0), fill, Stroke::new(1.5_f32, edge));",
    "    painter.rect(rect, Rounding::same(17.0), fill, Stroke::new(2.0_f32, edge));")

# ---------------------------------------------------------------- фейдер: 2px дорожка, 14px ползунок
sub("""    let track = egui::Rect::from_center_size(
        egui::pos2(rect.center().x, center_y),
        Vec2::new(rect.width(), 3.0),
    );""",
"""    let track = egui::Rect::from_center_size(
        egui::pos2(rect.center().x, center_y),
        Vec2::new(rect.width(), 2.0),
    );""")
sub("""    let radius = if response.hovered() || response.dragged() {
        7.0
    } else {
        6.0
    };""",
"""    let radius = if response.hovered() || response.dragged() {
        7.5
    } else {
        7.0
    };""")

# ---------------------------------------------------------------- прогресс: 14px, 2px, 14px knob
sub("""    let (rect, response) = ui.allocate_exact_size(Vec2::new(width, 18.0), Sense::click_and_drag());
    let painter = ui.painter();

    let track = egui::Rect::from_center_size(rect.center(), Vec2::new(rect.width(), 4.0));
    painter.rect_filled(track, Rounding::same(2.0), with_alpha(TEXT_DIM, 80));
""",
"""    let (rect, response) = ui.allocate_exact_size(Vec2::new(width, 14.0), Sense::click_and_drag());
    let painter = ui.painter();

    let track = egui::Rect::from_center_size(rect.center(), Vec2::new(rect.width(), 2.0));
    painter.rect_filled(track, Rounding::same(1.0), with_alpha(Color32::WHITE, 46));
""")
sub("    painter.circle_filled(egui::pos2(knob_x, rect.center().y), 6.5, ACCENT);",
    "    painter.circle_filled(egui::pos2(knob_x, rect.center().y), 7.0, Color32::WHITE);")
sub("    painter.rect_filled(fill, Rounding::same(2.0), ACCENT);",
    "    painter.rect_filled(fill, Rounding::same(1.0), Color32::WHITE);")

# ---------------------------------------------------------------- кнопки плеера: 32/40
sub("    let primary = matches!(icon, PlayerIcon::Play | PlayerIcon::Pause);\n    let size = if primary { 36.0 } else { 30.0 };",
    "    let primary = matches!(icon, PlayerIcon::Play | PlayerIcon::Pause);\n    let size = if primary { 40.0 } else { 32.0 };")

# ---------------------------------------------------------------- header OBS с иконкой глаза
sub('if secondary_button(ui, "Оверлей OBS").clicked() {\n                    open_obs = true;\n                }',
    'if secondary_icon_button(ui, UiIcon::Eye, "Оверлей OBS").clicked() {\n                    open_obs = true;\n                }')

P.write_text(s, encoding="utf-8")
print("part 1 patched")
