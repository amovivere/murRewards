# -*- coding: utf-8 -*-
"""Новая вкладка «Музыка»: честный статус, состояния очереди, ручная ссылка."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
src = P.read_text(encoding="utf-8")


def replace_between(text: str, start_marker: str, end_marker: str, new: str) -> str:
    start = text.index(start_marker)
    end = text.index(end_marker, start)
    return text[:start] + new + text[end:]


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
            ("Выключено", TEXT_DIM)
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

        let mut go_settings = false;
        let mut go_rewards = false;
        let mut open_obs = false;
        let mut recheck = false;
        let mut copy_overlay = false;
        let mut show_overlay = false;
        let mut open_overlay = false;
        let mut clear_queue = false;
        let mut replay: Option<String> = None;
        let mut remove: Option<String> = None;
        let mut move_up: Option<String> = None;
        let mut add_manual = false;

        // ---- Шапка ----
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
                if secondary_button(ui, "Оверлей OBS").clicked() {
                    open_obs = true;
                }
                ui.add_space(8.0);
                let mut accept = self.settings.music.enabled;
                if toggle(ui, &mut accept) {
                    self.settings.music.enabled = accept;
                    self.music.set_paused(!accept);
                    self.apply_music_config();
                    self.mark_dirty();
                    self.touch();
                }
                ui.label(
                    RichText::new("Принимать заявки")
                        .size(13.6)
                        .color(TEXT_DIM),
                );
                ui.add_space(10.0);
                let pill = pill_button(ui, status_label, status_color);
                pill.on_hover_text(if ready {
                    "Заявки принимаются: Twitch подключён, награда выбрана, yt-dlp найден."
                } else {
                    "Пока не всё готово — смотрите чек-лист ниже."
                });
            });
        });

        // ---- Чек-лист готовности ----
        if !ready {
            ui.add_space(10.0);
            section_card(ui, "Чтобы принимать заявки", |ui| {
                let rows: [(&str, bool, Option<(&str, usize)>); 4] = [
                    ("Twitch подключён", connected, Some(("Открыть настройки", 0))),
                    (
                        "Прослушиваем активации наград",
                        listening,
                        Some(("Открыть настройки", 0)),
                    ),
                    (
                        "Выбрана награда для музыки",
                        reward_ok,
                        Some(("Открыть «Награды»", 1)),
                    ),
                    ("Найден yt-dlp.exe", ytdlp_ok, Some(("Проверить снова", 2))),
                ];
                for (label, ok, action) in rows {
                    ui.horizontal(|ui| {
                        if ok {
                            ui.add(egui::Label::new(RichText::new("✓").size(15.0).color(SUCCESS)));
                        } else {
                            ui.add(egui::Label::new(RichText::new("•").size(15.0).color(WARN)));
                        }
                        ui.label(
                            RichText::new(label)
                                .size(13.8)
                                .color(if ok { TEXT_DIM } else { TEXT }),
                        );
                        if let Some((action_label, action_id)) = action {
                            if !ok {
                                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                                    if ui
                                        .add(
                                            egui::Label::new(
                                                RichText::new(action_label)
                                                    .size(12.6)
                                                    .color(TEXT_DIM),
                                            )
                                            .sense(Sense::click()),
                                        )
                                        .clicked()
                                    {
                                        match action_id {
                                            0 => go_settings = true,
                                            1 => go_rewards = true,
                                            _ => recheck = true,
                                        }
                                    }
                                });
                            }
                        }
                    });
                }
                if !enabled {
                    hint(ui, "Приём заявок выключен — включите его переключателем в шапке.");
                } else if !ytdlp_ok {
                    hint(
                        ui,
                        "Положите yt-dlp.exe рядом с программой (или в папку tools) и нажмите «Проверить снова».",
                    );
                }
            });
        }

        // ---- Строка с наградой и инструментами ----
        ui.add_space(10.0);
        ui.horizontal_wrapped(|ui| {
            let reward_text = if reward_ok {
                format!(
                    "Награда: {} · {} {}",
                    self.settings.music.reward_title,
                    self.settings.music.reward_cost,
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
            if pill_button(ui, &reward_text, if reward_ok { TEXT } else { WARN }).clicked() {
                go_rewards = true;
            }
            if !ytdlp_ok {
                ui.add_space(6.0);
                if secondary_button(ui, "Проверить yt-dlp").clicked() {
                    recheck = true;
                }
            } else if let Some(version) = snapshot.ytdlp_version.as_ref() {
                ui.add_space(6.0);
                ui.label(
                    RichText::new(format!("yt-dlp {version}"))
                        .size(12.2)
                        .color(with_alpha(TEXT_DIM, 200)),
                );
            }
            if let Some(prefetched) = snapshot.prefetched.as_ref() {
                ui.add_space(8.0);
                ui.label(
                    RichText::new(format!("следующий готов: {prefetched}"))
                        .size(11.8)
                        .color(TEXT_DIM),
                )
                .on_hover_text("Трек уже загружен в память — начнётся без задержки");
            }
        });

        ui.add_space(12.0);
        self.music_player_card(ui, &snapshot);
        ui.add_space(12.0);

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
            .take(5)
            .cloned()
            .collect();
        let max_queue = self.settings.music.max_queue;

        section_card(
            ui,
            &format!("Очередь · {} из {}", pending.len(), max_queue),
            |ui| {
                if pending.is_empty() {
                    hint(ui, "Очередь пуста. Ссылка из активации награды появится здесь.");
                }
                let current_id = snapshot
                    .current
                    .as_ref()
                    .map(|item| item.redemption_id.clone());

                for (index, item) in pending.iter().enumerate() {
                    let active = current_id.as_deref() == Some(item.redemption_id.as_str());
                    let row = egui::Frame::none()
                        .fill(if active {
                            with_alpha(SUCCESS, 16)
                        } else {
                            Color32::TRANSPARENT
                        })
                        .rounding(Rounding::same(10.0))
                        .inner_margin(egui::Margin::symmetric(10.0, 6.0))
                        .show(ui, |ui| {
                            ui.horizontal(|ui| {
                                ui.label(
                                    RichText::new(format!("{}.", index + 1))
                                        .size(12.6)
                                        .color(TEXT_DIM),
                                );
                                ui.vertical(|ui| {
                                    ui.add(
                                        egui::Label::new(
                                            RichText::new(item.label())
                                                .size(13.8)
                                                .color(if active { TEXT } else { TEXT }),
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
                                    if let Some(error) = item.error.as_ref() {
                                        meta.push_str(&format!(" · {error}"));
                                    }
                                    ui.label(RichText::new(meta).size(11.2).color(
                                        if item.error.is_some() {
                                            DANGER
                                        } else {
                                            TEXT_DIM
                                        },
                                    ));
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
                                    queue_state_chip(ui, item.state);
                                });
                            });
                        });
                    let _ = row;
                    ui.add_space(2.0);
                }

                if !pending.is_empty() {
                    ui.add_space(6.0);
                    if ghost_button(ui, "Очистить очередь", with_alpha(DANGER, 220)).clicked() {
                        clear_queue = true;
                    }
                }

                // Ручная заявка: не тратит баллы зрителей.
                ui.add_space(8.0);
                ui.horizontal(|ui| {
                    let width = (ui.available_width() - 120.0).clamp(180.0, 520.0);
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
                    if secondary_button(ui, "В очередь").clicked() && !self.music_manual_input.trim().is_empty() {
                        add_manual = true;
                    }
                });
                hint(
                    ui,
                    "Ручная очередь не тратит баллы зрителей — удобно для проверки. Ссылку можно вставить и просто нажав Enter.",
                );

                // История.
                if !finished.is_empty() {
                    ui.add_space(10.0);
                    hint(ui, "Недавние заявки — ↻ ставит трек снова");
                    for item in &finished {
                        ui.horizontal(|ui| {
                            queue_state_chip(ui, item.state);
                            ui.label(
                                RichText::new(item.label())
                                    .size(12.6)
                                    .color(with_alpha(TEXT_DIM, 210)),
                            );
                            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                                if icon_button(ui, UiIcon::Refresh, "Поставить снова", 24.0)
                                    .clicked()
                                {
                                    replay = Some(item.redemption_id.clone());
                                }
                                if item.duration_sec > 0 {
                                    ui.label(
                                        RichText::new(music::ytdlp::format_duration(
                                            item.duration_sec,
                                        ))
                                        .size(11.0)
                                        .color(with_alpha(TEXT_DIM, 160)),
                                    );
                                }
                            });
                        });
                    }
                }
            },
        );

        ui.add_space(12.0);

        // ---- Награда и цена ----
        {
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
            let mut picked: Option<String> = None;

            section_card(ui, "Награда и цена", |ui| {
                ui.horizontal_wrapped(|ui| {
                    egui::ComboBox::from_id_salt("music-reward")
                        .width(280.0)
                        .selected_text(current_label.clone())
                        .show_ui(ui, |ui| {
                            for (id, label) in &rewards {
                                let selected = id == &self.settings.music.reward_id;
                                if ui.selectable_label(selected, label).clicked() {
                                    picked = Some(id.clone());
                                }
                            }
                        });
                    ui.add_space(8.0);
                    ui.label(RichText::new("Цена").size(13.0).color(TEXT_DIM));
                    ui.add(
                        egui::TextEdit::singleline(&mut self.music_cost_input)
                            .desired_width(64.0),
                    );
                    if secondary_button(ui, "Применить цену").clicked() {
                        self.apply_music_price();
                    }
                });
                if rewards.is_empty() {
                    hint(ui, "Список наград пуст — обновите его на вкладке «Награды».");
                } else {
                    hint(
                        ui,
                        "Цена меняет награду на Twitch: зритель платит её за заявку. Изменение применится сразу.",
                    );
                }
            });

            if let Some(id) = picked {
                self.set_music_reward(&id);
            }
        }

        ui.add_space(12.0);

        // ---- Настройки музыки ----
        let mut open = self.music_settings_open;
        let mut dirty = false;
        section_card(ui, "Настройки", |ui| {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new("Очередь, длительность, поведение плеера")
                        .size(13.2)
                        .color(TEXT_DIM),
                );
                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    let label = if open { "Свернуть" } else { "Развернуть" };
                    if secondary_button(ui, label).clicked() {
                        open = !open;
                    }
                });
            });
            if !open {
                return;
            }
            ui.add_space(10.0);

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
            ui.add_space(8.0);
            let mut pause_yandex = self.settings.music.pause_yandex;
            if toggle(ui, &mut pause_yandex) {
                self.settings.music.pause_yandex = pause_yandex;
                dirty = true;
            }
            ui.label(
                RichText::new("Ставить Яндекс Музыку на паузу и возвращать после")
                    .size(13.2)
                    .color(TEXT),
            );
            ui.add_space(4.0);
            hint(
                ui,
                "Длительность и лимит очереди применяются сразу.",
            );
        });
        if open != self.music_settings_open {
            self.music_settings_open = open;
            self.touch();
        }
        if dirty {
            self.apply_music_config();
            self.mark_dirty();
            self.touch();
        }

        ui.add_space(12.0);

        // ---- Состояние и оверлей ----
        section_card(ui, "Состояние и оверлей", |ui| {
            match snapshot.ytdlp_version.as_ref() {
                Some(version) => hint(ui, &format!("yt-dlp {version} — готов")),
                None => paragraph(
                    ui,
                    "yt-dlp не найден: положите yt-dlp.exe рядом с программой (или в папку tools).",
                    DANGER,
                    13.6,
                ),
            }
            if let Some(path) = snapshot.ytdlp_path.as_ref() {
                hint(ui, path);
            }
            if let Some(error) = snapshot.error.as_ref() {
                ui.add_space(4.0);
                paragraph(ui, error, DANGER, 13.2);
            }

            ui.add_space(8.0);
            hint(ui, "Оверлей для OBS (источник «Браузер», 1920×300):");
            let overlay_url = "http://127.0.0.1:8770/overlay";
            ui.horizontal_wrapped(|ui| {
                ui.label(
                    RichText::new(overlay_url)
                        .size(12.6)
                        .monospace()
                        .color(TEXT),
                );
                if secondary_button(ui, "Скопировать").clicked() {
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
                if secondary_button(ui, "Открыть в браузере").clicked() {
                    open_overlay = true;
                }
                if secondary_button(ui, "Настроить").clicked() {
                    open_obs = true;
                }
            });
            ui.add_space(4.0);
            hint(
                ui,
                "Команда !трек в чате показывает строку ещё раз. Настройки положения и шрифта — в «Оверлей OBS».",
            );
        });

        if copy_overlay {
            ui.output_mut(|output| output.copied_text = "http://127.0.0.1:8770/overlay".to_string());
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

'''

MUSIC_PLAYER = r'''    /// Карточка плеера: обложка, состояние, прогресс, кнопки, громкость.
    fn music_player_card(&mut self, ui: &mut egui::Ui, snapshot: &music::Snapshot) {
        let mut restart = false;
        let mut toggle_pause = false;
        let mut skip = false;

        card_frame().show(ui, |ui| {
            ui.set_width(ui.available_width());
            let current = snapshot.current.as_ref();
            let playing = current.is_some();
            let loading = current
                .map(|item| matches!(item.state, ItemState::Loading))
                .unwrap_or(false);

            let title = current
                .map(|item| item.label())
                .unwrap_or_else(|| "Ничего не играет".to_string());
            let subtitle = match current {
                Some(item) => {
                    if item.channel.trim().is_empty() {
                        "YouTube".to_string()
                    } else {
                        item.channel.clone()
                    }
                }
                None => {
                    if snapshot.ytdlp_version.is_some() {
                        "Активируйте награду на канале — трек встанет в очередь".to_string()
                    } else {
                        "yt-dlp не найден — заявки пока не принимаются".to_string()
                    }
                }
            };
            let requester = current
                .map(|item| {
                    if item.user_login.trim().is_empty() || item.user_login == "manual" {
                        String::new()
                    } else {
                        format!("заказал @{}", item.user_login)
                    }
                })
                .unwrap_or_default();

            ui.horizontal(|ui| {
                let (art_rect, _) = ui.allocate_exact_size(Vec2::splat(76.0), Sense::hover());
                ui.painter()
                    .rect_filled(art_rect, Rounding::same(18.0), with_alpha(ACCENT, 26));
                for (index, height) in [18.0_f32, 30.0, 24.0, 14.0].iter().enumerate() {
                    let x = art_rect.left() + 15.0 + index as f32 * 12.0;
                    let bar = egui::Rect::from_min_max(
                        egui::pos2(x, art_rect.center().y - height / 2.0),
                        egui::pos2(x + 6.0, art_rect.center().y + height / 2.0),
                    );
                    ui.painter().rect_filled(bar, Rounding::same(3.0), ACCENT);
                }
                ui.add_space(10.0);
                ui.vertical(|ui| {
                    ui.horizontal(|ui| {
                        if playing {
                            ui.label(
                                RichText::new(if loading {
                                    "ЗАГРУЖАЕМ ТРЕК"
                                } else if snapshot.player.paused {
                                    "ПАУЗА"
                                } else {
                                    "СЕЙЧАС ИГРАЕТ"
                                })
                                .size(10.6)
                                .color(if loading { WARN } else { SUCCESS }),
                            );
                            if loading {
                                ui.add(egui::Spinner::new().size(12.0));
                            }
                        }
                    });
                    ui.label(
                        RichText::new(title)
                            .family(semibold())
                            .size(22.0)
                            .color(TEXT),
                    );
                    hint(ui, &subtitle);
                    if !requester.is_empty() {
                        ui.label(RichText::new(requester).size(13.0).color(ACCENT));
                    }
                });
                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    let (wave_rect, _) =
                        ui.allocate_exact_size(Vec2::new(62.0, 26.0), Sense::hover());
                    if playing && !snapshot.player.paused {
                        for (index, height) in [9.0_f32, 17.0, 24.0, 15.0, 10.0].iter().enumerate() {
                            let x = wave_rect.left() + index as f32 * 12.0;
                            let bar = egui::Rect::from_min_max(
                                egui::pos2(x, wave_rect.center().y - height / 2.0),
                                egui::pos2(x + 6.0, wave_rect.center().y + height / 2.0),
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

            ui.add_space(12.0);

            let total = if playing {
                snapshot.player.duration_sec
            } else {
                0
            };
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
                    Vec2::new(ui.available_width(), 22.0),
                    Sense::hover(),
                );
                ui.painter().rect_filled(
                    egui::Rect::from_center_size(rect.center(), Vec2::new(rect.width(), 4.0)),
                    Rounding::same(2.0),
                    with_alpha(TEXT_DIM, 60),
                );
            }
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(music::ytdlp::format_duration(position))
                        .size(12.2)
                        .color(TEXT_DIM),
                );
                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    ui.label(
                        RichText::new(music::ytdlp::format_duration(total))
                            .size(12.2)
                            .color(TEXT_DIM),
                    );
                });
            });

            ui.add_space(8.0);

            ui.horizontal(|ui| {
                ui.spacing_mut().item_spacing.x = 8.0;
                let buttons_width = 3.0 * 38.0 + 2.0 * 8.0;
                let free = (ui.available_width() - 330.0 - buttons_width).max(0.0);
                ui.add_space(free / 2.0);

                let restart_clicked = ui
                    .add_enabled_ui(playing, |ui| player_icon_button(ui, PlayerIcon::Restart))
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

                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    let mut volume = self.settings.music.music_volume;
                    let changed = ui
                        .add(egui::Slider::new(&mut volume, 0.0..=1.0).show_value(false))
                        .changed();
                    ui.label(
                        RichText::new(util::format_volume(
                            self.settings.music.music_volume as f32,
                        ))
                        .size(12.4)
                        .color(TEXT_DIM),
                    );
                    ui.label(
                        RichText::new("Громкость музыки")
                            .size(12.8)
                            .color(TEXT_DIM),
                    );
                    if changed {
                        self.settings.music.music_volume = volume;
                        self.music.set_volume(volume as f32);
                        self.mark_dirty();
                    }
                });
            });

            if let Some(error) = snapshot.player.error.as_ref() {
                ui.add_space(6.0);
                paragraph(ui, error, DANGER, 12.8);
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

src = replace_between(src, "    fn music_tab(&mut self, ui: &mut egui::Ui) {", "    /// Окно настроек оверлея для OBS: ссылка и параметры показа.\n    fn obs_window(", MUSIC_TAB)
src = replace_between(src, "    /// Карточка плеера: обложка, название, заказчик, прогресс, кнопки, громкость.\n    fn music_player_card(", "    fn apply_music_price(", MUSIC_PLAYER)

# helper: чип состояния заявки
helper = r'''
/// Цветной чип состояния заявки в очереди.
fn queue_state_chip(ui: &mut egui::Ui, state: ItemState) {
    let color = match state {
        ItemState::Queued => TEXT_DIM,
        ItemState::Loading => WARN,
        ItemState::Playing => SUCCESS,
        ItemState::Done => SUCCESS,
        ItemState::Failed => DANGER,
        ItemState::Refunded => WARN,
        ItemState::Skipped => TEXT_DIM,
    };
    let (bg, fg) = (with_alpha(color, 24), color);
    let font = FontId::new(11.0, egui::FontFamily::Proportional);
    let width = ui
        .painter()
        .layout_no_wrap(state.label().to_string(), font.clone(), fg)
        .size()
        .x;
    let (rect, _) = ui.allocate_exact_size(Vec2::new(width + 18.0, 22.0), Sense::hover());
    ui.painter().rect_filled(rect, Rounding::same(11.0), bg);
    ui.painter().text(
        rect.center(),
        Align2::CENTER_CENTER,
        state.label(),
        font,
        fg,
    );
}

'''
src = src.replace("fn duration_label(seconds: u64) -> String {", helper + "fn duration_label(seconds: u64) -> String {", 1)

P.write_text(src, encoding="utf-8")
print("music tab + player replaced, length", len(src))
