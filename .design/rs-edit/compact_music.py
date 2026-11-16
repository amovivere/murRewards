# -*- coding: utf-8 -*-
"""Компактнее плеер и очередь музыки, чтобы весь экран совпал с макетом."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")


def sub(old: str, new: str) -> None:
    global s
    assert old in s, "NOT FOUND: " + old[:110]
    s = s.replace(old, new, 1)


# Плеер: 146 px контента вместо 152, разделитель 134.
sub("Vec2::new(left_width, 152.0),", "Vec2::new(left_width, 146.0),")
sub("Vec2::new(right_width, 152.0),", "Vec2::new(right_width, 146.0),")
sub(
    """                let (line_rect, _) = ui.allocate_exact_size(
                    Vec2::new(1.0, 140.0),
                    Sense::hover(),
                );""",
    """                let (line_rect, _) = ui.allocate_exact_size(
                    Vec2::new(1.0, 134.0),
                    Sense::hover(),
                );""",
)
# Обложка плеера чуть меньше.
sub("ui.allocate_exact_size(Vec2::splat(104.0), Sense::hover());",
    "ui.allocate_exact_size(Vec2::splat(100.0), Sense::hover());")

# Очередь: своя рамка с меньшими отступами.
sub("""        card_frame().show(ui, |ui| {
            ui.set_width(ui.available_width());

            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(format!("Очередь · {} из {}", pending.len(), max_queue))
""",
    """        egui::Frame::none()
            .fill(CARD)
            .stroke(Stroke::new(1.0_f32, BORDER))
            .rounding(Rounding::same(18.0))
            .inner_margin(egui::Margin::symmetric(16.0, 12.0))
            .show(ui, |ui| {
            ui.set_width(ui.available_width());

            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(format!("Очередь · {} из {}", pending.len(), max_queue))
""",
)

# Строки очереди — компактнее.
sub(""".inner_margin(egui::Margin::symmetric(10.0, 5.0))
                    .show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        ui.horizontal(|ui| {
                            let (bar_rect, _) =
                                ui.allocate_exact_size(Vec2::new(3.0, 26.0), Sense::hover());
""",
""".inner_margin(egui::Margin::symmetric(10.0, 2.0))
                    .show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        ui.horizontal(|ui| {
                            let (bar_rect, _) =
                                ui.allocate_exact_size(Vec2::new(3.0, 24.0), Sense::hover());
""",
)

# Ручная строка — ниже и компактнее.
sub("""            ui.add_space(6.0);
            ui.horizontal(|ui| {
                let width = (ui.available_width() - 128.0).clamp(220.0, 640.0);
                egui::Frame::none()
                    .fill(CARD)
                    .stroke(Stroke::new(1.0_f32, BORDER))
                    .rounding(Rounding::same(17.0))
                    .inner_margin(egui::Margin::symmetric(12.0, 6.0))
""",
"""            ui.add_space(4.0);
            ui.horizontal(|ui| {
                let width = (ui.available_width() - 128.0).clamp(220.0, 640.0);
                egui::Frame::none()
                    .fill(BG)
                    .stroke(Stroke::new(1.0_f32, with_alpha(BORDER, 200)))
                    .rounding(Rounding::same(16.0))
                    .inner_margin(egui::Margin::symmetric(12.0, 4.0))
""",
)

# Убираем строку «Сыграно» из карточки очереди: истории место в журнале/оверлее.
start = s.index("""            if let Some(item) = finished.first() {
                ui.add_space(4.0);
                ui.horizontal(|ui| {
                    ui.label(RichText::new("Сыграно:").size(11.6).color(TEXT_DIM));""")
end = s.index("""            }
        });

        ui.add_space(10.0);

        // ---- Нижний ряд: OBS и состояние ----""")
# вырезаем только блок finished, оставляя внешние закрывающие скобки карточки
finished_block_start = start
finished_block_end = s.index("""        });

        ui.add_space(10.0);

        // ---- Нижний ряд: OBS и состояние ----""")
s = s[:finished_block_start] + s[finished_block_end:]
# после удаления блока остались лишние закрывающие скобки? Проверим компиляцией.

P.write_text(s, encoding="utf-8")
print("music compacted")
