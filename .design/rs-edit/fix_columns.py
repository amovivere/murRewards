# -*- coding: utf-8 -*-
"""Исправление раскладки двухколоночных блоков (Музыка, Онбординг)."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")


def sub(old: str, new: str) -> None:
    global s
    assert old in s, "NOT FOUND: " + old[:110]
    s = s.replace(old, new, 1)


# --- Плеер: фиксированные две колонки через allocate_ui_with_layout ---
sub("""        card_frame().show(ui, |ui| {
            ui.set_width(ui.available_width());
            ui.horizontal_top(|ui| {
                let right_width = 210.0;
                let left_width = (ui.available_width() - right_width - 18.0).max(300.0);

                ui.allocate_ui(Vec2::new(left_width, 0.0), |ui| {
""",
"""        card_frame().show(ui, |ui| {
            ui.set_width(ui.available_width());
            let total_width = ui.available_width();
            ui.horizontal_top(|ui| {
                let right_width = 204.0;
                let left_width = (total_width - right_width - 30.0).max(300.0);

                ui.allocate_ui_with_layout(
                    Vec2::new(left_width, 152.0),
                    Layout::top_down(Align::Min),
                    |ui| {
""")
sub("""                ui.add_space(14.0);
                let (line_rect, _) = ui.allocate_exact_size(
                    Vec2::new(1.0, 138.0),
                    Sense::hover(),
                );
                ui.painter().rect_filled(
                    line_rect,
                    Rounding::ZERO,
                    with_alpha(Color32::WHITE, 22),
                );
                ui.add_space(14.0);
                ui.vertical(|ui| {
                    ui.set_width(right_width);
""",
"""                ui.add_space(12.0);
                let (line_rect, _) = ui.allocate_exact_size(
                    Vec2::new(1.0, 140.0),
                    Sense::hover(),
                );
                ui.painter().rect_filled(
                    line_rect,
                    Rounding::ZERO,
                    with_alpha(Color32::WHITE, 22),
                );
                ui.add_space(12.0);
                ui.allocate_ui_with_layout(
                    Vec2::new(right_width, 152.0),
                    Layout::top_down(Align::Min),
                    |ui| {
""")
# закрываем новую вложенность: после блока с «Следующий» было `});` для horizontal_top,
# а теперь нужен дополнительный закрывающий `});` для allocate_ui_with_layout.
sub("""                    } else {
                        ui.label(RichText::new("Следующий: —").size(11.2).color(TEXT_DIM));
                    }
                });
            });

            if let Some(error) = snapshot.player.error.as_ref() {
""",
"""                    } else {
                        ui.label(RichText::new("Следующий: —").size(11.2).color(TEXT_DIM));
                    }
                    },
                );
            });

            if let Some(error) = snapshot.player.error.as_ref() {
""")

# --- Нижний ряд музыки ---
sub("""            ui.allocate_ui(Vec2::new(obs_width, 0.0), |ui| {
                card_frame().show(ui, |ui| {
""",
"""            ui.allocate_ui_with_layout(
                Vec2::new(obs_width, 128.0),
                Layout::top_down(Align::Min),
                |ui| {
                card_frame().show(ui, |ui| {
""")
sub("""            ui.add_space(10.0);

            ui.allocate_ui(Vec2::new(state_width, 0.0), |ui| {
                card_frame().show(ui, |ui| {
""",
"""            ui.add_space(10.0);

            ui.allocate_ui_with_layout(
                Vec2::new(state_width, 128.0),
                Layout::top_down(Align::Min),
                |ui| {
                card_frame().show(ui, |ui| {
""")
# закрываем два allocate_ui_with_layout в нижнем ряду: ищем конец блока состояния
sub("""                    if snapshot.ytdlp_version.is_none() {
                        ui.add_space(4.0);
                        if secondary_button(ui, "Проверить снова").clicked() {
                            recheck = true;
                        }
                    }
                });
            });
        });
""",
"""                    if snapshot.ytdlp_version.is_none() {
                        ui.add_space(4.0);
                        if secondary_button(ui, "Проверить снова").clicked() {
                            recheck = true;
                        }
                    }
                });
                },
            );
        });
""")

# --- Онбординг: левая колонка ---
sub("""            ui.allocate_ui(Vec2::new(left_width, 0.0), |ui| {
                card_frame().show(ui, |ui| {
""",
"""            ui.allocate_ui_with_layout(
                Vec2::new(left_width, 432.0),
                Layout::top_down(Align::Min),
                |ui| {
                card_frame().show(ui, |ui| {
""")
# --- Онбординг: правая колонка ---
sub("""            ui.allocate_ui(Vec2::new(right_width, 0.0), |ui| {
                ui.vertical(|ui| {
""",
"""            ui.allocate_ui_with_layout(
                Vec2::new(right_width, 432.0),
                Layout::top_down(Align::Min),
                |ui| {
                ui.vertical(|ui| {
""")
# закрываем левую allocate (после «Проверить подключение»)
sub("""                        });
                    });
                });
            });

            ui.add_space(10.0);

            ui.allocate_ui_with_layout(
                Vec2::new(right_width, 432.0),
""",
"""                        });
                    });
                });
                },
            );

            ui.add_space(10.0);

            ui.allocate_ui_with_layout(
                Vec2::new(right_width, 432.0),
""")
# закрываем правую allocate (после второй карточки «Звук готов»)
sub("""                            });
                        });
                    });
                });
            });
        });

        ui.add_space(12.0);
        self.local_bindings_card(ui);
""",
"""                            });
                        });
                    });
                });
                },
            );
        });

        ui.add_space(12.0);
        self.local_bindings_card(ui);
""")

P.write_text(s, encoding="utf-8")
print("column layouts patched")
