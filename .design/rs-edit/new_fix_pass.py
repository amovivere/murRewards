# -*- coding: utf-8 -*-
"""Второй визуальный проход: фейдеры, кнопки, подсказки, OBS-окно, очередь."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")


def sub(old: str, new: str) -> None:
    global s
    assert old in s, "NOT FOUND: " + old[:120]
    s = s.replace(old, new, 1)


# ---------------------------------------------------------------- helpers
HELPERS = r'''
/// Привязка прямоугольника к пиксельной сетке: тонкие контуры без «лесенки».
fn snap_rect(ui: &egui::Ui, rect: egui::Rect) -> egui::Rect {
    let ppp = ui.ctx().pixels_per_point();
    let snap = |value: f32| (value * ppp).round() / ppp;
    egui::Rect::from_min_max(
        egui::pos2(snap(rect.min.x), snap(rect.min.y)),
        egui::pos2(snap(rect.max.x), snap(rect.max.y)),
    )
}

/// Тонкий фейдер в стиле макета: светлая заполненная часть, серая дорожка и
/// круглый ползунок без обводки.
fn fader(
    ui: &mut egui::Ui,
    value: &mut f32,
    min: f32,
    max: f32,
    width: f32,
) -> egui::Response {
    let (rect, mut response) =
        ui.allocate_exact_size(Vec2::new(width.max(40.0), 20.0), Sense::click_and_drag());
    let rect = snap_rect(ui, rect);
    let enabled = ui.is_enabled();
    let span = (max - min).max(f32::EPSILON);

    if enabled {
        if let Some(pos) = response.interact_pointer_pos() {
            if response.dragged() || response.clicked() {
                let fraction = ((pos.x - rect.left()) / rect.width()).clamp(0.0, 1.0);
                let new_value = min + fraction * span;
                if (new_value - *value).abs() > 1e-5 {
                    *value = new_value;
                    response.mark_changed();
                }
            }
        }
    }

    let fraction = ((*value - min) / span).clamp(0.0, 1.0);
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

s = s.replace("/// Кнопка внутри сегментированного переключателя (Плитка / Список).",
              HELPERS + "/// Кнопка внутри сегментированного переключателя (Плитка / Список).", 1)

# ---------------------------------------------------------------- theme hint
t = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\theme.rs")
th = t.read_text(encoding="utf-8")
old_theme = "    visuals.override_text_color = Some(TEXT);\n"
new_theme = "    // Не переопределяем цвет всех текстов: иначе подсказки в полях\n    // (hint_text) рисуются ярким цветом вместо приглушённого.\n    visuals.override_text_color = None;\n"
if old_theme in th:
    th = th.replace(old_theme, new_theme, 1)
    t.write_text(th, encoding="utf-8")

# ---------------------------------------------------------------- styled button
sub("""    let enabled = ui.is_enabled();
    // Инверсия: при наведении фон и текст меняются местами.
    let hovered = response.hovered() && enabled;
    let (fill, text, edge) = if !enabled {
        (
            with_alpha(text_color, 10),
            with_alpha(text_color, 80),
            with_alpha(border, 28),
        )
    } else if hovered {
        (
            text_color,
            if base.a() >= 200 { base } else { BG },
            text_color,
        )
    } else {
        (base, text_color, border)
    };

    let painter = ui.painter();
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
"""    let enabled = ui.is_enabled();
    let rect = snap_rect(ui, rect);
    // Инверсия: при наведении фон и текст меняются местами.
    let hovered = response.hovered() && enabled;
    let (fill, text, edge) = if !enabled {
        (
            Color32::TRANSPARENT,
            with_alpha(text_color, 80),
            with_alpha(border, 26),
        )
    } else if hovered {
        (text_color, if base.a() >= 200 { base } else { BG }, text_color)
    } else {
        (base, text_color, border)
    };

    let painter = ui.painter();
    // Прозрачный фон у secondary/ghost — как в макете: сквозь кнопку видна
    // карточка. Никаких подмен на CARD.
    painter.rect(rect, Rounding::same(17.0), fill, Stroke::new(1.5_f32, edge));
    painter.text(
        rect.center(),
        Align2::CENTER_CENTER,
        label,
        font,
        text,
    );
""")

# ---------------------------------------------------------------- ghost button
start = s.index("fn ghost_button(ui: &mut egui::Ui, label: &str, color: Color32) -> egui::Response {")
end = s.index("/// Иконки, которые рисуются кодом:", start)
new_ghost = r'''fn ghost_button(ui: &mut egui::Ui, label: &str, color: Color32) -> egui::Response {
    let font = FontId::new(13.8, egui::FontFamily::Proportional);
    let enabled = ui.is_enabled();
    let width = ui
        .painter()
        .layout_no_wrap(label.to_owned(), font.clone(), TEXT)
        .size()
        .x;
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(width + 10.0, 30.0), Sense::click());
    let rect = snap_rect(ui, rect);
    let hovered = response.hovered() && enabled;
    let tint = if enabled { color } else { with_alpha(color, 80) };
    if hovered {
        ui.painter().rect_filled(
            rect,
            Rounding::same(8.0),
            with_alpha(color, 26),
        );
    }
    ui.painter().text(
        rect.center(),
        Align2::CENTER_CENTER,
        label,
        font,
        tint,
    );
    response
}

'''
s = s[:start] + new_ghost + s[end:]

# ---------------------------------------------------------------- pill button: fill-only + snap
sub("""    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(width + 34.0, 32.0), Sense::click());
    let enabled = ui.is_enabled();
    let hovered = response.hovered() && enabled;
    let painter = ui.painter();
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
"""    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(width + 34.0, 32.0), Sense::click());
    let rect = snap_rect(ui, rect);
    let enabled = ui.is_enabled();
    let hovered = response.hovered() && enabled;
    let painter = ui.painter();
    // Только заливка: обводка на скруглениях 1× выглядела «лесенкой».
    painter.rect_filled(
        rect,
        Rounding::same(16.0),
        if !enabled {
            with_alpha(color, 8)
        } else if hovered {
            color
        } else {
            with_alpha(color, 26)
        },
    );
""")

# ---------------------------------------------------------------- filter chip: fill + snap + border fill
sub("""    let (rect, response) = ui.allocate_exact_size(Vec2::new(width, 30.0), Sense::click());
    let hovered = response.hovered();
    let bg = if active {
        with_alpha(Color32::WHITE, 14)
    } else if hovered {
        with_alpha(Color32::WHITE, 8)
    } else {
        with_alpha(Color32::WHITE, 4)
    };
    let stroke = if active {
        Stroke::new(1.0_f32, with_alpha(Color32::WHITE, 60))
    } else {
        Stroke::new(1.0_f32, with_alpha(Color32::WHITE, 22))
    };
    ui.painter()
        .rect(rect, Rounding::same(15.0), bg, stroke);
""",
"""    let (rect, response) = ui.allocate_exact_size(Vec2::new(width, 30.0), Sense::click());
    let rect = snap_rect(ui, rect);
    let hovered = response.hovered();
    let bg = if active {
        with_alpha(Color32::WHITE, 16)
    } else if hovered {
        with_alpha(Color32::WHITE, 9)
    } else {
        with_alpha(Color32::WHITE, 4)
    };
    // Рамка без stroke: внешняя заливка + внутренняя, край остаётся гладким.
    let edge = if active {
        with_alpha(Color32::WHITE, 58)
    } else {
        with_alpha(Color32::WHITE, 24)
    };
    ui.painter().rect_filled(rect, Rounding::same(15.0), edge);
    ui.painter().rect_filled(
        rect.shrink(1.0),
        Rounding::same(14.0),
        bg,
    );
""")

# ---------------------------------------------------------------- segmented container: fill-only
sub("""            egui::Frame::none()
                .fill(with_alpha(Color32::WHITE, 5))
                .stroke(Stroke::new(1.0_f32, with_alpha(Color32::WHITE, 42)))
                .rounding(Rounding::same(17.0))
                .inner_margin(egui::Margin::symmetric(3.0, 2.0))
                .show(ui, |ui| {
                    ui.horizontal(|ui| {
                        ui.spacing_mut().item_spacing.x = 2.0;
                        if seg_button(ui, UiIcon::Grid, "Плитка", grid_view) {
""",
"""            egui::Frame::none()
                .fill(with_alpha(Color32::WHITE, 7))
                .rounding(Rounding::same(17.0))
                .inner_margin(egui::Margin::symmetric(3.0, 2.0))
                .show(ui, |ui| {
                    ui.horizontal(|ui| {
                        ui.spacing_mut().item_spacing.x = 2.0;
                        if seg_button(ui, UiIcon::Grid, "Плитка", grid_view) {
""")

# ---------------------------------------------------------------- seg button snap
sub("""    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(text_width + 44.0, 28.0), Sense::click());
    let hovered = response.hovered();
""",
"""    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(text_width + 44.0, 28.0), Sense::click());
    let rect = snap_rect(ui, rect);
    let hovered = response.hovered();
""")

# ---------------------------------------------------------------- sliders -> fader
# header volume
sub("""                        let mut volume = self.settings.volume;
                        ui.spacing_mut().slider_width = if compact { 92.0 } else { 128.0 };
                        let response = ui.add(
                            egui::Slider::new(&mut volume, 0.0..=1.0)
                                .show_value(false)
                                .trailing_fill(true),
                        );
""",
"""                        let mut volume = self.settings.volume;
                        let response = fader(
                            ui,
                            &mut volume,
                            0.0,
                            1.0,
                            if compact { 92.0 } else { 128.0 },
                        );
""")
# local bindings
sub("""                                    let mut volume = binding.volume;
                                    ui.spacing_mut().slider_width = 70.0;
                                    let slider = ui.add(
                                        egui::Slider::new(&mut volume, 0.0..=2.0)
                                            .show_value(false)
                                            .trailing_fill(true),
                                    );
""",
"""                                    let mut volume = binding.volume as f32;
                                    let slider = fader(ui, &mut volume, 0.0, 2.0, 70.0);
                                    let mut volume = volume as f64;
""")
# volume card
sub("""                let mut volume = self.settings.volume;
                ui.spacing_mut().slider_width = 240.0;
                let response = ui.add(
                    egui::Slider::new(&mut volume, 0.0..=1.0)
                        .show_value(false)
                        .trailing_fill(true),
                );
""",
"""                let mut volume = self.settings.volume;
                let response = fader(ui, &mut volume, 0.0, 1.0, 240.0);
""")
# music player volume
sub("""                    let mut volume = self.settings.music.music_volume;
                    let changed = ui
                        .add(
                            egui::Slider::new(&mut volume, 0.0..=1.0)
                                .show_value(false)
                                .trailing_fill(true),
                        )
                        .changed();
""",
"""                    let mut volume = self.settings.music.music_volume as f32;
                    let changed = fader(ui, &mut volume, 0.0, 1.0, 120.0).changed();
                    let mut volume = volume as f64;
""")
# grid card volume
sub("""                        let mut volume = binding.volume;
                        ui.spacing_mut().slider_width = 90.0;
                        let slider = ui.add(
                            egui::Slider::new(&mut volume, 0.0..=2.0)
                                .show_value(false)
                                .trailing_fill(true),
                        );
""",
"""                        let mut volume = binding.volume as f32;
                        let slider = fader(ui, &mut volume, 0.0, 2.0, 90.0);
                        let volume = volume as f64;
""")
# list card volume
sub("""                            let mut volume = binding.volume;
                            ui.spacing_mut().slider_width = 110.0;
                            let slider = ui.add(
                                egui::Slider::new(&mut volume, 0.0..=2.0)
                                    .show_value(false)
                                    .trailing_fill(true),
                            );
""",
"""                            let mut volume = binding.volume as f32;
                            let slider = fader(ui, &mut volume, 0.0, 2.0, 110.0);
                            let volume = volume as f64;
""")

# ---------------------------------------------------------------- remove equalizer wave in player
sub("""                        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                            let (wave_rect, _) =
                                ui.allocate_exact_size(Vec2::new(62.0, 26.0), Sense::hover());
                            if playing && !snapshot.player.paused {
                                for (index, height) in
                                    [9.0_f32, 17.0, 24.0, 15.0, 10.0].iter().enumerate()
                                {
                                    let x = wave_rect.left() + index as f32 * 12.0;
                                    let bar = egui::Rect::from_min_max(
                                        egui::pos2(
                                            x,
                                            wave_rect.center().y - height / 2.0,
                                        ),
                                        egui::pos2(
                                            x + 6.0,
                                            wave_rect.center().y + height / 2.0,
                                        ),
                                    );
                                    ui.painter().rect_filled(
                                        bar,
                                        Rounding::same(3.0),
                                        with_alpha(SUCCESS, 200),
                                    );
                                }
                            }
                        });
""",
"")

# ---------------------------------------------------------------- prefetch hint in queue
sub("""            // Ручная заявка.
            ui.add_space(4.0);
""",
"""            if let Some(prefetched) = snapshot.prefetched.as_ref() {
                let title = snapshot
                    .items
                    .iter()
                    .find(|item| &item.video_id == prefetched)
                    .map(|item| item.label())
                    .unwrap_or_else(|| prefetched.clone());
                ui.add_space(2.0);
                ui.horizontal(|ui| {
                    ui.label(RichText::new("✓").size(12.0).color(SUCCESS));
                    ui.label(
                        RichText::new(format!(
                            "«{title}» уже загружен — начнётся без задержки"
                        ))
                        .size(11.0)
                        .color(with_alpha(SUCCESS, 190)),
                    );
                });
            }

            // Ручная заявка.
            ui.add_space(4.0);
""")

P.write_text(s, encoding="utf-8")
print("fix pass 2 patched")
