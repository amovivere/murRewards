# -*- coding: utf-8 -*-
import pathlib
P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")
start = s.index("/// Тонкий фейдер в стиле макета")
end = s.index("/// Кнопка внутри сегментированного переключателя")
new = r'''/// Тонкий фейдер в стиле макета: светлая заполненная часть, серая дорожка и
/// круглый ползунок без обводки.
fn fader<N: egui::emath::Numeric>(
    ui: &mut egui::Ui,
    value: &mut N,
    min: N,
    max: N,
    width: f32,
) -> egui::Response {
    let (rect, mut response) =
        ui.allocate_exact_size(Vec2::new(width.max(40.0), 20.0), Sense::click_and_drag());
    let rect = snap_rect(ui, rect);
    let enabled = ui.is_enabled();
    let min_f = min.to_f64();
    let max_f = max.to_f64();
    let span = (max_f - min_f).max(f64::EPSILON);

    if enabled {
        if let Some(pos) = response.interact_pointer_pos() {
            if response.dragged() || response.clicked() {
                let fraction = ((pos.x - rect.left()) / rect.width()).clamp(0.0, 1.0);
                let new_value = min_f + fraction as f64 * span;
                if (new_value - value.to_f64()).abs() > 1e-5 {
                    *value = N::from_f64(new_value);
                    response.mark_changed();
                }
            }
        }
    }

    let fraction = ((value.to_f64() - min_f) / span).clamp(0.0, 1.0) as f32;
    let center_y = rect.center().y;
    let track = egui::Rect::from_center_size(
        egui::pos2(rect.center().x, center_y),
        Vec2::new(rect.width(), 3.0),
    );
    ui.painter().rect_filled(
        track,
        1.5,
        if enabled {
            with_alpha(Color32::WHITE, 22)
        } else {
            with_alpha(Color32::WHITE, 10)
        },
    );
    let knob = egui::pos2(rect.left() + rect.width() * fraction, center_y);
    let fill = egui::Rect::from_min_max(
        track.min,
        egui::pos2(knob.x.max(track.left()), track.max.y),
    );
    ui.painter().rect_filled(
        fill,
        1.5,
        if enabled { TEXT } else { with_alpha(TEXT_DIM, 120) },
    );
    let radius = if response.hovered() || response.dragged() {
        7.0
    } else {
        6.0
    };
    ui.painter().circle_filled(
        knob,
        radius,
        if enabled { Color32::WHITE } else { with_alpha(TEXT_DIM, 160) },
    );

    response
}

'''
s = s[:start] + new + s[end:]
P.write_text(s, encoding="utf-8")
print("generic fader")