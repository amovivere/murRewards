# -*- coding: utf-8 -*-
"""Полировка после скриншотов: чипы, плейсхолдер, предзагрузка, OBS."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")


def sub(old: str, new: str) -> None:
    global s
    assert old in s, "NOT FOUND: " + old[:120]
    s = s.replace(old, new, 1)


# --- helper: непрозрачное смешивание (чтобы альфа-заливки не складывались) ---
anchor = "/// Привязка прямоугольника к пиксельной сетке"
helper = r'''/// Смешивает полупрозрачный цвет с фоном и возвращает непрозрачный:
/// так две альфа-заливки (рамка + тело чипа) не складываются в светлое пятно.
fn blend_over(base: Color32, overlay: Color32) -> Color32 {
    let a = overlay.a() as f32 / 255.0;
    let mix = |fg: u8, bg: u8| (fg as f32 * a + bg as f32 * (1.0 - a)).round() as u8;
    Color32::from_rgb(
        mix(overlay.r(), base.r()),
        mix(overlay.g(), base.g()),
        mix(overlay.b(), base.b()),
    )
}

'''
assert anchor in s
s = s.replace(anchor, helper + anchor, 1)

# --- чипы: обе заливки непрозрачные, чтобы рамка не просвечивала ---
sub("""    // Рамка без stroke: внешняя заливка + внутренняя, край остаётся гладким.
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
""",
"""    // Рамка без stroke: внешняя заливка + внутренняя, край остаётся гладким.
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
""")

# --- OBS: выбранное положение — белая плашка с тёмным текстом ---
sub("""    if active {
        ui.painter()
            .rect_filled(rect, Rounding::same(9.0), with_alpha(Color32::WHITE, 18));
        ui.painter().rect_filled(
            rect.shrink(1.0),
            Rounding::same(8.0),
            with_alpha(Color32::WHITE, 8),
        );
    } else if hovered {
""",
"""    if active {
        ui.painter().rect_filled(rect, Rounding::same(9.0), TEXT);
    } else if hovered {
""")
sub("""        label,
        font,
        if active { TEXT } else { TEXT_DIM },
    );
    response.clicked()
""",
"""        label,
        font,
        if active { BG } else { TEXT_DIM },
    );
    response.clicked()
""")

# --- плейсхолдер ручной ссылки: рисуем сами, чтобы он был приглушён ---
sub("""                        let response = ui.add(
                            egui::TextEdit::singleline(&mut self.music_manual_input)
                                .frame(false)
                                .hint_text(
                                    "Вставьте ссылку YouTube и нажмите Enter — трек встанет в очередь",
                                )
                                .desired_width(width)
                                .font(FontId::proportional(13.2)),
                        );
                        if response.lost_focus()
""",
"""                        let response = ui.add(
                            egui::TextEdit::singleline(&mut self.music_manual_input)
                                .frame(false)
                                .desired_width(width)
                                .font(FontId::proportional(13.2)),
                        );
                        if self.music_manual_input.is_empty() {
                            let hint_pos = response.rect.left_center() + Vec2::new(2.0, 0.0);
                            ui.painter().text(
                                hint_pos,
                                Align2::LEFT_CENTER,
                                "Вставьте ссылку YouTube и нажмите Enter — трек встанет в очередь",
                                FontId::proportional(13.2),
                                with_alpha(TEXT_DIM, 185),
                            );
                        }
                        if response.lost_focus()
""")

# --- предзагрузка: чип в шапке очереди вместо отдельной строки ---
sub("""                if loading > 0 {
                    ui.add_space(2.0);
                    queue_state_chip(ui, ItemState::Loading);
                }
""",
"""                if loading > 0 {
                    ui.add_space(2.0);
                    queue_state_chip(ui, ItemState::Loading);
                }
                if let Some(prefetched) = snapshot.prefetched.as_ref() {
                    let title = snapshot
                        .items
                        .iter()
                        .find(|item| &item.video_id == prefetched)
                        .map(|item| item.label())
                        .unwrap_or_else(|| prefetched.clone());
                    ui.add_space(4.0);
                    ui.label(
                        RichText::new("✓ следующий загружен")
                            .size(11.0)
                            .color(with_alpha(SUCCESS, 210)),
                    )
                    .on_hover_text(format!(
                        "«{title}» уже в памяти — начнётся без задержки"
                    ));
                }
""")
# удаляем отдельную строку предзагрузки
start = s.index("            if let Some(prefetched) = snapshot.prefetched.as_ref() {")
end = s.index("            // Ручная заявка.", start)
s = s[:start] + s[end:]

# --- ???? убрать пустые строки от прежней подсказки
s = s.replace("""            if let Some(input) = ui.ctx().memory(|memory| {
                let _ = memory;
                None
            }) {
                let _ = input;
            }
""", "", 1)

P.write_text(s, encoding="utf-8")
print("polish pass 2 applied")
