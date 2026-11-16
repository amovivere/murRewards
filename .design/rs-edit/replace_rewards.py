# -*- coding: utf-8 -*-
"""Замена крупных функций в app.rs: новый экран «Награды»."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
src = P.read_text(encoding="utf-8")

NEW_REWARDS = r'''    fn rewards_tab(&mut self, ui: &mut egui::Ui) {
        let connected =
            self.settings.twitch.is_connected() || self.twitch_state == TwitchState::Connected;
        let login = self.settings.twitch.login.clone();
        let mut rewards = self.remote_rewards.clone();
        twitch::sort_rewards_for_display(&mut rewards);
        let bindings = self.settings.twitch_rewards.clone();
        let playing = self.playing.clone();
        let loading = self.rewards_loading;
        let error = self.rewards_error.clone();
        let loaded = self.rewards_loaded_at;
        self.ensure_file_cache();
        let cache = self.file_cache.clone();

        let (listen_text, listen_color) = self.eventsub_status();
        let mut refresh_requested = false;
        let mut open_panel = false;
        let mut create_requested = false;
        let mut stop_all = false;
        let mut view_changed = false;
        let mut go_settings = false;
        let mut go_log = false;
        let mut reset_filters = false;
        let mut toggle_disabled = false;
        let mut grid_view = self.settings.grid_view;
        let filter = self.reward_filter;
        let mut new_filter = filter;
        let mut actions: Vec<RewardUiAction> = Vec::new();

        let count_all = rewards.len();
        let count_with = rewards
            .iter()
            .filter(|reward| bindings.iter().any(|b| b.reward_id == reward.id && b.has_sound()))
            .count();
        let count_without = count_all.saturating_sub(count_with);
        let count_disabled = rewards.iter().filter(|reward| !reward.is_available()).count();
        let count_playing = playing.len();

        // ---- Строка 1: заголовок и главное действие ----
        ui.horizontal(|ui| {
            ui.vertical(|ui| {
                ui.label(
                    RichText::new("Награды")
                        .family(semibold())
                        .size(36.0)
                        .color(TEXT),
                );
                let subtitle = if !connected {
                    "Подключите Twitch, чтобы увидеть награды".to_string()
                } else if loading && count_all == 0 {
                    "Загружаем список наград…".to_string()
                } else {
                    format!(
                        "@{login} · {} {} · {} со звуком",
                        count_all,
                        util::plural_ru(count_all, "награда", "награды", "наград"),
                        count_with
                    )
                };
                ui.label(RichText::new(subtitle).size(15.0).color(TEXT_DIM));
            });
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                if connected {
                    if accent_button(ui, "Создать награду").clicked() {
                        create_requested = true;
                    }
                    ui.add_space(6.0);
                    ui.scope(|ui| {
                        ui.spacing_mut().button_padding = Vec2::new(7.0, 8.0);
                        ui.menu_button(
                            RichText::new("···").size(17.0).color(TEXT_DIM),
                            |ui| {
                                ui.set_min_width(210.0);
                                if ui.button("Открыть панель наград Twitch").clicked() {
                                    open_panel = true;
                                    ui.close_menu();
                                }
                                if ui.button("Открыть журнал").clicked() {
                                    go_log = true;
                                    ui.close_menu();
                                }
                            },
                        );
                    });
                }
            });
        });

        // ---- Строка 2: статус, поиск, вид, обновление, стоп ----
        ui.add_space(12.0);
        ui.horizontal_wrapped(|ui| {
            let status_label = if !connected {
                "Twitch не подключён".to_string()
            } else {
                format!("● {listen_text}")
            };
            let status_color = if connected { listen_color } else { TEXT_DIM };
            if pill_button(ui, &status_label, status_color)
                .on_hover_text("Открыть настройки подключения")
                .clicked()
            {
                go_settings = true;
            }

            let search_width = (ui.available_width() - 470.0).clamp(170.0, 270.0);
            egui::Frame::none()
                .fill(CARD)
                .stroke(Stroke::new(1.0_f32, BORDER))
                .rounding(Rounding::same(17.0))
                .inner_margin(egui::Margin::symmetric(12.0, 6.0))
                .show(ui, |ui| {
                    ui.add(
                        egui::TextEdit::singleline(&mut self.search)
                            .frame(false)
                            .hint_text("Поиск награды")
                            .desired_width(search_width)
                            .font(FontId::proportional(13.6)),
                    );
                });
            if !self.search.is_empty() {
                if icon_button(ui, UiIcon::X, "Очистить поиск", 24.0).clicked() {
                    self.search.clear();
                }
            }

            // Переключатель вида.
            egui::Frame::none()
                .fill(with_alpha(Color32::WHITE, 5))
                .stroke(Stroke::new(1.0_f32, with_alpha(Color32::WHITE, 42)))
                .rounding(Rounding::same(17.0))
                .inner_margin(egui::Margin::symmetric(3.0, 2.0))
                .show(ui, |ui| {
                    ui.horizontal(|ui| {
                        ui.spacing_mut().item_spacing.x = 2.0;
                        if seg_button(ui, UiIcon::Grid, "Плитка", grid_view) {
                            grid_view = true;
                            view_changed = true;
                        }
                        if seg_button(ui, UiIcon::List, "Список", !grid_view) {
                            grid_view = false;
                            view_changed = true;
                        }
                    });
                });

            if loading {
                ui.add(egui::Spinner::new().size(16.0));
                ui.label(RichText::new("Обновляем…").size(12.6).color(TEXT_DIM));
            } else if icon_button(ui, UiIcon::Refresh, "Обновить список", 34.0).clicked() {
                refresh_requested = true;
            }

            let stop = ui
                .add_enabled_ui(!playing.is_empty(), |ui| danger_button(ui, "Остановить всё"))
                .inner;
            if stop.clicked() {
                stop_all = true;
            }
        });

        // ---- Строка 3: фильтры вместо стат-карточек ----
        ui.add_space(10.0);
        ui.horizontal_wrapped(|ui| {
            if filter_chip(ui, RewardFilter::All.label(), count_all, filter == RewardFilter::All, None)
                .clicked()
            {
                new_filter = RewardFilter::All;
            }
            if filter_chip(
                ui,
                RewardFilter::WithSound.label(),
                count_with,
                filter == RewardFilter::WithSound,
                Some(SUCCESS),
            )
            .clicked()
            {
                new_filter = RewardFilter::WithSound;
            }
            if filter_chip(
                ui,
                RewardFilter::WithoutSound.label(),
                count_without,
                filter == RewardFilter::WithoutSound,
                Some(WARN),
            )
            .clicked()
            {
                new_filter = RewardFilter::WithoutSound;
            }
            if filter_chip(
                ui,
                RewardFilter::Playing.label(),
                count_playing,
                filter == RewardFilter::Playing,
                Some(if count_playing > 0 { SUCCESS } else { TEXT_DIM }),
            )
            .clicked()
            {
                new_filter = RewardFilter::Playing;
            }
            if connected
                && count_disabled > 0
                && filter_chip(
                    ui,
                    RewardFilter::Disabled.label(),
                    count_disabled,
                    filter == RewardFilter::Disabled,
                    None,
                )
                .clicked()
            {
                new_filter = RewardFilter::Disabled;
            }
        });

        ui.add_space(12.0);

        // ---- Содержимое ----
        if !connected {
            self.quick_start_card(ui);
            ui.add_space(12.0);
            self.local_bindings_card(ui);
        } else if rewards.is_empty() && !loading {
            section_card(ui, "Наград пока нет", |ui| {
                paragraph(
                    ui,
                    "У канала нет пользовательских наград Channel Points. Создайте награду здесь или в панели Twitch — она появится в этом списке.",
                    TEXT,
                    14.4,
                );
                ui.add_space(10.0);
                ui.horizontal(|ui| {
                    if accent_button(ui, "Создать награду").clicked() {
                        create_requested = true;
                    }
                    if secondary_button(ui, "Открыть панель Twitch").clicked() {
                        open_panel = true;
                    }
                });
            });
            if let Some(err) = &error {
                ui.add_space(10.0);
                error_banner(ui, err, &mut refresh_requested);
            }
        } else {
            if let Some(err) = &error {
                error_banner(ui, err, &mut refresh_requested);
                ui.add_space(10.0);
            }

            let search = self.search.trim().to_lowercase();
            let matches = |reward: &twitch::RemoteReward| {
                search.is_empty() || reward.title.to_lowercase().contains(&search)
            };
            let is_playing = |reward: &twitch::RemoteReward| {
                playing.iter().any(|id| id == &reward.id)
            };
            let has_sound = |reward: &twitch::RemoteReward| {
                bindings
                    .iter()
                    .any(|b| b.reward_id == reward.id && b.has_sound())
            };

            let visible: Vec<&twitch::RemoteReward> = rewards
                .iter()
                .filter(|reward| match filter {
                    RewardFilter::All => reward.is_available(),
                    RewardFilter::WithSound => reward.is_available() && has_sound(reward),
                    RewardFilter::WithoutSound => reward.is_available() && !has_sound(reward),
                    RewardFilter::Playing => reward.is_available() && is_playing(reward),
                    RewardFilter::Disabled => !reward.is_available(),
                })
                .filter(|reward| matches(reward))
                .collect();

            let disabled_visible: Vec<&twitch::RemoteReward> = rewards
                .iter()
                .filter(|reward| !reward.is_available())
                .filter(|reward| matches(reward))
                .collect();

            if visible.is_empty() {
                section_card(ui, "Ничего не найдено", |ui| {
                    paragraph(
                        ui,
                        "По этому фильтру и запросу наград нет. Попробуйте изменить фильтр или сбросить поиск.",
                        TEXT_DIM,
                        14.4,
                    );
                    ui.add_space(10.0);
                    if secondary_button(ui, "Сбросить фильтры").clicked() {
                        reset_filters = true;
                    }
                });
            } else {
                egui::ScrollArea::vertical()
                    .auto_shrink([false, false])
                    .show(ui, |ui| {
                        if grid_view {
                            let columns = if ui.available_width() >= 820.0 { 3 } else { 2 };
                            actions.extend(draw_reward_grid(
                                ui,
                                &visible,
                                &bindings,
                                &playing,
                                &cache,
                                columns,
                            ));
                        } else {
                            for reward in &visible {
                                let binding = bindings
                                    .iter()
                                    .find(|binding| binding.reward_id == reward.id);
                                let instances =
                                    playing.iter().filter(|id| id.as_str() == reward.id.as_str()).count();
                                if let Some(action) =
                                    reward_card(ui, reward, binding, instances, &cache)
                                {
                                    actions.push(action);
                                }
                                ui.add_space(8.0);
                            }
                        }
                    });

                if filter == RewardFilter::All && !disabled_visible.is_empty() {
                    ui.add_space(8.0);
                    let label = format!(
                        "{} Выключенные и недоступные награды · {}",
                        if self.disabled_open { "▾" } else { "▸" },
                        disabled_visible.len()
                    );
                    let row = ui
                        .add(
                            egui::Label::new(RichText::new(label).size(13.2).color(TEXT_DIM))
                                .sense(Sense::click()),
                        )
                        .on_hover_text("Развернуть или свернуть");
                    if row.clicked() {
                        toggle_disabled = true;
                    }
                    if self.disabled_open {
                        ui.add_space(8.0);
                        egui::ScrollArea::vertical()
                            .id_source("disabled-rewards")
                            .max_height(260.0)
                            .auto_shrink([false, true])
                            .show(ui, |ui| {
                                if grid_view {
                                    let columns = if ui.available_width() >= 820.0 { 3 } else { 2 };
                                    actions.extend(draw_reward_grid(
                                        ui,
                                        &disabled_visible,
                                        &bindings,
                                        &playing,
                                        &cache,
                                        columns,
                                    ));
                                } else {
                                    for reward in &disabled_visible {
                                        let binding = bindings
                                            .iter()
                                            .find(|binding| binding.reward_id == reward.id);
                                        let instances = playing
                                            .iter()
                                            .filter(|id| id.as_str() == reward.id.as_str())
                                            .count();
                                        if let Some(action) =
                                            reward_card(ui, reward, binding, instances, &cache)
                                        {
                                            actions.push(action);
                                        }
                                        ui.add_space(8.0);
                                    }
                                }
                            });
                    }
                }
            }

            // Привязки, для которых награды больше нет на Twitch.
            if loaded.is_some() {
                let orphans: Vec<_> = bindings
                    .iter()
                    .filter(|b| !rewards.iter().any(|r| r.id == b.reward_id))
                    .collect();
                if !orphans.is_empty() {
                    ui.add_space(8.0);
                    ui.label(
                        RichText::new("Привязки без награды на Twitch")
                            .size(13.2)
                            .color(TEXT_DIM),
                    );
                    ui.add_space(6.0);
                    for binding in orphans {
                        if let Some(action) = orphan_reward_card(ui, binding) {
                            actions.push(action);
                        }
                        ui.add_space(8.0);
                    }
                }
            }
        }

        // ---- Реакция на действия ----
        if stop_all {
            if let Err(err) = self.engine.stop_all() {
                self.notify(err, ToastKind::Error);
            }
            self.touch();
        }
        if refresh_requested {
            self.fetch_reward_list();
        }
        if create_requested {
            self.open_create_reward();
        }
        if go_settings {
            self.tab = Tab::Settings;
            self.touch();
        }
        if go_log {
            self.tab = Tab::Log;
            self.logs = self.logger.entries();
            self.log_refresh_at = Instant::now() + Duration::from_millis(800);
            self.touch();
        }
        if view_changed {
            self.settings.grid_view = grid_view;
            self.mark_dirty();
            self.touch();
        }
        if new_filter != filter {
            self.reward_filter = new_filter;
            self.touch();
        }
        if reset_filters {
            self.search.clear();
            self.reward_filter = RewardFilter::All;
            self.touch();
        }
        if toggle_disabled {
            self.disabled_open = !self.disabled_open;
            self.touch();
        }
        if open_panel {
            let _ = webbrowser::open(DASHBOARD_URL);
        }
        for action in actions {
            self.apply_reward_action(action);
        }
    }

'''

start_marker = "    fn rewards_tab(&mut self, ui: &mut egui::Ui) {"
end_marker = "    fn apply_reward_action(&mut self, action: RewardUiAction) {"
start = src.index(start_marker)
end = src.index(end_marker)
src = src[:start] + NEW_REWARDS + src[end:]
P.write_text(src, encoding="utf-8")
print("rewards_tab replaced, new length:", len(src))
