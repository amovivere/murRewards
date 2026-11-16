# -*- coding: utf-8 -*-
"""Финальная подгонка музыки под макет + мелкие детали."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")


def sub(old: str, new: str) -> None:
    global s
    assert old in s, "NOT FOUND: " + old[:110]
    s = s.replace(old, new, 1)


# --- Плеер компактнее ---
sub("Vec2::new(left_width, 146.0),", "Vec2::new(left_width, 132.0),")
sub("Vec2::new(right_width, 146.0),", "Vec2::new(right_width, 132.0),")
sub("""                let (line_rect, _) = ui.allocate_exact_size(
                    Vec2::new(1.0, 134.0),
                    Sense::hover(),
                );""",
"""                let (line_rect, _) = ui.allocate_exact_size(
                    Vec2::new(1.0, 118.0),
                    Sense::hover(),
                );""")
sub("ui.allocate_exact_size(Vec2::splat(100.0), Sense::hover());",
    "ui.allocate_exact_size(Vec2::splat(94.0), Sense::hover());")

# --- Обложка: музыкальная нота как в макете (вместо эквалайзера) ---
sub("""                        ui.painter().rect_filled(
                            art_rect,
                            Rounding::same(22.0),
                            with_alpha(ACCENT, 26),
                        );
                        for (index, height) in
                            [22.0_f32, 40.0, 32.0, 18.0].iter().enumerate()
                        {
                            let x = art_rect.left() + 22.0 + index as f32 * 16.0;
                            let bar = egui::Rect::from_min_max(
                                egui::pos2(x, art_rect.center().y - height / 2.0),
                                egui::pos2(x + 8.0, art_rect.center().y + height / 2.0),
                            );
                            ui.painter().rect_filled(bar, Rounding::same(4.0), ACCENT);
                        }
""",
"""                        ui.painter().rect_filled(
                            art_rect,
                            Rounding::same(22.0),
                            with_alpha(ACCENT, 26),
                        );
                        {
                            let ink = with_alpha(TEXT, 190);
                            let stroke = Stroke::new(2.4_f32, ink);
                            let c = art_rect.center();
                            let head = 6.0;
                            let left = egui::pos2(c.x - 20.0, c.y + 20.0);
                            let right = egui::pos2(c.x + 8.0, c.y + 14.0);
                            ui.painter().circle_filled(left, head, ink);
                            ui.painter().circle_filled(right, head, ink);
                            ui.painter().line_segment(
                                [egui::pos2(left.x + 5.0, left.y), egui::pos2(left.x + 5.0, left.y - 38.0)],
                                stroke,
                            );
                            ui.painter().line_segment(
                                [egui::pos2(right.x + 5.0, right.y), egui::pos2(right.x + 5.0, right.y - 34.0)],
                                stroke,
                            );
                            ui.painter().line_segment(
                                [egui::pos2(left.x + 5.0, left.y - 38.0), egui::pos2(right.x + 5.0, right.y - 34.0)],
                                stroke,
                            );
                        }
""")

# --- Очередь: убрать строку-подсказку под ручной ссылкой (есть в плейсхолдере/тултипе) ---
sub("""            ui.add_space(2.0);
            ui.label(
                RichText::new("Ручная очередь не тратит баллы зрителей — удобно для проверки.")
                    .size(11.0)
                    .color(with_alpha(TEXT_DIM, 190)),
            );
""",
"""""")

# --- Нижние карточки немного ниже и компактнее ---
sub("""            ui.allocate_ui_with_layout(
                Vec2::new(obs_width, 128.0),
                Layout::top_down(Align::Min),
                |ui| {
                card_frame().show(ui, |ui| {
                    ui.set_width(ui.available_width());
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new("OBS — строка «Сейчас играет»")
""",
"""            ui.allocate_ui_with_layout(
                Vec2::new(obs_width, 108.0),
                Layout::top_down(Align::Min),
                |ui| {
                egui::Frame::none()
                    .fill(CARD)
                    .stroke(Stroke::new(1.0_f32, BORDER))
                    .rounding(Rounding::same(18.0))
                    .inner_margin(egui::Margin::symmetric(16.0, 10.0))
                    .show(ui, |ui| {
                    ui.set_width(ui.available_width());
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new("OBS — строка «Сейчас играет»")
""")
sub("""            ui.allocate_ui_with_layout(
                Vec2::new(state_width, 128.0),
                Layout::top_down(Align::Min),
                |ui| {
                card_frame().show(ui, |ui| {
                    ui.set_width(ui.available_width());
                    ui.label(
                        RichText::new("Состояние")
""",
"""            ui.allocate_ui_with_layout(
                Vec2::new(state_width, 108.0),
                Layout::top_down(Align::Min),
                |ui| {
                egui::Frame::none()
                    .fill(CARD)
                    .stroke(Stroke::new(1.0_f32, BORDER))
                    .rounding(Rounding::same(18.0))
                    .inner_margin(egui::Margin::symmetric(16.0, 10.0))
                    .show(ui, |ui| {
                    ui.set_width(ui.available_width());
                    ui.label(
                        RichText::new("Состояние")
""")

# --- Прогресс «0 из 3» в шапке быстрого старта ---
sub("""                    ui.label(
                        RichText::new("Три шага — и звуки будут играть на стриме автоматически.")
                            .size(12.8)
                            .color(TEXT_DIM),
                    );
""",
"""                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new(
                                "Три шага — и звуки будут играть на стриме автоматически.",
                            )
                            .size(12.8)
                            .color(TEXT_DIM),
                        );
                        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                            pill_button(ui, "0 из 3", TEXT_DIM);
                        });
                    });
""")

P.write_text(s, encoding="utf-8")
print("music/cover/onboarding details patched")
