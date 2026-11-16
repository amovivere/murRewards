# -*- coding: utf-8 -*-
import pathlib
P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")

def sub(old, new, count=1):
    global s
    assert old in s, "NOT FOUND: " + old[:100]
    s = s.replace(old, new, count)

# --- крупнее область под иконку ---
sub("paint_ui_icon(ui.painter(), rect.shrink(size * 0.16), icon, color);",
    "paint_ui_icon(ui.painter(), rect.shrink(size * 0.13), icon, color);")

# --- Dots: рисуем кружки вместо квадратных точек шрифта ---
sub("""        UiIcon::Dots => {
            for dx in [-0.24_f32, 0.0, 0.24] {
                painter.circle_filled(
                    egui::pos2(center.x + w * dx, center.y),
                    (w * 0.055).max(1.4),
                    color,
                );
            }
        }
""",
"""        UiIcon::Dots => {
            let radius = (w * 0.085).max(1.8);
            for dx in [-0.26_f32, 0.0, 0.26] {
                painter.circle_filled(
                    egui::pos2(center.x + w * dx, center.y),
                    radius,
                    color,
                );
            }
        }
""")

# --- Play: крупнее, меньше «лесенки» ---
sub("""            let left = center.x - w * 0.13;
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
""",
"""            let left = center.x - w * 0.16;
            let right = center.x + w * 0.34;
            painter.add(egui::Shape::convex_polygon(
                vec![
                    egui::pos2(left, center.y - h * 0.36),
                    egui::pos2(right, center.y),
                    egui::pos2(left, center.y + h * 0.36),
                ],
                color,
                Stroke::NONE,
            ));
""")

# --- Refresh: дуга + треугольная стрелка, крупнее ---
sub("""        UiIcon::Refresh => {
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
"""        UiIcon::Refresh => {
            let stroke = Stroke::new(2.0_f32, color);
            let radius = w * 0.40;
            let mut points = Vec::new();
            // Дуга примерно на 300°: рисуем сегментами, край остаётся гладким.
            for step in 0..24 {
                let angle = -0.35 + step as f32 * (std::f32::consts::TAU * 0.82 / 23.0);
                points.push(egui::pos2(
                    center.x + radius * angle.cos(),
                    center.y + radius * angle.sin(),
                ));
            }
            painter.add(egui::Shape::line(points, stroke));
            // Стрелка на конце дуги.
            let tip = egui::pos2(center.x + radius * 0.98, center.y - h * 0.28);
            painter.add(egui::Shape::convex_polygon(
                vec![
                    egui::pos2(tip.x + w * 0.04, tip.y - h * 0.08),
                    egui::pos2(tip.x - w * 0.22, tip.y + h * 0.02),
                    egui::pos2(tip.x + w * 0.06, tip.y + h * 0.16),
                ],
                color,
                Stroke::NONE,
            ));
        }
""")

# --- X и шевроны — глифами шрифта: они сглаживаются лучше мелких линий ---
sub("""        UiIcon::X => {
            painter.line_segment(
                [egui::pos2(center.x - w * 0.22, center.y - h * 0.22), egui::pos2(center.x + w * 0.22, center.y + h * 0.22)],
                stroke,
            );
            painter.line_segment(
                [egui::pos2(center.x + w * 0.22, center.y - h * 0.22), egui::pos2(center.x - w * 0.22, center.y + h * 0.22)],
                stroke,
            );
        }
""",
"""        UiIcon::X => {
            painter.text(
                center,
                Align2::CENTER_CENTER,
                "×",
                FontId::new((h * 1.25).max(12.0), egui::FontFamily::Proportional),
                color,
            );
        }
""")
sub("""        UiIcon::ChevronRight => {
            painter.line_segment(
                [egui::pos2(center.x - w * 0.12, center.y - h * 0.25), egui::pos2(center.x + w * 0.15, center.y)],
                stroke,
            );
            painter.line_segment(
                [egui::pos2(center.x - w * 0.12, center.y + h * 0.25), egui::pos2(center.x + w * 0.15, center.y)],
                stroke,
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
""")

# --- «···» -> «•••» (круглые точки шрифта вместо квадратных) ---
s = s.replace('RichText::new("···")\n                .size(15.0)\n                .color(with_alpha(TEXT_DIM, 230))',
              'RichText::new("•••")\n                .size(12.0)\n                .color(with_alpha(TEXT_DIM, 220))', 1)
s = s.replace('RichText::new("···").size(17.0).color(TEXT_DIM)',
              'RichText::new("•••").size(13.0).color(TEXT_DIM)', 1)
s = s.replace('RichText::new("···").size(16.0).color(TEXT_DIM)',
              'RichText::new("•••").size(13.0).color(TEXT_DIM)', 1)

# --- размеры мини-иконок ---
s = s.replace('icon_button(ui, UiIcon::Play, if exists { "Прослушать" } else { "Файл не найден" }, 24.0)',
              'icon_button(ui, UiIcon::Play, if exists { "Прослушать" } else { "Файл не найден" }, 28.0)')
s = s.replace('icon_button(ui, UiIcon::Play, "Прослушать", 22.0)',
              'icon_button(ui, UiIcon::Play, "Прослушать", 24.0)')
s = s.replace('icon_button(ui, UiIcon::X, "Убрать из очереди", 26.0)',
              'icon_button(ui, UiIcon::X, "Убрать из очереди", 28.0)')
s = s.replace('icon_button(ui, UiIcon::ChevronRight, "Поднять выше", 26.0)',
              'icon_button(ui, UiIcon::ChevronRight, "Поднять выше", 28.0)')
s = s.replace('icon_button(ui, UiIcon::Copy, "Скопировать ссылку", 24.0)',
              'icon_button(ui, UiIcon::Copy, "Скопировать ссылку", 26.0)')
s = s.replace('icon_button(ui, UiIcon::X, "Скрыть уведомление", 22.0)',
              'icon_button(ui, UiIcon::X, "Скрыть уведомление", 24.0)')

P.write_text(s, encoding="utf-8")
print("icons polished")