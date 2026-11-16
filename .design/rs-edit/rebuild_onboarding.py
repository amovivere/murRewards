# -*- coding: utf-8 -*-
"""Онбординг по макету: две колонки + мини-карточки локальных привязок."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")


def sub(old: str, new: str) -> None:
    global s
    assert old in s, "NOT FOUND: " + old[:110]
    s = s.replace(old, new, 1)


# поле развёрнутого списка локальных привязок
sub("""    /// Открыто окно «Награда и цена» на вкладке «Музыка».
    music_price_open: bool,
""",
"""    /// Открыто окно «Награда и цена» на вкладке «Музыка».
    music_price_open: bool,
    /// Показаны все локальные привязки (а не первые три).
    local_bindings_open: bool,
""")
sub("""            music_price_open: false,
            demo,
""",
"""            music_price_open: false,
            local_bindings_open: false,
            demo,
""")

# поиск с иконкой
sub("""            egui::Frame::none()
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
""",
"""            egui::Frame::none()
                .fill(CARD)
                .stroke(Stroke::new(1.0_f32, BORDER))
                .rounding(Rounding::same(17.0))
                .inner_margin(egui::Margin::symmetric(12.0, 6.0))
                .show(ui, |ui| {
                    ui.horizontal(|ui| {
                        let (icon_rect, _) =
                            ui.allocate_exact_size(Vec2::splat(14.0), Sense::hover());
                        paint_ui_icon(
                            ui.painter(),
                            icon_rect,
                            UiIcon::Search,
                            with_alpha(TEXT_DIM, 200),
                        );
                        ui.add(
                            egui::TextEdit::singleline(&mut self.search)
                                .frame(false)
                                .hint_text("Поиск награды")
                                .desired_width(search_width - 22.0)
                                .font(FontId::proportional(13.6)),
                        );
                    });
                });
""")

# кнопка «Остановить всё» всегда доступна (как в макете)
sub("""            let stop = ui
                .add_enabled_ui(!playing.is_empty(), |ui| danger_button(ui, "Остановить всё"))
                .inner;
            if stop.clicked() {
                stop_all = true;
            }
""",
"""            if danger_button(ui, "Остановить всё").clicked() {
                stop_all = true;
            }
""")

# --- Новый онбординг ---
NEW_QUICK = r'''    /// Карточка быстрого старта вместо пустого экрана «Награды».
    fn quick_start_card(&mut self, ui: &mut egui::Ui) {
        let mut go_settings = false;
        let mut open_help = false;

        ui.horizontal_top(|ui| {
            let total = ui.available_width();
            let left_width = (total * 0.62).floor();
            let right_width = total - left_width - 10.0;

            ui.allocate_ui(Vec2::new(left_width, 0.0), |ui| {
                card_frame().show(ui, |ui| {
                    ui.set_width(ui.available_width());
                    ui.label(
                        RichText::new("Быстрый старт")
                            .family(semibold())
                            .size(19.0)
                            .color(TEXT),
                    );
                    ui.label(
                        RichText::new("Три шага — и звуки будут играть на стриме автоматически.")
                            .size(12.8)
                            .color(TEXT_DIM),
                    );
                    ui.add_space(6.0);

                    let steps = [
                        (
                            1u32,
                            true,
                            "Подключите Twitch",
                            "Публичный Client ID вашего приложения на dev.twitch.tv — это не пароль. Вход подтверждается кодом на сайте Twitch, токены хранятся только на этом компьютере.",
                        ),
                        (
                            2,
                            false,
                            "Выберите награду и привяжите звук",
                            "Награды Channel Points подтянутся с канала. Можно создать награду прямо здесь — и сразу выбрать для неё файл.",
                        ),
                        (
                            3,
                            false,
                            "Проверьте звук",
                            "Кнопка «Прослушать» на карточке играет файл так же, как при активации награды.",
                        ),
                    ];
                    for (index, (number, active, title, text)) in steps.iter().enumerate() {
                        if index > 0 {
                            ui.add_space(6.0);
                        }
                        ui.horizontal_top(|ui| {
                            let (circle, _) =
                                ui.allocate_exact_size(Vec2::splat(28.0), Sense::hover());
                            if *active {
                                ui.painter().circle_filled(circle.center(), 14.0, TEXT);
                                ui.painter().text(
                                    circle.center(),
                                    Align2::CENTER_CENTER,
                                    number.to_string(),
                                    FontId::new(13.0, semibold()),
                                    BG,
                                );
                            } else {
                                ui.painter().circle(
                                    circle.center(),
                                    13.0,
                                    with_alpha(Color32::WHITE, 4),
                                    Stroke::new(1.0_f32, with_alpha(Color32::WHITE, 40)),
                                );
                                ui.painter().text(
                                    circle.center(),
                                    Align2::CENTER_CENTER,
                                    number.to_string(),
                                    FontId::new(13.0, semibold()),
                                    TEXT_DIM,
                                );
                            }
                            ui.add_space(6.0);
                            ui.vertical(|ui| {
                                ui.label(
                                    RichText::new(*title)
                                        .family(semibold())
                                        .size(15.2)
                                        .color(TEXT),
                                );
                                ui.add(
                                    egui::Label::new(
                                        RichText::new(*text).size(12.8).color(TEXT_DIM),
                                    )
                                    .wrap(),
                                );
                                if *active {
                                    ui.add_space(8.0);
                                    ui.horizontal(|ui| {
                                        if accent_button(ui, "Подключить Twitch").clicked() {
                                            go_settings = true;
                                        }
                                        if ghost_button(ui, "Где взять Client ID?", TEXT_DIM)
                                            .clicked()
                                        {
                                            open_help = true;
                                        }
                                    });
                                }
                            });
                        });
                    }

                    ui.add_space(6.0);
                    ui.separator();
                    ui.add_space(4.0);
                    ui.horizontal(|ui| {
                        ui.label(RichText::new("●").size(9.6).color(SUCCESS));
                        ui.label(
                            RichText::new(format!(
                                "Аудиовыход в порядке · {}",
                                self.audio
                                    .device
                                    .clone()
                                    .unwrap_or_else(|| "устройство не найдено".to_string())
                            ))
                            .size(12.0)
                            .color(TEXT_DIM),
                        );
                        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                            if ghost_button(ui, "Проверить подключение", TEXT_DIM).clicked() {
                                self.refresh_twitch_now();
                                self.notify("Проверяем подключение…", ToastKind::Info);
                            }
                        });
                    });
                });
            });

            ui.add_space(10.0);

            ui.allocate_ui(Vec2::new(right_width, 0.0), |ui| {
                ui.vertical(|ui| {
                    card_frame().show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        ui.label(
                            RichText::new("Почему нужен Client ID?")
                                .family(semibold())
                                .size(15.0)
                                .color(TEXT),
                        );
                        ui.add_space(8.0);
                        for line in [
                            "Это идентификатор приложения, а не логин и не пароль.",
                            "Нужен один раз: приложение запоминает вход между запусками.",
                            "Понадобится 2FA на аккаунте Twitch — этого требует сам Twitch.",
                        ] {
                            ui.horizontal_top(|ui| {
                                ui.label(RichText::new("•").size(13.6).color(SUCCESS));
                                ui.add(
                                    egui::Label::new(
                                        RichText::new(line).size(12.2).color(TEXT_DIM),
                                    )
                                    .wrap(),
                                );
                            });
                            ui.add_space(4.0);
                        }
                        ui.add_space(4.0);
                        if secondary_button(ui, "Открыть инструкцию").clicked() {
                            open_help = true;
                        }
                    });

                    ui.add_space(10.0);
                    card_frame().show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        ui.horizontal(|ui| {
                            let (rect, _) =
                                ui.allocate_exact_size(Vec2::splat(38.0), Sense::hover());
                            ui.painter().rect_filled(
                                rect,
                                Rounding::same(12.0),
                                with_alpha(SUCCESS, 30),
                            );
                            for (index, height) in
                                [8.0_f32, 14.0, 20.0, 11.0].iter().enumerate()
                            {
                                let x = rect.left() + 10.0 + index as f32 * 6.0;
                                let bar = egui::Rect::from_min_max(
                                    egui::pos2(x, rect.center().y - height / 2.0),
                                    egui::pos2(x + 3.0, rect.center().y + height / 2.0),
                                );
                                ui.painter().rect_filled(
                                    bar,
                                    Rounding::same(1.5),
                                    SUCCESS,
                                );
                            }
                            ui.add_space(6.0);
                            ui.vertical(|ui| {
                                ui.label(
                                    RichText::new("Звук готов")
                                        .family(semibold())
                                        .size(13.6)
                                        .color(TEXT),
                                );
                                ui.add(
                                    egui::Label::new(
                                        RichText::new(
                                            "Можно проверить его без Twitch — ниже локальные привязки.",
                                        )
                                        .size(11.6)
                                        .color(TEXT_DIM),
                                    )
                                    .wrap(),
                                );
                            });
                        });
                    });
                });
            });
        });

        ui.add_space(12.0);
        self.local_bindings_card(ui);

        if go_settings {
            self.tab = Tab::Settings;
            self.touch();
        }
        if open_help {
            let _ = webbrowser::open("https://dev.twitch.tv/console/apps");
        }
    }

'''

src_start = "    /// Карточка быстрого старта вместо пустого экрана «Награды».\n    fn quick_start_card("
src_end = "    #[allow(clippy::too_many_arguments)]\n    fn quick_start_step("
a = s.index(src_start)
b = s.index(src_end)
s = s[:a] + NEW_QUICK + s[b:]

# --- Новые локальные привязки: мини-карточки как в макете ---
NEW_LOCAL = r'''    /// Локальные привязки звуков: доступны даже без Twitch.
    fn local_bindings_card(&mut self, ui: &mut egui::Ui) {
        let bindings = self.settings.twitch_rewards.clone();
        if bindings.is_empty() {
            return;
        }
        self.ensure_file_cache();
        let cache = self.file_cache.clone();
        let playing = self.playing.clone();
        let mut action: Option<RewardUiAction> = None;
        let mut toggle_all = false;
        let limit = if self.local_bindings_open {
            bindings.len()
        } else {
            3.min(bindings.len())
        };

        card_frame().show(ui, |ui| {
            ui.set_width(ui.available_width());
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(format!("Локальные привязки · {}", bindings.len()))
                        .family(semibold())
                        .size(15.0)
                        .color(TEXT),
                );
                ui.add_space(4.0);
                let chip = pill_button(ui, "работают без Twitch", TEXT_DIM);
                chip.on_hover_text("Файлы и громкость хранятся локально");
                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    let label = if self.local_bindings_open {
                        "Свернуть"
                    } else {
                        "Показать все"
                    };
                    if bindings.len() > 3 && ghost_button(ui, label, TEXT_DIM).clicked() {
                        toggle_all = true;
                    }
                });
            });
            ui.add_space(6.0);

            let columns = if ui.available_width() >= 820.0 { 3 } else { 2 };
            let chunk = limit.max(1);
            for row in bindings[..chunk].chunks(columns) {
                ui.columns(columns, |cols| {
                    for (index, binding) in row.iter().enumerate() {
                        if index >= cols.len() {
                            break;
                        }
                        let ui = &mut cols[index];
                        let cached = cache.get(&binding.path);
                        let exists = cached.map(|file| file.exists).unwrap_or(true);
                        let (meta, _) = sound_meta(&binding.path, cached);
                        egui::Frame::none()
                            .fill(with_alpha(Color32::WHITE, 3))
                            .stroke(Stroke::new(
                                1.0_f32,
                                with_alpha(Color32::WHITE, 16),
                            ))
                            .rounding(Rounding::same(12.0))
                            .inner_margin(egui::Margin::symmetric(10.0, 8.0))
                            .show(ui, |ui| {
                                ui.set_width(ui.available_width());
                                ui.horizontal(|ui| {
                                    ui.add(
                                        egui::Label::new(
                                            RichText::new(if binding.title.is_empty() {
                                                "Без названия"
                                            } else {
                                                &binding.title
                                            })
                                            .size(12.6)
                                            .color(TEXT),
                                        )
                                        .truncate(),
                                    )
                                    .on_hover_text(&binding.title);
                                    ui.with_layout(
                                        Layout::right_to_left(Align::Center),
                                        |ui| {
                                            ui.label(
                                                RichText::new(
                                                    meta.split('·')
                                                        .nth(1)
                                                        .map(str::trim)
                                                        .unwrap_or("—"),
                                                )
                                                .size(10.8)
                                                .color(TEXT_DIM),
                                            );
                                        },
                                    );
                                });
                                ui.add_space(4.0);
                                ui.horizontal(|ui| {
                                    if icon_button(ui, UiIcon::Play, "Прослушать", 22.0)
                                        .clicked()
                                        && exists
                                    {
                                        action = Some(RewardUiAction::Play {
                                            reward_id: binding.reward_id.clone(),
                                            path: binding.path.clone(),
                                        });
                                    }
                                    let mut volume = binding.volume;
                                    ui.spacing_mut().slider_width = 70.0;
                                    let slider = ui.add(
                                        egui::Slider::new(&mut volume, 0.0..=2.0)
                                            .show_value(false)
                                            .trailing_fill(true),
                                    );
                                    ui.label(
                                        RichText::new(format!(
                                            "{}%",
                                            (volume * 100.0).round() as i32
                                        ))
                                        .size(10.4)
                                        .color(TEXT_DIM),
                                    );
                                    if slider.changed() {
                                        action = Some(RewardUiAction::SetVolume {
                                            reward_id: binding.reward_id.clone(),
                                            volume,
                                        });
                                    }
                                    if self.local_bindings_open {
                                        ui.with_layout(
                                            Layout::right_to_left(Align::Center),
                                            |ui| {
                                                if ghost_button(
                                                    ui,
                                                    "Убрать",
                                                    with_alpha(DANGER, 210),
                                                )
                                                .clicked()
                                                {
                                                    action =
                                                        Some(RewardUiAction::Clear {
                                                            reward_id: binding
                                                                .reward_id
                                                                .clone(),
                                                        });
                                                }
                                            },
                                        );
                                    } else if playing.iter().any(|id| id == &binding.reward_id) {
                                        ui.label(
                                            RichText::new("играет")
                                                .size(10.4)
                                                .color(SUCCESS),
                                        );
                                    }
                                });
                            });
                    }
                });
                ui.add_space(8.0);
            }

            ui.add_space(2.0);
            hint(
                ui,
                "Файлы и громкость хранятся локально — их можно менять и слушать даже без подключения к Twitch.",
            );
        });

        if toggle_all {
            self.local_bindings_open = !self.local_bindings_open;
            self.touch();
        }
        if let Some(action) = action {
            self.apply_reward_action(action);
        }
    }

'''

a = s.index("    /// Локальные привязки звуков: доступны даже без Twitch.\n    fn local_bindings_card(")
b = s.index("    // ---------- управление наградами ----------")
s = s[:a] + NEW_LOCAL + s[b:]

P.write_text(s, encoding="utf-8")
print("onboarding rebuilt, length", len(s))
