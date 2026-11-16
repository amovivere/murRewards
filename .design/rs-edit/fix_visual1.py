# -*- coding: utf-8 -*-
import pathlib
P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
src = P.read_text(encoding="utf-8")

def sub_once(old, new):
    global src
    assert old in src, "NOT FOUND: " + old[:100]
    src = src.replace(old, new, 1)

# 1) Карточка не должна растягиваться по высоте: убираем bottom_up-раскладку.
sub_once(
"""            ui.with_layout(Layout::bottom_up(Align::Min), |ui| {
                ui.add_space(2.0);
                ui.horizontal(|ui| match binding {
                    Some(_) => {
                        if secondary_button(ui, "Заменить").clicked() {
                            action = Some(RewardUiAction::Bind {
                                reward_id: reward.id.clone(),
                                title: reward.title.clone(),
                            });
                        }
                        if ghost_button(ui, "Убрать", with_alpha(DANGER, 220)).clicked() {
                            action = Some(RewardUiAction::Clear {
                                reward_id: reward.id.clone(),
                            });
                        }
                    }
                    None => {
                        if accent_button(ui, "Выбрать звук").clicked() {
                            action = Some(RewardUiAction::Bind {
                                reward_id: reward.id.clone(),
                                title: reward.title.clone(),
                            });
                        }
                    }
                });
            });
""",
"""            ui.add_space(4.0);
            ui.horizontal(|ui| match binding {
                Some(_) => {
                    if secondary_button(ui, "Заменить").clicked() {
                        action = Some(RewardUiAction::Bind {
                            reward_id: reward.id.clone(),
                            title: reward.title.clone(),
                        });
                    }
                    if ghost_button(ui, "Убрать", with_alpha(DANGER, 220)).clicked() {
                        action = Some(RewardUiAction::Clear {
                            reward_id: reward.id.clone(),
                        });
                    }
                }
                None => {
                    if accent_button(ui, "Выбрать звук").clicked() {
                        action = Some(RewardUiAction::Bind {
                            reward_id: reward.id.clone(),
                            title: reward.title.clone(),
                        });
                    }
                }
            });
""")

# 2) Баллы/статус — капсом, как в макете.
sub_once(
"""                            util::plural_ru(
                                reward.cost.max(0) as usize,
                                "балл",
                                "балла",
                                "баллов"
                            ),
                            state
                        ))
                        .size(10.8)
                        .color(with_alpha(TEXT_DIM, 230)),
""",
"""                            util::plural_ru(
                                reward.cost.max(0) as usize,
                                "БАЛЛ",
                                "БАЛЛА",
                                "БАЛЛОВ"
                            ),
                            state.to_uppercase()
                        ))
                        .size(10.8)
                        .color(with_alpha(TEXT_DIM, 230)),
""")
sub_once(
"""                            util::plural_ru(
                                reward.cost.max(0) as usize,
                                "балл",
                                "балла",
                                "баллов"
                            ),
                            state
                        ))
                        .size(11.0)
                        .color(with_alpha(TEXT_DIM, 230)),
""",
"""                            util::plural_ru(
                                reward.cost.max(0) as usize,
                                "БАЛЛ",
                                "БАЛЛА",
                                "БАЛЛОВ"
                            ),
                            state.to_uppercase()
                        ))
                        .size(11.0)
                        .color(with_alpha(TEXT_DIM, 230)),
""")

# 3) Убираем дублирующий статус из тулбара: он уже есть в шапке.
sub_once(
"""        ui.horizontal_wrapped(|ui| {
            let status_label = format!("● {listen_text}");
            let status_color = listen_color;
            if pill_button(ui, &status_label, status_color)
                .on_hover_text("Открыть настройки подключения")
                .clicked()
            {
                go_settings = true;
            }

            let search_width = (ui.available_width() - 470.0).clamp(170.0, 270.0);
""",
"""        ui.horizontal_wrapped(|ui| {
            let search_width = (ui.available_width() - 470.0).clamp(170.0, 270.0);
""")

# 4) Иконки чуть крупнее и заметнее.
sub_once(
"""    paint_ui_icon(ui.painter(), rect.shrink(size * 0.27), icon, color);
""",
"""    paint_ui_icon(ui.painter(), rect.shrink(size * 0.22), icon, color);
""")
src = src.replace(
"""            painter.circle_stroke(center, w * 0.30, stroke);
            let tip = egui::pos2(center.x + w * 0.30, center.y - h * 0.10);
""",
"""            painter.circle_stroke(center, w * 0.36, stroke);
            let tip = egui::pos2(center.x + w * 0.36, center.y - h * 0.12);
""",
1,
)

P.write_text(src, encoding="utf-8")
print("visual fixes 1 applied")