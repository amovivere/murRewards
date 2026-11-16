# -*- coding: utf-8 -*-
"""Новые карточки наград: кэш файлов, длительность, крупные hit-target."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
src = P.read_text(encoding="utf-8")


def replace_between(text: str, start_marker: str, end_marker: str, new: str) -> str:
    start = text.index(start_marker)
    end = text.index(end_marker, start)
    return text[:start] + new + text[end:]


NEW_MENU = r'''/// Меню управления наградой: изменение и удаление.
fn reward_menu(ui: &mut egui::Ui, reward: &twitch::RemoteReward) -> Option<RewardUiAction> {
    let mut action = None;
    ui.scope(|ui| {
        // Крупнее зона нажатия, чем сам текст «···».
        ui.spacing_mut().button_padding = Vec2::new(8.0, 6.0);
        ui.menu_button(
            RichText::new("···")
                .size(15.0)
                .color(with_alpha(TEXT_DIM, 230)),
            |ui| {
                ui.set_min_width(180.0);
                if ui.button("Изменить награду").clicked() {
                    action = Some(RewardUiAction::Edit {
                        reward: reward.clone(),
                    });
                    ui.close_menu();
                }
                if ui.button("Удалить награду").clicked() {
                    action = Some(RewardUiAction::Delete {
                        reward: reward.clone(),
                    });
                    ui.close_menu();
                }
            },
        );
    });
    action
}

'''

NEW_GRID = r'''/// Рисует награды плиткой.
fn draw_reward_grid(
    ui: &mut egui::Ui,
    rewards: &[&twitch::RemoteReward],
    bindings: &[crate::config::RewardSound],
    playing: &[String],
    file_cache: &HashMap<String, CachedFile>,
    columns: usize,
) -> Vec<RewardUiAction> {
    let mut actions = Vec::new();
    let columns = columns.max(1);
    for row in rewards.chunks(columns) {
        ui.columns(columns, |cols| {
            for (index, reward) in row.iter().enumerate() {
                if index >= cols.len() {
                    break;
                }
                let binding = bindings
                    .iter()
                    .find(|binding| binding.reward_id == reward.id);
                let instances = playing
                    .iter()
                    .filter(|id| id.as_str() == reward.id.as_str())
                    .count();
                if let Some(action) = reward_card_grid(
                    &mut cols[index],
                    reward,
                    binding,
                    instances,
                    file_cache,
                ) {
                    actions.push(action);
                }
            }
        });
        ui.add_space(12.0);
    }
    actions
}

/// Компактная карточка награды для режима «плитка».
fn reward_card_grid(
    ui: &mut egui::Ui,
    reward: &twitch::RemoteReward,
    binding: Option<&crate::config::RewardSound>,
    instances: usize,
    file_cache: &HashMap<String, CachedFile>,
) -> Option<RewardUiAction> {
    let mut action = None;
    let color = parse_hex_color(&reward.color).unwrap_or(ACCENT);
    let available = reward.is_available();
    let (state, _) = reward.state_label();
    let fill = tinted(CARD, color, if available { 0.13 } else { 0.05 });
    let border = tinted(BORDER, color, if available { 0.22 } else { 0.08 });

    egui::Frame::none()
        .fill(fill)
        .stroke(Stroke::new(1.0_f32, border))
        .rounding(Rounding::same(18.0))
        .inner_margin(egui::Margin::symmetric(16.0, 14.0))
        .show(ui, |ui| {
            ui.set_width(ui.available_width());
            ui.set_min_height(198.0);

            ui.horizontal(|ui| {
                let (tile, _) = ui.allocate_exact_size(Vec2::splat(38.0), Sense::hover());
                ui.painter().rect_filled(
                    tile,
                    Rounding::same(11.0),
                    with_alpha(color, if available { 235 } else { 120 }),
                );
                let letter = reward
                    .title
                    .chars()
                    .next()
                    .map(|c| c.to_uppercase().to_string())
                    .unwrap_or_else(|| "R".to_string());
                ui.painter().text(
                    tile.center(),
                    Align2::CENTER_CENTER,
                    letter,
                    FontId::new(18.0, semibold()),
                    Color32::from_rgb(0x12, 0x13, 0x22),
                );
                ui.add_space(10.0);

                ui.vertical(|ui| {
                    ui.set_max_width((ui.available_width() - 52.0).max(80.0));
                    ui.add(
                        egui::Label::new(
                            RichText::new(&reward.title)
                                .family(semibold())
                                .size(15.0)
                                .color(if available { TEXT } else { TEXT_DIM }),
                        )
                        .truncate(),
                    )
                    .on_hover_text(&reward.title);
                    ui.label(
                        RichText::new(format!(
                            "{} {} · {}",
                            reward.cost,
                            util::plural_ru(
                                reward.cost.max(0) as usize,
                                "балл",
                                "балла",
                                "баллов"
                            ),
                            state
                        ))
                        .size(10.8)
                        .color(with_alpha(TEXT_DIM, 230)),
                    );
                });

                ui.with_layout(Layout::right_to_left(Align::Min), |ui| {
                    if let Some(chosen) = reward_menu(ui, reward) {
                        action = Some(chosen);
                    }
                });
            });

            ui.add_space(10.0);

            let (meta, exists) = match binding {
                Some(binding) => sound_meta(&binding.path, file_cache.get(&binding.path)),
                None => (String::new(), true),
            };

            egui::Frame::none()
                .fill(with_alpha(Color32::WHITE, 6))
                .rounding(Rounding::same(10.0))
                .inner_margin(egui::Margin::symmetric(8.0, 6.0))
                .show(ui, |ui| {
                    ui.set_width(ui.available_width());
                    ui.horizontal(|ui| match binding {
                        Some(binding) => {
                            if icon_button(
                                ui,
                                UiIcon::Play,
                                if exists { "Прослушать" } else { "Файл не найден" },
                                24.0,
                            )
                            .clicked()
                                && exists
                            {
                                action = Some(RewardUiAction::Play {
                                    reward_id: reward.id.clone(),
                                    path: binding.path.clone(),
                                });
                            }
                            ui.add(
                                egui::Label::new(
                                    RichText::new(util::file_name(Path::new(&binding.path)))
                                        .size(11.4)
                                        .color(if exists { TEXT } else { DANGER }),
                                )
                                .truncate(),
                            )
                            .on_hover_text(&binding.path);
                            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                                ui.label(
                                    RichText::new(meta)
                                        .size(9.8)
                                        .color(if exists {
                                            with_alpha(TEXT_DIM, 220)
                                        } else {
                                            DANGER
                                        }),
                                );
                            });
                        }
                        None => {
                            ui.label(
                                RichText::new("Звук не выбран")
                                    .size(11.4)
                                    .color(with_alpha(TEXT_DIM, 200)),
                            );
                            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                                ui.label(
                                    RichText::new("нажмите «Выбрать»")
                                        .size(9.6)
                                        .color(with_alpha(TEXT_DIM, 150)),
                                );
                            });
                        }
                    });
                });

            ui.add_space(8.0);

            match binding {
                Some(binding) => {
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new("ГРОМКОСТЬ")
                                .size(9.0)
                                .color(with_alpha(TEXT_DIM, 220)),
                        );
                        let mut volume = binding.volume;
                        ui.spacing_mut().slider_width = 90.0;
                        let slider = ui.add(
                            egui::Slider::new(&mut volume, 0.0..=2.0)
                                .show_value(false)
                                .trailing_fill(true),
                        );
                        ui.label(
                            RichText::new(format!("{}%", (volume * 100.0).round() as i32))
                                .size(10.8)
                                .color(TEXT_DIM),
                        );
                        if instances > 0 {
                            ui.label(
                                RichText::new(format!("×{instances}"))
                                    .size(10.8)
                                    .color(SUCCESS),
                            );
                        }
                        if slider.changed() {
                            action = Some(RewardUiAction::SetVolume {
                                reward_id: reward.id.clone(),
                                volume,
                            });
                        }
                    });
                }
                None => {
                    ui.add_space(20.0);
                }
            }

            ui.with_layout(Layout::bottom_up(Align::Min), |ui| {
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
        });

    action
}

'''

NEW_CARD = r'''fn reward_card(
    ui: &mut egui::Ui,
    reward: &twitch::RemoteReward,
    binding: Option<&crate::config::RewardSound>,
    instances: usize,
    file_cache: &HashMap<String, CachedFile>,
) -> Option<RewardUiAction> {
    let mut action = None;
    let color = parse_hex_color(&reward.color).unwrap_or(ACCENT);
    let available = reward.is_available();
    let fill = tinted(CARD, color, if available { 0.13 } else { 0.05 });
    let border = tinted(BORDER, color, if available { 0.22 } else { 0.08 });
    let (state, _) = reward.state_label();

    egui::Frame::none()
        .fill(fill)
        .stroke(Stroke::new(1.0_f32, border))
        .rounding(Rounding::same(16.0))
        .inner_margin(egui::Margin::symmetric(16.0, 12.0))
        .show(ui, |ui| {
            ui.set_width(ui.available_width());

            ui.horizontal(|ui| {
                let (tile, _) = ui.allocate_exact_size(Vec2::splat(38.0), Sense::hover());
                ui.painter().rect_filled(
                    tile,
                    Rounding::same(11.0),
                    with_alpha(color, if available { 235 } else { 120 }),
                );
                let letter = reward
                    .title
                    .chars()
                    .next()
                    .map(|c| c.to_uppercase().to_string())
                    .unwrap_or_else(|| "R".to_string());
                ui.painter().text(
                    tile.center(),
                    Align2::CENTER_CENTER,
                    letter,
                    FontId::new(18.0, semibold()),
                    Color32::from_rgb(0x12, 0x13, 0x22),
                );
                ui.add_space(12.0);

                ui.vertical(|ui| {
                    ui.label(
                        RichText::new(&reward.title)
                            .family(semibold())
                            .size(17.0)
                            .color(if available { TEXT } else { TEXT_DIM }),
                    );
                    ui.label(
                        RichText::new(format!(
                            "{} {} · {}",
                            reward.cost,
                            util::plural_ru(
                                reward.cost.max(0) as usize,
                                "балл",
                                "балла",
                                "баллов"
                            ),
                            state
                        ))
                        .size(11.0)
                        .color(with_alpha(TEXT_DIM, 230)),
                    );
                });

                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    match binding {
                        Some(_) => {
                            if ghost_button(ui, "Убрать", with_alpha(DANGER, 220)).clicked() {
                                action = Some(RewardUiAction::Clear {
                                    reward_id: reward.id.clone(),
                                });
                            }
                            if secondary_button(ui, "Заменить").clicked() {
                                action = Some(RewardUiAction::Bind {
                                    reward_id: reward.id.clone(),
                                    title: reward.title.clone(),
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
                    }
                    if let Some(chosen) = reward_menu(ui, reward) {
                        action = Some(chosen);
                    }
                });
            });

            ui.add_space(8.0);

            match binding {
                Some(binding) => {
                    let (meta, exists) = sound_meta(&binding.path, file_cache.get(&binding.path));
                    ui.horizontal(|ui| {
                        if icon_button(
                            ui,
                            UiIcon::Play,
                            if exists { "Прослушать" } else { "Файл не найден" },
                            26.0,
                        )
                        .clicked()
                            && exists
                        {
                            action = Some(RewardUiAction::Play {
                                reward_id: reward.id.clone(),
                                path: binding.path.clone(),
                            });
                        }
                        ui.add(
                            egui::Label::new(
                                RichText::new(util::file_name(Path::new(&binding.path)))
                                    .size(13.2)
                                    .color(if exists { TEXT } else { DANGER }),
                            )
                            .truncate(),
                        )
                        .on_hover_text(&binding.path);
                        ui.label(
                            RichText::new(format!("· {meta}"))
                                .size(11.4)
                                .color(if exists { TEXT_DIM } else { DANGER }),
                        );
                        if instances > 0 {
                            ui.label(
                                RichText::new(format!("играет ×{instances}"))
                                    .size(11.0)
                                    .color(SUCCESS),
                            );
                        }

                        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                            let mut volume = binding.volume;
                            ui.spacing_mut().slider_width = 110.0;
                            let slider = ui.add(
                                egui::Slider::new(&mut volume, 0.0..=2.0)
                                    .show_value(false)
                                    .trailing_fill(true),
                            );
                            ui.label(
                                RichText::new(format!("{}%", (volume * 100.0).round() as i32))
                                    .size(11.4)
                                    .color(TEXT_DIM),
                            );
                            ui.label(
                                RichText::new("Громкость")
                                    .size(11.4)
                                    .color(with_alpha(TEXT_DIM, 210)),
                            );
                            if slider.changed() {
                                action = Some(RewardUiAction::SetVolume {
                                    reward_id: reward.id.clone(),
                                    volume,
                                });
                            }
                        });
                    });
                }
                None => {
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new("Звук не выбран — награда сработает без звука")
                                .size(12.2)
                                .color(with_alpha(TEXT_DIM, 200)),
                        );
                    });
                }
            }
        });

    action
}

'''

src = replace_between(
    src,
    "/// Меню управления наградой: изменение и удаление.\nfn reward_menu(",
    "/// Рисует награды плиткой, по три в ряд.\nfn draw_reward_grid(",
    NEW_MENU,
)
src = replace_between(
    src,
    "/// Рисует награды плиткой, по три в ряд.\nfn draw_reward_grid(",
    "fn reward_card(",
    NEW_GRID,
)
src = replace_between(
    src,
    "fn reward_card(",
    "/// Карточка привязки, для которой награда больше не существует на Twitch.",
    NEW_CARD,
)
P.write_text(src, encoding="utf-8")
print("cards updated, length", len(src))
