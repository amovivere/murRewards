# -*- coding: utf-8 -*-
import pathlib
P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")

def sub(old, new):
    global s
    assert old in s, "NOT FOUND: " + old[:110]
    s = s.replace(old, new, 1)

# helper перед icon_button
sub("""/// Круглая кнопка-иконка с подсказкой (34×34 по умолчанию).
fn icon_button(""",
"""/// Кнопка прослушивания звука: круг с треугольником, как в макете.
fn sound_play_button(ui: &mut egui::Ui, size: f32, enabled: bool) -> egui::Response {
    let (rect, response) = ui.allocate_exact_size(Vec2::splat(size), Sense::click());
    let hovered = response.hovered();
    ui.painter().circle_filled(
        rect.center(),
        size * 0.5,
        if hovered {
            with_alpha(Color32::WHITE, 22)
        } else {
            with_alpha(Color32::WHITE, 10)
        },
    );
    paint_ui_icon(
        ui.painter(),
        rect.shrink(size * 0.22),
        UiIcon::Play,
        if enabled { TEXT } else { with_alpha(TEXT_DIM, 120) },
    );
    response.on_hover_text(if enabled { "Прослушать" } else { "Файл не найден" })
}

/// Круглая кнопка-иконка с подсказкой (34×34 по умолчанию).
fn icon_button(""")

# grid-карточка
sub("""                            if icon_button(
                                ui,
                                UiIcon::Play,
                                if exists { "Прослушать" } else { "Файл не найден" },
                                24.0,
                            )
                            .clicked()
                                && exists
                            {
""",
"""                            if sound_play_button(ui, 24.0, exists).clicked() && exists {
""")
# list-карточка
sub("""                        if icon_button(
                            ui,
                            UiIcon::Play,
                            if exists { "Прослушать" } else { "Файл не найден" },
                            26.0,
                        )
                        .clicked()
                            && exists
                        {
""",
"""                        if sound_play_button(ui, 26.0, exists).clicked() && exists {
""")
# локальные привязки
sub("""                                    if icon_button(ui, UiIcon::Play, "Прослушать", 24.0)
                                        .clicked()
                                        && exists
                                    {
""",
"""                                    if sound_play_button(ui, 22.0, exists).clicked() && exists {
""")
P.write_text(s, encoding="utf-8")
print("play buttons unified")