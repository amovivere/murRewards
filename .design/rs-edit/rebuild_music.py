# -*- coding: utf-8 -*-
"""Вкладка «Музыка» — приведена к макету: шапка/плеер/очередь/низ."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")


def sub(old: str, new: str) -> None:
    global s
    assert old in s, "NOT FOUND: " + old[:110]
    s = s.replace(old, new, 1)


# --- поле для модального окна «Награда и цена» ---
sub("""    /// Поле ручной ссылки на вкладке «Музыка».
    music_manual_input: String,
""",
"""    /// Поле ручной ссылки на вкладке «Музыка».
    music_manual_input: String,
    /// Открыто окно «Награда и цена» на вкладке «Музыка».
    music_price_open: bool,
""")
sub("""            music_manual_input: String::new(),
            demo,
""",
"""            music_manual_input: String::new(),
            music_price_open: false,
            demo,
""")

# --- окна вызываются в update ---
sub("""        self.reward_editor_window(ctx);
        self.reward_delete_window(ctx);
        self.confirm_dialog_window(ctx);
""",
"""        self.reward_editor_window(ctx);
        self.reward_delete_window(ctx);
        self.confirm_dialog_window(ctx);
        self.music_price_window(ctx);
        self.music_settings_window(ctx);
""")

MUSIC_TAB = r'''    fn music_tab(&mut self, ui: &mut egui::Ui) {
        let snapshot = self.music_snapshot.clone();
        let connected =
            self.settings.twitch.is_connected() || self.twitch_state == TwitchState::Connected;
        let listening = self.eventsub_state == EventSubState::Listening;
        let reward_ok = self.settings.music.has_reward()
            && self
                .remote_rewards
                .iter()
                .any(|reward| reward.id == self.settings.music.reward_id);
        let ytdlp_ok = snapshot.ytdlp_version.is_some();
        let enabled = self.settings.music.enabled;
        let ready = enabled && connected && listening && reward_ok && ytdlp_ok;

        let (status_label, status_color) = if !enabled {
            ("Приём выключен", TEXT_DIM)
        } else if !connected {
            ("Нужен Twitch", WARN)
        } else if !listening {
            ("Награды не слушаются", WARN)
        } else if !reward_ok {
            ("Не выбрана награда", WARN)
        } else if !ytdlp_ok {
            ("Нет yt-dlp", DANGER)
        } else {
            ("Принимаем заявки", SUCCESS)
        };
        let mut missing: Vec<&str> = Vec::new();
        if !connected {
            missing.push("Twitch не подключён");
        } else if !listening {
            missing.push("активации наград не слушаются");
        }
        if !reward_ok {
            missing.push("не выбрана награда");
        }
        if !ytdlp_ok {
            missing.push("не найден yt-dlp");
        }
        if !enabled {
            missing.push("приём заявок выключен");
        }

        let mut go_settings = false;
        let mut go_rewards = false;
        let mut open_obs = false;
        let mut open_price = false;
        let mut open_music_settings = false;
        let mut open_log = false;
        let mut recheck = false;
        let mut copy_overlay = false;
        let mut show_overlay = false;
        let mut open_overlay = false;
        let mut clear_queue = false;
        let mut replay: Option<String> = None;
        let mut remove: Option<String> = None;
        let mut move_up: Option<String> = None;
        let mut add_manual = false;
        let mut toggle_enabled = false;

        // ---- Шапка: заголовок и действия справа ----
        ui.horizontal(|ui| {
            ui.vertical(|ui| {
                ui.label(
                    RichText::new("Музыка")
                        .family(semibold())
                        .size(36.0)
                        .color(TEXT),
                );
                ui.label(
                    RichText::new("Треки по заявке из чата: зритель присылает ссылку на YouTube")
                        .size(15.0)
                        .color(TEXT_DIM),
                );
            });
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                let pill = pill_button(ui, status_label, status_color);
                let pill = pill.on_hover_text("Нажмите, чтобы включить или выключить приём заявок");
                if pill.clicked() {
                    toggle_enabled = true;
                }
                ui.add_space(4.0);
                if secondary_button(ui, "Оверлей OBS").clicked() {
                    open_obs = true;
                }
                ui.add_space(4.0);
                ui.scope(|ui| {
                    ui.spacing_mut().button_padding = Vec2::new(8.0, 7.0);
                    ui.menu_button(
                        RichText::new("···").size(16.0).color(TEXT_DIM),
                        |ui| {
                            ui.set_min_width(210.0);
                            if ui.button("Награда и цена").clicked() {
                                open_price = true;
                                ui.close_menu();
                            }
                            if ui.button("Настройки музыки").clicked() {
                                open_music_settings = true;
                                ui.close_menu();
                            }
                            if ui.button("Открыть журнал").clicked() {
                                open_log = true;
                                ui.close_menu();
                            }
                        },
                    );
                });
            });
        });

        // ---- Строка готовности: награда + yt-dlp ----
        ui.add_space(10.0);
        ui.horizontal_wrapped(|ui| {
            let reward_text = if reward_ok {
                format!(
                    "Награда: {} · {} {}",
                    self.settings.music.reward_title, self.settings.music.reward_cost,
                    util::plural_ru(
                        self.settings.music.reward_cost as usize,
                        "балл",
                        "балла",
                        "баллов"
                    )
                )
            } else {
                "Награда не выбрана".to_string()
            };
            let pill_color = if reward_ok { TEXT } else { WARN };
            if pill_button(ui, &reward_text, pill_color)
                .on_hover_text("Награда, из которой приходят заявки")
                .clicked()
            {
                open_price = true;
            }
            if ghost_button(ui, "Изменить", TEXT_DIM).clicked() {
                open_price = true;
            }
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                if let Some(version) = snapshot.ytdlp_version.as_ref() {
                    ui.add(
                        egui::Label::new(
                            RichText::new(format!("yt-dlp {version}"))
                                .size(12.2)
                                .color(TEXT_DIM),
                        ),
                    )
                    .on_hover_text("Найден и готов к загрузке треков");
                } else {
                    ui.add(egui::Label::new(
                        RichText::new("yt-dlp не найден").size(12.2).color(DANGER),
                    ));
                    if secondary_button(ui, "Проверить").clicked() {
                        recheck = true;
                    }
                }
            });
        });

        // ---- Если что-то не готово — короткая плашка ----
        if !ready {
            ui.add_space(8.0);
            egui::Frame::none()
                .fill(with_alpha(WARN, 14))
                .stroke(Stroke::new(1.0_f32, with_alpha(WARN, 60)))
                .rounding(Rounding::same(10.0))
                .inner_margin(egui::Margin::symmetric(12.0, 8.0))
                .show(ui, |ui| {
                    ui.horizontal_wrapped(|ui| {
                        ui.label(RichText::new("●").size(10.8).color(WARN));
                        ui.add(
                            egui::Label::new(
                                RichText::new(format!(
                                    "Заявки пока не принимаются: {}.",
                                    missing.join(", ")
                                ))
                                .size(13.2)
                                .color(TEXT),
                            )
                            .wrap(),
                        );
                        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                            if secondary_button(ui, "Настроить").clicked() {
                                if !connected || !listening {
                                    go_settings = true;
                                } else if !reward_ok {
                                    go_rewards = true;
                                } else {
                                    recheck = true;
                                }
                            }
                        });
                    });
                });
        }

        ui.add_space(10.0);
        self.music_player_card(ui, &snapshot);
        ui.add_space(10.0);

        // ---- Очередь ----
        let pending: Vec<music::QueueItem> = snapshot
            .items
            .iter()
            .filter(|item| !item.state.is_final())
            .cloned()
            .collect();
        let finished: Vec<music::QueueItem> = snapshot
            .items
            .iter()
            .filter(|item| item.state.is_final())
            .rev()
            .take(1)
            .cloned()
            .collect();
        let max_queue = self.settings.music.max_queue;
        let current_id = snapshot
            .current
            .as_ref()
            .map(|item| item.redemption_id.clone());

        card_frame().show(ui, |ui| {
            ui.set_width(ui.available_width());

            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(format!("Очередь · {} из {}", pending.len(), max_queue))
                        .family(semibold())
                        .size(15.4)
                        .color(TEXT),
                );
                let playing = pending
                    .iter()
                    .filter(|item| item.state == ItemState::Playing)
                    .count();
                let loading = pending
                    .iter()
                    .filter(|item| item.state == ItemState::Loading)
                    .count();
                if playing > 0 {
                    ui.add_space(4.0);
                    queue_state_chip(ui, ItemState::Playing);
                    let _ = playing;
                }
                if loading > 0 {
                    ui.add_space(2.0);
                    queue_state_chip(ui, ItemState::Loading);
                }
                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    if !pending.is_empty()
                        && ghost_button(ui, "Очистить", with_alpha(DANGER, 220)).clicked()
                    {
                        clear_queue = true;
                    }
                });
            });

            ui.add_space(6.0);

            if pending.is_empty() {
                egui::Frame::none()
                    .fill(with_alpha(Color32::WHITE, 3))
                    .rounding(Rounding::same(10.0))
                    .inner_margin(egui::Margin::symmetric(12.0, 10.0))
                    .show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        hint(
                            ui,
                            "Очередь пуста. Ссылка из активации награды появится здесь.",
                        );
                    });
            }

            for (index, item) in pending.iter().enumerate() {
                let active = current_id.as_deref() == Some(item.redemption_id.as_str());
                egui::Frame::none()
                    .fill(if active {
                        with_alpha(SUCCESS, 16)
                    } else {
                        Color32::TRANSPARENT
                    })
                    .rounding(Rounding::same(10.0))
                    .inner_margin(egui::Margin::symmetric(10.0, 5.0))
                    .show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        ui.horizontal(|ui| {
                            let (bar_rect, _) =
                                ui.allocate_exact_size(Vec2::new(3.0, 26.0), Sense::hover());
                            if active {
                                ui.painter().rect_filled(
                                    bar_rect,
                                    Rounding::same(2.0),
                                    SUCCESS,
                                );
                            }
                            ui.label(
                                RichText::new(format!("{}.", index + 1))
                                    .size(12.4)
                                    .color(TEXT_DIM),
                            );
                            ui.vertical(|ui| {
                                ui.add(
                                    egui::Label::new(
                                        RichText::new(item.label()).size(13.8).color(TEXT),
                                    )
                                    .truncate(),
                                );
                                let mut meta = format!("@{}", item.user_login);
                                if item.duration_sec > 0 {
                                    meta.push_str(&format!(
                                        " · {}",
                                        music::ytdlp::format_duration(item.duration_sec)
                                    ));
                                }
                                ui.label(RichText::new(meta).size(11.2).color(TEXT_DIM));
                            });
                            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                                if item.state != ItemState::Playing {
                                    if icon_button(ui, UiIcon::X, "Убрать из очереди", 26.0)
                                        .clicked()
                                    {
                                        remove = Some(item.redemption_id.clone());
                                    }
                                    if index > 0
                                        && icon_button(
                                            ui,
                                            UiIcon::ChevronRight,
                                            "Поднять выше",
                                            26.0,
                                        )
                                        .clicked()
                                    {
                                        move_up = Some(item.redemption_id.clone());
                                    }
                                }
                                let chip = queue_state_chip(ui, item.state);
                                if let Some(error) = item.error.as_ref() {
                                    chip.on_hover_text(error);
                                }
                            });
                        });
                    });
            }

            // Ручная заявка.
            ui.add_space(6.0);
            ui.horizontal(|ui| {
                let width = (ui.available_width() - 128.0).clamp(220.0, 640.0);
                egui::Frame::none()
                    .fill(CARD)
                    .stroke(Stroke::new(1.0_f32, BORDER))
                    .rounding(Rounding::same(17.0))
                    .inner_margin(egui::Margin::symmetric(12.0, 6.0))
                    .show(ui, |ui| {
                        let response = ui.add(
                            egui::TextEdit::singleline(&mut self.music_manual_input)
                                .frame(false)
                                .hint_text(
                                    "Вставьте ссылку YouTube и нажмите Enter — трек встанет в очередь",
                                )
                                .desired_width(width)
                                .font(FontId::proportional(13.2)),
                        );
                        if response.lost_focus()
                            && ui.input(|input| input.key_pressed(egui::Key::Enter))
                        {
                            add_manual = true;
                        }
                    });
                ui.add_space(4.0);
                if secondary_button(ui, "В очередь").clicked()
                    && !self.music_manual_input.trim().is_empty()
                {
                    add_manual = true;
                }
            });
            hint(
                ui,
                "Ручная очередь не тратит баллы зрителей — удобно для проверки.",
            );

            if let Some(item) = finished.first() {
                ui.add_space(4.0);
                ui.horizontal(|ui| {
                    ui.label(RichText::new("Сыграно:").size(11.6).color(TEXT_DIM));
                    queue_state_chip(ui, item.state);
                    ui.label(
                        RichText::new(item.label())
                            .size(12.2)
                            .color(with_alpha(TEXT_DIM, 210)),
                    );
                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        if icon_button(ui, UiIcon::Refresh, "Поставить снова", 22.0).clicked() {
                            replay = Some(item.redemption_id.clone());
                        }
                        if item.duration_sec > 0 {
                            ui.label(
                                RichText::new(music::ytdlp::format_duration(item.duration_sec))
                                    .size(11.0)
                                    .color(with_alpha(TEXT_DIM, 160)),
                            );
                        }
                    });
                });
            }
        });

        ui.add_space(10.0);

        // ---- Нижний ряд: OBS и состояние ----
        ui.horizontal_top(|ui| {
            let total = ui.available_width();
            let obs_width = (total * 0.55).floor();
            let state_width = total - obs_width - 10.0;

            ui.allocate_ui(Vec2::new(obs_width, 0.0), |ui| {
                card_frame().show(ui, |ui| {
                    ui.set_width(ui.available_width());
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new("OBS — строка «Сейчас играет»")
                                .family(semibold())
                                .size(14.4)
                                .color(TEXT),
                        );
                        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                            if ghost_button(ui, "Настроить", TEXT_DIM).clicked() {
                                open_obs = true;
                            }
                        });
                    });
                    ui.add_space(4.0);
                    ui.horizontal_wrapped(|ui| {
                        ui.label(
                            RichText::new("http://127.0.0.1:8770/overlay")
                                .size(11.4)
                                .monospace()
                                .color(TEXT_DIM),
                        );
                        if icon_button(ui, UiIcon::Folder, "Скопировать ссылку", 24.0).clicked() {
                            copy_overlay = true;
                        }
                        let show = ui
                            .add_enabled_ui(snapshot.current.is_some(), |ui| {
                                secondary_button(ui, "Показать сейчас")
                            })
                            .inner;
                        if show.clicked() {
                            show_overlay = true;
                        }
                        if ghost_button(ui, "Браузер", TEXT_DIM).clicked() {
                            open_overlay = true;
                        }
                    });
                    ui.add_space(6.0);
                    let preview = snapshot.current.as_ref();
                    egui::Frame::none()
                        .fill(with_alpha(Color32::WHITE, 3))
                        .rounding(Rounding::same(10.0))
                        .inner_margin(egui::Margin::symmetric(12.0, 7.0))
                        .show(ui, |ui| {
                            ui.set_width(ui.available_width());
                            ui.horizontal(|ui| {
                                for (index, height) in [7.0_f32, 12.0, 16.0, 9.0].iter().enumerate()
                                {
                                    let (rect, _) = ui.allocate_exact_size(
                                        Vec2::new(3.0, 16.0),
                                        Sense::hover(),
                                    );
                                    let bar = egui::Rect::from_center_size(
                                        egui::pos2(rect.center().x, rect.center().y),
                                        Vec2::new(3.0, *height),
                                    );
                                    let _ = index;
                                    ui.painter().rect_filled(
                                        bar,
                                        Rounding::same(2.0),
                                        with_alpha(SUCCESS, 220),
                                    );
                                }
                                ui.label(
                                    RichText::new(
                                        preview
                                            .map(|item| item.label())
                                            .unwrap_or_else(|| "ДИНАСТИЯ — Земляк".to_string()),
                                    )
                                    .size(12.0)
                                    .color(TEXT),
                                );
                                if let Some(item) = preview {
                                    ui.label(
                                        RichText::new(format!("· заказал @{}", item.user_login))
                                            .size(11.0)
                                            .color(TEXT_DIM),
                                    );
                                }
                            });
                        });
                });
            });

            ui.add_space(10.0);

            ui.allocate_ui(Vec2::new(state_width, 0.0), |ui| {
                card_frame().show(ui, |ui| {
                    ui.set_width(ui.available_width());
                    ui.label(
                        RichText::new("Состояние")
                            .family(semibold())
                            .size(14.4)
                            .color(TEXT),
                    );
                    ui.add_space(4.0);
                    let row = |ui: &mut egui::Ui, ok: bool, text: String| {
                        ui.horizontal(|ui| {
                            ui.label(
                                RichText::new(if ok { "✓" } else { "•" })
                                    .size(13.2)
                                    .color(if ok { SUCCESS } else { WARN }),
                            );
                            ui.label(RichText::new(text).size(11.8).color(TEXT));
                        });
                    };
                    match snapshot.ytdlp_version.as_ref() {
                        Some(version) => row(ui, true, format!("yt-dlp {version} — готов")),
                        None => row(ui, false, "yt-dlp не найден".to_string()),
                    }
                    row(
                        ui,
                        connected && !self.settings.twitch.login.is_empty(),
                        if connected {
                            "Чат: !трек работает".to_string()
                        } else {
                            "Чат: нужен Twitch".to_string()
                        },
                    );
                    row(ui, true, "Порт оверлея 8770 — свободен".to_string());
                    if snapshot.ytdlp_version.is_none() {
                        ui.add_space(4.0);
                        if secondary_button(ui, "Проверить снова").clicked() {
                            recheck = true;
                        }
                    }
                });
            });
        });

        // ---- Действия ----
        if toggle_enabled {
            self.settings.music.enabled = !self.settings.music.enabled;
            self.music.set_paused(!self.settings.music.enabled);
            self.apply_music_config();
            self.mark_dirty();
            self.notify(
                if self.settings.music.enabled {
                    "Приём заявок включён."
                } else {
                    "Приём заявок выключен."
                },
                ToastKind::Info,
            );
            self.touch();
        }
        if copy_overlay {
            ui.output_mut(|output| {
                output.copied_text = "http://127.0.0.1:8770/overlay".to_string()
            });
            self.notify("Ссылка на оверлей скопирована", ToastKind::Success);
        }
        if show_overlay {
            self.music.show_overlay();
            self.notify("Строка «Сейчас играет» показана в оверлее", ToastKind::Info);
        }
        if open_overlay {
            let _ = webbrowser::open("http://127.0.0.1:8770/overlay");
        }
        if recheck {
            self.music.recheck();
            self.notify("Ищу yt-dlp заново", ToastKind::Info);
        }
        if open_obs {
            self.obs_window_open = true;
            self.touch();
        }
        if open_price {
            self.music_settings_open = false;
            self.music_price_open = true;
            self.touch();
        }
        if open_music_settings {
            self.music_price_open = false;
            self.music_settings_open = true;
            self.touch();
        }
        if open_log {
            self.tab = Tab::Log;
            self.logs = self.logger.entries();
            self.log_refresh_at = Instant::now() + Duration::from_millis(800);
            self.touch();
        }
        if go_settings {
            self.tab = Tab::Settings;
            self.touch();
        }
        if go_rewards {
            self.tab = Tab::Rewards;
            self.reward_filter = RewardFilter::All;
            self.touch();
        }
        if add_manual && !self.music_manual_input.trim().is_empty() {
            let url = self.music_manual_input.trim().to_string();
            self.music_manual_input.clear();
            self.music.add_manual(&url);
            self.notify("Проверяем ссылку и ставим трек в очередь…", ToastKind::Info);
            self.touch();
        }
        if clear_queue {
            self.confirm = Some(ConfirmDialog {
                title: "Очистить очередь?".to_string(),
                text: "Все заявки, которые ждут очереди, будут сняты, а баллы зрителей вернутся. Текущий трек продолжит играть.".to_string(),
                confirm_label: "Очистить".to_string(),
                action: ConfirmAction::ClearMusicQueue,
                danger: true,
            });
            self.touch();
        }
        if let Some(id) = move_up {
            self.music.move_up(&id);
            self.touch();
        }
        if let Some(id) = remove {
            self.music.remove_item(&id);
            self.touch();
        }
        if let Some(id) = replay {
            self.music.replay(&id);
            self.touch();
        }
    }

    /// Окно «Награда и цена» на вкладке «Музыка».
    fn music_price_window(&mut self, ctx: &egui::Context) {
        if !self.music_price_open {
            return;
        }
        modal_scrim(ctx);
        let mut open = true;
        let mut close = false;
        let mut picked: Option<String> = None;

        let rewards: Vec<(String, String)> = self
            .remote_rewards
            .iter()
            .map(|reward| {
                (
                    reward.id.clone(),
                    format!(
                        "{} · {} {}",
                        reward.title,
                        reward.cost,
                        util::plural_ru(
                            reward.cost.max(0) as usize,
                            "балл",
                            "балла",
                            "баллов"
                        )
                    ),
                )
            })
            .collect();
        let current_label = rewards
            .iter()
            .find(|(id, _)| id == &self.settings.music.reward_id)
            .map(|(_, label)| label.clone())
            .unwrap_or_else(|| "Награда не выбрана".to_string());

        egui::Window::new("music-price")
            .id(egui::Id::new("music-price-window"))
            .title_bar(false)
            .collapsible(false)
            .resizable(false)
            .movable(false)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .min_width(500.0)
            .max_width(500.0)
            .frame(
                egui::Frame::window(&ctx.style())
                    .fill(PANEL)
                    .rounding(Rounding::same(22.0))
                    .stroke(Stroke::new(1.0_f32, BORDER))
                    .inner_margin(egui::Margin::symmetric(26.0, 22.0)),
            )
            .open(&mut open)
            .show(ctx, |ui| {
                ui.set_width(ui.available_width());
                ui.label(
                    RichText::new("Награда и цена")
                        .family(semibold())
                        .size(21.6)
                        .color(TEXT),
                );
                hint(
                    ui,
                    "Из какой награды приходят заявки и сколько баллов платит зритель.",
                );
                ui.add_space(14.0);

                ui.label(RichText::new("НАГРАДА").size(11.6).color(TEXT_DIM));
                ui.add_space(4.0);
                egui::ComboBox::from_id_salt("music-reward-modal")
                    .width(440.0)
                    .selected_text(current_label.clone())
                    .show_ui(ui, |ui| {
                        for (id, label) in &rewards {
                            let selected = id == &self.settings.music.reward_id;
                            if ui.selectable_label(selected, label).clicked() {
                                picked = Some(id.clone());
                            }
                        }
                    });
                if rewards.is_empty() {
                    hint(ui, "Список наград пуст — обновите его на вкладке «Награды».");
                }

                ui.add_space(12.0);
                ui.horizontal(|ui| {
                    ui.label(RichText::new("ЦЕНА").size(11.6).color(TEXT_DIM));
                    ui.add_space(8.0);
                    ui.add(
                        egui::TextEdit::singleline(&mut self.music_cost_input)
                            .desired_width(90.0),
                    );
                    ui.label(RichText::new("баллов").size(12.4).color(TEXT_DIM));
                });
                hint(
                    ui,
                    "«Применить цену» меняет награду на Twitch: зритель платит её за заявку.",
                );

                ui.add_space(16.0);
                ui.horizontal(|ui| {
                    if secondary_button(ui, "Отмена").clicked() {
                        close = true;
                    }
                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        if accent_button(ui, "Применить цену").clicked() {
                            self.apply_music_price();
                            close = true;
                        }
                    });
                });
            });

        if let Some(id) = picked {
            self.set_music_reward(&id);
        }
        if close
            || !open
            || ctx.input(|input| input.key_pressed(egui::Key::Escape))
        {
            self.music_price_open = false;
            self.touch();
        }
    }

    /// Окно «Настройки музыки»: лимиты, поведение плеера, восстановление очереди.
    fn music_settings_window(&mut self, ctx: &egui::Context) {
        if !self.music_settings_open {
            return;
        }
        modal_scrim(ctx);
        let mut open = true;
        let mut close = false;
        let mut dirty = false;

        egui::Window::new("music-settings")
            .id(egui::Id::new("music-settings-window"))
            .title_bar(false)
            .collapsible(false)
            .resizable(false)
            .movable(false)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .min_width(480.0)
            .max_width(480.0)
            .frame(
                egui::Frame::window(&ctx.style())
                    .fill(PANEL)
                    .rounding(Rounding::same(22.0))
                    .stroke(Stroke::new(1.0_f32, BORDER))
                    .inner_margin(egui::Margin::symmetric(26.0, 22.0)),
            )
            .open(&mut open)
            .show(ctx, |ui| {
                ui.set_width(ui.available_width());
                ui.label(
                    RichText::new("Настройки музыки")
                        .family(semibold())
                        .size(21.6)
                        .color(TEXT),
                );
                ui.add_space(12.0);

                ui.horizontal(|ui| {
                    ui.label(RichText::new("Заявок в очереди").size(13.6).color(TEXT_DIM));
                    ui.add_space(8.0);
                    let mut value = self.settings.music.max_queue as u32;
                    if ui
                        .add(egui::DragValue::new(&mut value).range(1..=50).speed(1.0))
                        .changed()
                    {
                        self.settings.music.max_queue = value as usize;
                        dirty = true;
                    }
                });
                ui.add_space(6.0);
                ui.horizontal(|ui| {
                    ui.label(RichText::new("Максимум, минут").size(13.6).color(TEXT_DIM));
                    ui.add_space(8.0);
                    let mut minutes = (self.settings.music.max_duration_sec / 60).max(1) as u32;
                    if ui
                        .add(egui::DragValue::new(&mut minutes).range(1..=120).speed(1.0))
                        .changed()
                    {
                        self.settings.music.max_duration_sec = minutes as u64 * 60;
                        dirty = true;
                    }
                });
                ui.add_space(10.0);
                let mut pause_yandex = self.settings.music.pause_yandex;
                if toggle(ui, &mut pause_yandex) {
                    self.settings.music.pause_yandex = pause_yandex;
                    dirty = true;
                }
                ui.label(
                    RichText::new("Ставить Яндекс Музыку на паузу и возвращать после")
                        .size(13.0)
                        .color(TEXT),
                );
                ui.add_space(6.0);
                let mut restore = self.settings.music.restore_queue;
                if toggle(ui, &mut restore) {
                    self.settings.music.restore_queue = restore;
                    dirty = true;
                }
                ui.label(
                    RichText::new("Восстанавливать очередь после перезапуска")
                        .size(13.0)
                        .color(TEXT),
                );
                ui.add_space(6.0);
                hint(
                    ui,
                    "Длительность и лимит применяются сразу. Очередь хранится в queue.json рядом с настройками.",
                );

                ui.add_space(16.0);
                ui.horizontal(|ui| {
                    if secondary_button(ui, "Закрыть").clicked() {
                        close = true;
                    }
                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        if secondary_button(ui, "Оверлей OBS").clicked() {
                            self.obs_window_open = true;
                        }
                    });
                });
            });

        if dirty {
            self.apply_music_config();
            self.mark_dirty();
            self.touch();
        }
        if close || !open || ctx.input(|input| input.key_pressed(egui::Key::Escape)) {
            self.music_settings_open = false;
            self.touch();
        }
    }

'''

# Заменяем старую music_tab (до описания obs_window).
start = s.index("    fn music_tab(&mut self, ui: &mut egui::Ui) {")
end = s.index("    /// Окно настроек оверлея для OBS: ссылка и параметры показа.")
s = s[:start] + MUSIC_TAB + s[end:]

# Игрок: компактнее и по макету.
PLAYER_START = "    /// Карточка плеера: обложка, состояние, прогресс, кнопки, громкость.\n    fn music_player_card("
PLAYER_END = "    fn apply_music_price("
new_player = r'''    /// Карточка плеера. Раскладка повторяет макет: обложка, трек, прогресс,
    /// кнопки — слева; громкость и следующий трек — в правой колонке.
    fn music_player_card(&mut self, ui: &mut egui::Ui, snapshot: &music::Snapshot) {
        let mut restart = false;
        let mut toggle_pause = false;
        let mut skip = false;
        let current = snapshot.current.as_ref();
        let playing = current.is_some();
        let loading = current
            .map(|item| matches!(item.state, ItemState::Loading))
            .unwrap_or(false);

        card_frame().show(ui, |ui| {
            ui.set_width(ui.available_width());
            ui.horizontal_top(|ui| {
                let right_width = 210.0;
                let left_width = (ui.available_width() - right_width - 18.0).max(300.0);

                ui.allocate_ui(Vec2::new(left_width, 0.0), |ui| {
                    ui.horizontal(|ui| {
                        let (art_rect, _) =
                            ui.allocate_exact_size(Vec2::splat(104.0), Sense::hover());
                        ui.painter().rect_filled(
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
                        ui.add_space(10.0);
                        ui.vertical(|ui| {
                            if playing {
                                let label = if loading {
                                    "ЗАГРУЖАЕМ ТРЕК"
                                } else if snapshot.player.paused {
                                    "ПАУЗА"
                                } else {
                                    "СЕЙЧАС ИГРАЕТ"
                                };
                                ui.label(
                                    RichText::new(label)
                                        .size(10.6)
                                        .color(if loading { WARN } else { SUCCESS }),
                                );
                                ui.label(
                                    RichText::new(current.map(|i| i.label()).unwrap_or_default())
                                        .family(semibold())
                                        .size(20.0)
                                        .color(TEXT),
                                );
                                let mut meta = String::new();
                                if let Some(item) = current {
                                    if !item.user_login.trim().is_empty()
                                        && item.user_login != "manual"
                                    {
                                        meta.push_str(&format!("заказал @{}", item.user_login));
                                    }
                                    if !item.channel.trim().is_empty() {
                                        if !meta.is_empty() {
                                            meta.push_str(" · ");
                                        }
                                        meta.push_str(&item.channel);
                                    }
                                    if item.duration_sec > 0 {
                                        meta.push_str(&format!(
                                            " · {}",
                                            music::ytdlp::format_duration(item.duration_sec)
                                        ));
                                    }
                                }
                                if !meta.is_empty() {
                                    ui.label(RichText::new(meta).size(12.4).color(TEXT_DIM));
                                }
                            } else {
                                ui.label(
                                    RichText::new("Ничего не играет")
                                        .family(semibold())
                                        .size(20.0)
                                        .color(TEXT),
                                );
                                hint(
                                    ui,
                                    if snapshot.ytdlp_version.is_some() {
                                        "Активируйте награду на канале — трек встанет в очередь"
                                    } else {
                                        "yt-dlp не найден — заявки пока не принимаются"
                                    },
                                );
                            }
                        });
                        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
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
                    });

                    ui.add_space(8.0);
                    let total = if playing { snapshot.player.duration_sec } else { 0 };
                    let position = if playing {
                        snapshot.player.position_sec.min(total.max(1))
                    } else {
                        0
                    };
                    if total > 0 {
                        if let Some(target) = music_progress(ui, position, total) {
                            self.music.seek(target);
                            self.touch();
                        }
                    } else {
                        let (rect, _) = ui.allocate_exact_size(
                            Vec2::new(ui.available_width(), 20.0),
                            Sense::hover(),
                        );
                        ui.painter().rect_filled(
                            egui::Rect::from_center_size(
                                rect.center(),
                                Vec2::new(rect.width(), 3.0),
                            ),
                            Rounding::same(2.0),
                            with_alpha(TEXT_DIM, 50),
                        );
                    }
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new(music::ytdlp::format_duration(position))
                                .size(11.8)
                                .color(TEXT_DIM),
                        );
                        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                            ui.label(
                                RichText::new(music::ytdlp::format_duration(total))
                                    .size(11.8)
                                    .color(TEXT_DIM),
                            );
                        });
                    });

                    ui.add_space(6.0);
                    ui.horizontal(|ui| {
                        ui.spacing_mut().item_spacing.x = 8.0;
                        let buttons_width = 3.0 * 38.0 + 2.0 * 8.0;
                        let free = (ui.available_width() - buttons_width).max(0.0);
                        ui.add_space(free / 2.0);
                        let restart_clicked = ui
                            .add_enabled_ui(playing, |ui| {
                                player_icon_button(ui, PlayerIcon::Restart)
                            })
                            .inner
                            .on_hover_text("Сначала")
                            .clicked();
                        if restart_clicked {
                            restart = true;
                        }
                        let icon = if snapshot.player.paused {
                            PlayerIcon::Play
                        } else {
                            PlayerIcon::Pause
                        };
                        let pause_clicked = ui
                            .add_enabled_ui(playing, |ui| player_icon_button(ui, icon))
                            .inner
                            .on_hover_text(if snapshot.player.paused {
                                "Продолжить"
                            } else {
                                "Пауза"
                            })
                            .clicked();
                        if pause_clicked {
                            toggle_pause = true;
                        }
                        let skip_clicked = ui
                            .add_enabled_ui(playing, |ui| player_icon_button(ui, PlayerIcon::Skip))
                            .inner
                            .on_hover_text("Пропустить трек")
                            .clicked();
                        if skip_clicked {
                            skip = true;
                        }
                    });
                });

                // Правая колонка с громкостью.
                ui.add_space(14.0);
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
                    ui.label(
                        RichText::new("Громкость музыки")
                            .size(11.8)
                            .color(TEXT_DIM),
                    );
                    ui.add_space(4.0);
                    let mut volume = self.settings.music.music_volume;
                    let changed = ui
                        .add(
                            egui::Slider::new(&mut volume, 0.0..=1.0)
                                .show_value(false)
                                .trailing_fill(true),
                        )
                        .changed();
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new(util::format_volume(
                                self.settings.music.music_volume as f32,
                            ))
                            .size(12.0)
                            .color(TEXT),
                        );
                    });
                    if changed {
                        self.settings.music.music_volume = volume;
                        self.music.set_volume(volume as f32);
                        self.mark_dirty();
                    }
                    ui.add_space(4.0);
                    hint(ui, "Не меняет громкость Windows — только очередь.");
                    ui.add_space(6.0);
                    if let Some(item) = current {
                        let _ = item;
                    }
                    if let Some(next) = snapshot
                        .items
                        .iter()
                        .find(|item| item.state == ItemState::Queued)
                    {
                        ui.label(
                            RichText::new(format!("Следующий: {}", next.label()))
                                .size(11.2)
                                .color(TEXT_DIM)
                                .truncate(),
                        );
                    } else {
                        ui.label(RichText::new("Следующий: —").size(11.2).color(TEXT_DIM));
                    }
                });
            });

            if let Some(error) = snapshot.player.error.as_ref() {
                ui.add_space(6.0);
                paragraph(ui, error, DANGER, 12.6);
            }
        });

        if restart {
            self.music.seek(0);
            self.touch();
        }
        if toggle_pause {
            self.music.set_paused(!snapshot.player.paused);
            self.touch();
        }
        if skip {
            self.music.skip();
            self.touch();
        }
    }

'''
start = s.index(PLAYER_START)
end = s.index(PLAYER_END)
s = s[:start] + new_player + s[end:]

P.write_text(s, encoding="utf-8")
print("music tab + player rebuilt, length", len(s))
