# -*- coding: utf-8 -*-
"""Очередь и нижний ряд «Музыки» по CSS макета."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")

QUEUE = r'''        // ---- Очередь ----
        let pending: Vec<music::QueueItem> = snapshot
            .items
            .iter()
            .filter(|item| !item.state.is_final())
            .cloned()
            .collect();
        let max_queue = self.settings.music.max_queue;
        let current_id = snapshot
            .current
            .as_ref()
            .map(|item| item.redemption_id.clone());
        let prefetched_title = snapshot.prefetched.as_ref().and_then(|prefetched| {
            snapshot
                .items
                .iter()
                .find(|item| &item.video_id == prefetched)
                .map(|item| item.label())
        });

        egui::Frame::none()
            .fill(CARD)
            .stroke(Stroke::new(1.0_f32, BORDER))
            .rounding(Rounding::same(18.0))
            .inner_margin(egui::Margin::symmetric(16.0, 12.0))
            .show(ui, |ui| {
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
                    queue_count_chip(ui, playing, ItemState::Playing);
                }
                if loading > 0 {
                    ui.add_space(4.0);
                    queue_count_chip(ui, loading, ItemState::Loading);
                }
                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    if !pending.is_empty()
                        && ghost_button(ui, "Очистить", with_alpha(DANGER, 220)).clicked()
                    {
                        clear_queue = true;
                    }
                    if snapshot.prefetched.is_some() {
                        ui.add_space(6.0);
                        ui.label(
                            RichText::new("✓ следующий загружен")
                                .size(10.6)
                                .color(with_alpha(SUCCESS, 200)),
                        )
                        .on_hover_text(
                            prefetched_title
                                .as_ref()
                                .map(|title| format!("«{title}» уже в памяти — начнётся без задержки"))
                                .unwrap_or_else(|| "Следующий трек уже в памяти".to_string()),
                        );
                    }
                });
            });

            ui.add_space(8.0);

            if pending.is_empty() {
                ui.add_space(2.0);
                hint(
                    ui,
                    "Очередь пуста. Ссылка из активации награды появится здесь.",
                );
                ui.add_space(4.0);
            }

            for (index, item) in pending.iter().enumerate() {
                let active = current_id.as_deref() == Some(item.redemption_id.as_str());
                let is_prefetched = snapshot
                    .prefetched
                    .as_ref()
                    .map(|prefetched| &item.video_id == prefetched)
                    .unwrap_or(false);
                egui::Frame::none()
                    .fill(if active {
                        with_alpha(SUCCESS, 18)
                    } else {
                        Color32::TRANSPARENT
                    })
                    .rounding(Rounding::same(10.0))
                    .inner_margin(egui::Margin::symmetric(10.0, 0.0))
                    .show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        ui.set_min_height(if item.state == ItemState::Loading {
                            36.0
                        } else {
                            36.0
                        });
                        ui.horizontal(|ui| {
                            let (bar_rect, _) =
                                ui.allocate_exact_size(Vec2::new(3.0, 20.0), Sense::hover());
                            if active {
                                ui.painter().rect_filled(
                                    bar_rect,
                                    Rounding::same(2.0),
                                    SUCCESS,
                                );
                            }
                            ui.add_space(9.0);
                            ui.allocate_ui_with_layout(
                                Vec2::new(14.0, 24.0),
                                Layout::left_to_right(Align::Center),
                                |ui| {
                                    ui.label(
                                        RichText::new(format!("{}", index + 1))
                                            .size(12.6)
                                            .color(TEXT_DIM),
                                    );
                                },
                            );
                            ui.add_space(12.0);
                            ui.vertical(|ui| {
                                ui.add(
                                    egui::Label::new(
                                        RichText::new(item.label()).size(13.8).color(TEXT),
                                    )
                                    .truncate(),
                                );
                                if item.state == ItemState::Loading {
                                    ui.horizontal(|ui| {
                                        ui.label(
                                            RichText::new("загружается")
                                                .size(11.4)
                                                .color(WARN),
                                        );
                                        ui.add_space(6.0);
                                        let (rect, _) = ui.allocate_exact_size(
                                            Vec2::new(110.0, 12.0),
                                            Sense::hover(),
                                        );
                                        let track = egui::Rect::from_center_size(
                                            rect.center(),
                                            Vec2::new(rect.width(), 3.0),
                                        );
                                        ui.painter().rect_filled(
                                            track,
                                            Rounding::same(1.5),
                                            with_alpha(Color32::WHITE, 34),
                                        );
                                        let time = ui.input(|input| input.time) as f32;
                                        let phase = (time * 0.65) % 1.0;
                                        let segment = rect.width() * 0.42;
                                        let travel = rect.width() - segment;
                                        let start = rect.left() + travel * phase;
                                        ui.painter().rect_filled(
                                            egui::Rect::from_min_max(
                                                egui::pos2(start, track.top()),
                                                egui::pos2(start + segment, track.bottom()),
                                            ),
                                            Rounding::same(1.5),
                                            WARN,
                                        );
                                        ui.ctx().request_repaint_after(
                                            std::time::Duration::from_millis(70),
                                        );
                                    });
                                } else {
                                    let mut meta = format!("@{}", item.user_login);
                                    if item.duration_sec > 0 {
                                        meta.push_str(&format!(
                                            " · {}",
                                            music::ytdlp::format_duration(item.duration_sec)
                                        ));
                                    }
                                    if active && !item.channel.trim().is_empty() {
                                        meta.push_str(&format!(" · {}", item.channel));
                                    }
                                    ui.label(RichText::new(meta).size(11.4).color(TEXT_DIM));
                                }
                            });
                            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                                if queue_action_button(ui, UiIcon::X, "Убрать из очереди").clicked()
                                {
                                    remove = Some(item.redemption_id.clone());
                                }
                                if item.state == ItemState::Queued && index > 0 {
                                    if queue_action_button(ui, UiIcon::ChevronUp, "Поднять выше")
                                        .clicked()
                                    {
                                        move_up = Some(item.redemption_id.clone());
                                    }
                                }
                                if is_prefetched {
                                    ui.add_space(2.0);
                                    tiny_chip(ui, "загружен", SUCCESS);
                                }
                                let chip = queue_state_chip(ui, item.state);
                                if let Some(error) = item.error.as_ref() {
                                    chip.on_hover_text(error);
                                }
                            });
                        });
                    });
            }

            ui.add_space(8.0);
            let (line_rect, _) = ui.allocate_exact_size(
                Vec2::new(ui.available_width(), 1.0),
                Sense::hover(),
            );
            ui.painter().rect_filled(
                line_rect,
                Rounding::ZERO,
                with_alpha(Color32::WHITE, 18),
            );
            ui.add_space(10.0);

            ui.horizontal(|ui| {
                let (plus_rect, _) = ui.allocate_exact_size(Vec2::new(18.0, 18.0), Sense::hover());
                let stroke = Stroke::new(1.8_f32, with_alpha(TEXT_DIM, 220));
                ui.painter().line_segment(
                    [
                        egui::pos2(plus_rect.left() + 3.0, plus_rect.center().y),
                        egui::pos2(plus_rect.right() - 3.0, plus_rect.center().y),
                    ],
                    stroke,
                );
                ui.painter().line_segment(
                    [
                        egui::pos2(plus_rect.center().x, plus_rect.top() + 3.0),
                        egui::pos2(plus_rect.center().x, plus_rect.bottom() - 3.0),
                    ],
                    stroke,
                );
                ui.add_space(6.0);
                let button_width = 128.0;
                let width = (ui.available_width() - button_width - 16.0).max(220.0);
                egui::Frame::none()
                    .fill(BG)
                    .stroke(Stroke::new(1.0_f32, with_alpha(BORDER, 200)))
                    .rounding(Rounding::same(17.0))
                    .inner_margin(egui::Margin::symmetric(14.0, 4.0))
                    .show(ui, |ui| {
                        let response = ui.add(
                            egui::TextEdit::singleline(&mut self.music_manual_input)
                                .frame(false)
                                .desired_width(width)
                                .font(FontId::proportional(13.2)),
                        );
                        if self.music_manual_input.is_empty() {
                            let hint_pos = response.rect.left_center() + Vec2::new(1.0, 0.0);
                            ui.painter().text(
                                hint_pos,
                                Align2::LEFT_CENTER,
                                "Вставьте ссылку YouTube и нажмите Enter — трек встанет в очередь",
                                FontId::proportional(13.2),
                                with_alpha(TEXT_DIM, 185),
                            );
                        }
                        if response.lost_focus()
                            && ui.input(|input| input.key_pressed(egui::Key::Enter))
                        {
                            add_manual = true;
                        }
                    });
                ui.add_space(8.0);
                if compact_secondary_button(ui, "В очередь").clicked()
                    && !self.music_manual_input.trim().is_empty()
                {
                    add_manual = true;
                }
            });
            ui.add_space(4.0);
            ui.label(
                RichText::new("Ручная очередь не тратит баллы зрителей — удобно для проверки.")
                    .size(11.0)
                    .color(with_alpha(TEXT_DIM, 180)),
            );
        });

        ui.add_space(10.0);

        // ---- Нижний ряд: OBS и состояние ----
'''

start = s.index("        // ---- Очередь ----")
end = s.index("        // ---- Нижний ряд: OBS и состояние ----")
s = s[:start] + QUEUE + s[end:]

BOTTOM = r'''        // ---- Нижний ряд: OBS и состояние ----
        ui.horizontal_top(|ui| {
            let total = ui.available_width();
            let obs_width = (total * 0.55).floor();
            let state_width = total - obs_width - 12.0;

            ui.allocate_ui_with_layout(
                Vec2::new(obs_width, 128.0),
                Layout::top_down(Align::Min),
                |ui| {
                egui::Frame::none()
                    .fill(CARD)
                    .stroke(Stroke::new(1.0_f32, BORDER))
                    .rounding(Rounding::same(18.0))
                    .inner_margin(egui::Margin::symmetric(16.0, 14.0))
                    .show(ui, |ui| {
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
                    ui.add_space(10.0);
                    ui.horizontal(|ui| {
                        egui::Frame::none()
                            .fill(with_alpha(Color32::WHITE, 5))
                            .rounding(Rounding::same(8.0))
                            .inner_margin(egui::Margin::symmetric(10.0, 5.0))
                            .show(ui, |ui| {
                                ui.label(
                                    RichText::new("http://127.0.0.1:8770/overlay")
                                        .size(11.4)
                                        .monospace()
                                        .color(Color32::from_rgb(0xCF, 0xCF, 0xCF)),
                                );
                            });
                        ui.add_space(2.0);
                        if icon_button(ui, UiIcon::Copy, "Скопировать ссылку", 28.0).clicked() {
                            copy_overlay = true;
                        }
                        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                            let show = ui
                                .add_enabled_ui(snapshot.current.is_some(), |ui| {
                                    compact_secondary_button(ui, "Показать сейчас")
                                })
                                .inner;
                            if show.clicked() {
                                show_overlay = true;
                            }
                        });
                    });
                    ui.add_space(8.0);
                    let preview = snapshot.current.as_ref();
                    egui::Frame::none()
                        .fill(with_alpha(Color32::WHITE, 4))
                        .rounding(Rounding::same(10.0))
                        .inner_margin(egui::Margin::symmetric(12.0, 7.0))
                        .show(ui, |ui| {
                            ui.set_width(ui.available_width());
                            ui.horizontal(|ui| {
                                for height in [7.0_f32, 12.0, 16.0, 9.0] {
                                    let (rect, _) =
                                        ui.allocate_exact_size(Vec2::new(3.0, 16.0), Sense::hover());
                                    let bar = egui::Rect::from_center_size(
                                        rect.center(),
                                        Vec2::new(3.0, height),
                                    );
                                    ui.painter().rect_filled(
                                        bar,
                                        Rounding::same(2.0),
                                        with_alpha(SUCCESS, 220),
                                    );
                                }
                                ui.add_space(4.0);
                                ui.label(
                                    RichText::new(
                                        preview
                                            .map(|item| item.label())
                                            .unwrap_or_else(|| "ДИНАСТИЯ — Земляк".to_string()),
                                    )
                                    .family(semibold())
                                    .size(11.4)
                                    .color(TEXT),
                                );
                                if let Some(item) = preview {
                                    ui.label(
                                        RichText::new(format!("· заказал @{}", item.user_login))
                                            .size(10.8)
                                            .color(TEXT_DIM),
                                    );
                                }
                            });
                        });
                });
                },
            );

            ui.add_space(12.0);

            ui.allocate_ui_with_layout(
                Vec2::new(state_width, 128.0),
                Layout::top_down(Align::Min),
                |ui| {
                egui::Frame::none()
                    .fill(CARD)
                    .stroke(Stroke::new(1.0_f32, BORDER))
                    .rounding(Rounding::same(18.0))
                    .inner_margin(egui::Margin::symmetric(14.0, 12.0))
                    .show(ui, |ui| {
                    ui.set_width(ui.available_width());
                    ui.label(
                        RichText::new("Состояние")
                            .family(semibold())
                            .size(14.4)
                            .color(TEXT),
                    );
                    ui.add_space(7.0);
                    let row = |ui: &mut egui::Ui, text: String| {
                        ui.horizontal(|ui| {
                            ui.label(RichText::new("✓").size(11.0).color(SUCCESS));
                            ui.label(
                                RichText::new(text)
                                    .size(11.4)
                                    .color(Color32::from_rgb(0xB9, 0xB9, 0xB9)),
                            );
                        });
                    };
                    match snapshot.ytdlp_version.as_ref() {
                        Some(version) => row(ui, format!("yt-dlp {version} — готов")),
                        None => row(ui, "yt-dlp не найден".to_string()),
                    }
                    row(
                        ui,
                        if connected {
                            "Чат: команда !трек работает".to_string()
                        } else {
                            "Чат: нужен Twitch".to_string()
                        },
                    );
                    row(ui, "Порт оверлея 8770 — свободен".to_string());
                });
                },
            );
        });

        // ---- Действия ----
'''

start = s.index("        // ---- Нижний ряд: OBS и состояние ----")
end = s.index("        // ---- Действия ----")
s = s[:start] + BOTTOM + s[end:]

# компактная secondary-кнопка
anchor = "fn danger_button(ui: &mut egui::Ui, label: &str) -> egui::Response {"
helper = r'''/// Уменьшенная вторичная кнопка для нижних карточек (высота 30).
fn compact_secondary_button(ui: &mut egui::Ui, label: &str) -> egui::Response {
    let font = FontId::new(13.0, egui::FontFamily::Proportional);
    let width = ui
        .painter()
        .layout_no_wrap(label.to_owned(), font.clone(), TEXT)
        .size()
        .x;
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(width + 26.0, 30.0), Sense::click());
    let rect = snap_rect(ui, rect);
    let hovered = response.hovered();
    ui.painter().rect(
        rect,
        Rounding::same(15.0),
        if hovered { TEXT } else { Color32::TRANSPARENT },
        Stroke::new(
            2.0_f32,
            if hovered {
                TEXT
            } else {
                with_alpha(Color32::WHITE, 64)
            },
        ),
    );
    ui.painter().text(
        rect.center(),
        Align2::CENTER_CENTER,
        label,
        font,
        if hovered { BG } else { TEXT },
    );
    response
}

'''
assert anchor in s
s = s.replace(anchor, helper + anchor, 1)

P.write_text(s, encoding="utf-8")
print("queue/bottom exact")
