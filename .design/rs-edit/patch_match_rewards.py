# -*- coding: utf-8 -*-
"""Матч с макетом «Награды» + более гладкая отрисовка контролов."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")


def sub(old: str, new: str) -> None:
    global s
    assert old in s, "NOT FOUND: " + old[:110]
    s = s.replace(old, new, 1)


# --- 1. Сортировка в тулбаре + иконка обновления ---
sub("""            // Переключатель вида.
            egui::Frame::none()
                .fill(with_alpha(Color32::WHITE, 5))
                .stroke(Stroke::new(1.0_f32, with_alpha(Color32::WHITE, 42)))
                .rounding(Rounding::same(17.0))
                .inner_margin(egui::Margin::symmetric(3.0, 2.0))
                .show(ui, |ui| {
                    ui.horizontal(|ui| {
                        ui.spacing_mut().item_spacing.x = 2.0;
                        if seg_button(ui, UiIcon::Grid, "Плитка", grid_view) {
                            grid_view = true;
                            view_changed = true;
                        }
                        if seg_button(ui, UiIcon::List, "Список", !grid_view) {
                            grid_view = false;
                            view_changed = true;
                        }
                    });
                });

            if loading {
                ui.add(egui::Spinner::new().size(16.0));
                ui.label(RichText::new("Обновляем…").size(12.6).color(TEXT_DIM));
            } else if secondary_button(ui, "Обновить").clicked() {
                refresh_requested = true;
            }
""",
"""            // Переключатель вида.
            egui::Frame::none()
                .fill(with_alpha(Color32::WHITE, 5))
                .stroke(Stroke::new(1.0_f32, with_alpha(Color32::WHITE, 42)))
                .rounding(Rounding::same(17.0))
                .inner_margin(egui::Margin::symmetric(3.0, 2.0))
                .show(ui, |ui| {
                    ui.horizontal(|ui| {
                        ui.spacing_mut().item_spacing.x = 2.0;
                        if seg_button(ui, UiIcon::Grid, "Плитка", grid_view) {
                            grid_view = true;
                            view_changed = true;
                        }
                        if seg_button(ui, UiIcon::List, "Список", !grid_view) {
                            grid_view = false;
                            view_changed = true;
                        }
                    });
                });

            // Сортировка — как выпадающий список в макете.
            egui::ComboBox::from_id_salt("reward-sort")
                .width(158.0)
                .selected_text(RichText::new(new_sort.label()).size(13.2).color(TEXT))
                .show_ui(ui, |ui| {
                    for sort in [
                        RewardSort::Default,
                        RewardSort::PriceDesc,
                        RewardSort::PriceAsc,
                        RewardSort::Title,
                    ] {
                        if ui
                            .selectable_label(new_sort == sort, sort.label())
                            .clicked()
                        {
                            new_sort = sort;
                        }
                    }
                });

            if loading {
                ui.add(egui::Spinner::new().size(16.0));
                ui.label(RichText::new("Обновляем…").size(12.6).color(TEXT_DIM));
            } else if icon_button(ui, UiIcon::Refresh, "Обновить список", 34.0).clicked() {
                refresh_requested = true;
            }
""",
)

# --- 2. Свёрнутая панель выключенных наград — как в макете ---
sub("""                if filter == RewardFilter::All && !disabled_visible.is_empty() {
                    ui.add_space(8.0);
                    let label = format!(
                        "{} Выключенные и недоступные награды · {}",
                        if self.disabled_open { "▾" } else { "▸" },
                        disabled_visible.len()
                    );
                    let row = ui
                        .add(
                            egui::Label::new(RichText::new(label).size(13.2).color(TEXT_DIM))
                                .sense(Sense::click()),
                        )
                        .on_hover_text("Развернуть или свернуть");
                    if row.clicked() {
                        toggle_disabled = true;
                    }
""",
"""                if filter == RewardFilter::All && !disabled_visible.is_empty() {
                    ui.add_space(6.0);
                    let (rect, row) = ui.allocate_exact_size(
                        Vec2::new(ui.available_width(), 42.0),
                        Sense::click(),
                    );
                    let hovered = row.hovered();
                    ui.painter().rect(
                        rect,
                        Rounding::same(12.0),
                        if hovered {
                            with_alpha(Color32::WHITE, 5)
                        } else {
                            Color32::TRANSPARENT
                        },
                        Stroke::new(1.0_f32, with_alpha(Color32::WHITE, 26)),
                    );
                    let icon = if self.disabled_open {
                        UiIcon::ChevronDown
                    } else {
                        UiIcon::ChevronRight
                    };
                    paint_ui_icon(
                        ui.painter(),
                        egui::Rect::from_center_size(
                            egui::pos2(rect.left() + 20.0, rect.center().y),
                            Vec2::splat(14.0),
                        ),
                        icon,
                        TEXT_DIM,
                    );
                    ui.painter().text(
                        egui::pos2(rect.left() + 40.0, rect.center().y),
                        Align2::LEFT_CENTER,
                        format!(
                            "Выключенные и недоступные награды · {}",
                            disabled_visible.len()
                        ),
                        FontId::new(13.2, egui::FontFamily::Proportional),
                        TEXT_DIM,
                    );
                    ui.painter().text(
                        egui::pos2(rect.right() - 18.0, rect.center().y),
                        Align2::RIGHT_CENTER,
                        if self.disabled_open { "Скрыть" } else { "Показать" },
                        FontId::new(12.6, egui::FontFamily::Proportional),
                        with_alpha(TEXT_DIM, 190),
                    );
                    if row.clicked() {
                        toggle_disabled = true;
                    }
""",
)

# --- 3. На карточке — только формат и длительность (размер ушёл в подсказку) ---
sub("""        Some(file) if file.exists => (
            format!(
                "{format} · {} · {}",
                file.duration_label(),
                util::format_size(file.size)
            ),
            true,
        ),
""",
"""        Some(file) if file.exists => (
            format!("{format} · {}", file.duration_label()),
            true,
        ),
""",
)

# --- 4. Кнопки: один AA-контур вместо двух наложенных заливок ---
sub("""    let painter = ui.painter();
    // Обводку рисуем заливкой: два скруглённых прямоугольника дают ровный
    // край, а тонкая линия на скруглении даёт заметную «лесенку».
    painter.rect_filled(rect, Rounding::same(17.0), edge);
    // Внутренний слой должен быть непрозрачным, иначе сквозь него видна
    // обводка и кнопка «заливается» целиком.
    painter.rect_filled(
        rect.shrink(1.2),
        Rounding::same(16.0),
        if !enabled {
            with_alpha(text_color, 10)
        } else if fill.a() < 200 {
            CARD
        } else {
            fill
        },
    );
    painter.text(rect.center(), Align2::CENTER_CENTER, label, font, text);
""",
"""    let painter = ui.painter();
    let bg = if !enabled {
        with_alpha(Color32::WHITE, 4)
    } else if fill.a() < 200 {
        CARD
    } else {
        fill
    };
    // Одна фигура «заливка + контур»: egui сам сглаживает край, без швов
    // от двух наложенных прямоугольников.
    painter.rect(rect, Rounding::same(17.0), bg, Stroke::new(1.0_f32, edge));
    painter.text(rect.center(), Align2::CENTER_CENTER, label, font, text);
""",
)

sub("""    let painter = ui.painter();
    // Без обводки-линии: только заливка, поэтому край остаётся ровным.
    painter.rect_filled(
        rect,
        Rounding::same(16.0),
        if !enabled {
            with_alpha(color, 10)
        } else if hovered {
            color
        } else {
            with_alpha(color, 26)
        },
    );
""",
"""    let painter = ui.painter();
    painter.rect(
        rect,
        Rounding::same(16.0),
        if !enabled {
            with_alpha(color, 8)
        } else if hovered {
            color
        } else {
            with_alpha(color, 26)
        },
        Stroke::new(1.0_f32, with_alpha(color, 48)),
    );
""",
)

# --- 5. Иконки чуть крупнее; play-треугольник заметнее ---
sub("""    paint_ui_icon(ui.painter(), rect.shrink(size * 0.22), icon, color);
""",
"""    paint_ui_icon(ui.painter(), rect.shrink(size * 0.16), icon, color);
""",
)
sub("""        UiIcon::Play => {
            painter.add(egui::Shape::convex_polygon(
                vec![
                    egui::pos2(center.x - w * 0.20, center.y - h * 0.26),
                    egui::pos2(center.x + w * 0.26, center.y),
                    egui::pos2(center.x - w * 0.20, center.y + h * 0.26),
                ],
                color,
                Stroke::NONE,
            ));
        }
""",
"""        UiIcon::Play => {
            // Крупнее и с отступом от края: в 24–28 px треугольник больше не «пикселит».
            let left = center.x - w * 0.13;
            let right = center.x + w * 0.30;
            painter.add(egui::Shape::convex_polygon(
                vec![
                    egui::pos2(left, center.y - h * 0.30),
                    egui::pos2(right, center.y),
                    egui::pos2(left, center.y + h * 0.30),
                ],
                color,
                Stroke::NONE,
            ));
        }
""",
)
sub("""        UiIcon::Refresh => {
            painter.circle_stroke(center, w * 0.36, stroke);
            let tip = egui::pos2(center.x + w * 0.36, center.y - h * 0.12);
            painter.line_segment([tip, egui::pos2(tip.x - w * 0.13, tip.y - h * 0.10)], stroke);
            painter.line_segment([tip, egui::pos2(tip.x, tip.y + h * 0.14)], stroke);
        }
""",
"""        UiIcon::Refresh => {
            painter.circle_stroke(center, w * 0.34, Stroke::new(1.9_f32, color));
            let tip = egui::pos2(center.x + w * 0.34, center.y - h * 0.16);
            painter.line_segment(
                [tip, egui::pos2(tip.x - w * 0.19, tip.y - h * 0.02)],
                Stroke::new(1.9_f32, color),
            );
            painter.line_segment(
                [tip, egui::pos2(tip.x + w * 0.02, tip.y + h * 0.19)],
                Stroke::new(1.9_f32, color),
            );
        }
""",
)

P.write_text(s, encoding="utf-8")
print("rewards match + smoother controls patched")
