# -*- coding: utf-8 -*-
"""Точная переделка плеера/очереди/низа «Музыки» по CSS макета (часть 2)."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")

PLAYER = r'''    /// Карточка плеера по макету (156 px): обложка 102, инфо-колонка,
    /// строка прогресса с временем, кнопки 32/40/32 и «Пропустить трек»,
    /// справа — громкость и следующий трек.
    fn music_player_card(&mut self, ui: &mut egui::Ui, snapshot: &music::Snapshot) {
        let mut restart = false;
        let mut toggle_pause = false;
        let mut skip = false;
        let current = snapshot.current.as_ref();
        let playing = current.is_some();
        let loading = current
            .map(|item| matches!(item.state, ItemState::Loading))
            .unwrap_or(false);

        egui::Frame::none()
            .fill(CARD)
            .stroke(Stroke::new(1.0_f32, BORDER))
            .rounding(Rounding::same(18.0))
            .inner_margin(egui::Margin::symmetric(16.0, 14.0))
            .show(ui, |ui| {
            ui.set_width(ui.available_width());
            let total_width = ui.available_width();
            ui.horizontal_top(|ui| {
                let right_width = 196.0;
                let info_width =
                    (total_width - 102.0 - 16.0 - right_width - 33.0).max(300.0);

                let (art_rect, _) = ui.allocate_exact_size(Vec2::splat(102.0), Sense::hover());
                ui.painter().rect_filled(
                    art_rect,
                    Rounding::same(14.0),
                    blend_over(CARD, with_alpha(Color32::WHITE, 8)),
                );
                {
                    let scale = art_rect.width() / 86.0;
                    let ink = Color32::from_rgb(110, 110, 110);
                    let stroke = Stroke::new(1.5 * scale, ink);
                    let c = art_rect.center();
                    let left = egui::pos2(c.x - 18.0 * scale, c.y + 18.0 * scale);
                    let right = egui::pos2(c.x + 8.0 * scale, c.y + 12.0 * scale);
                    ui.painter().circle_stroke(left, 5.0 * scale, stroke);
                    ui.painter().circle_stroke(right, 5.0 * scale, stroke);
                    ui.painter().line_segment(
                        [
                            egui::pos2(left.x + 4.5 * scale, left.y),
                            egui::pos2(left.x + 4.5 * scale, left.y - 33.0 * scale),
                        ],
                        stroke,
                    );
                    ui.painter().line_segment(
                        [
                            egui::pos2(right.x + 4.5 * scale, right.y),
                            egui::pos2(right.x + 4.5 * scale, right.y - 29.0 * scale),
                        ],
                        stroke,
                    );
                    ui.painter().line_segment(
                        [
                            egui::pos2(left.x + 4.5 * scale, left.y - 33.0 * scale),
                            egui::pos2(right.x + 4.5 * scale, right.y - 29.0 * scale),
                        ],
                        stroke,
                    );
                }
                ui.add_space(16.0);

                ui.allocate_ui_with_layout(
                    Vec2::new(info_width, 132.0),
                    Layout::top_down(Align::Min),
                    |ui| {
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
                        ui.add_space(1.0);
                        ui.add(
                            egui::Label::new(
                                RichText::new(current.map(|i| i.label()).unwrap_or_default())
                                    .family(semibold())
                                    .size(19.0)
                                    .color(TEXT),
                            )
                            .truncate(),
                        );
                        ui.add_space(1.0);
                        let mut meta = String::new();
                        if let Some(item) = current {
                            if !item.user_login.trim().is_empty() && item.user_login != "manual" {
                                meta.push_str(&format!("заказал @{}", item.user_login));
                                meta.push_str(" · ");
                            }
                            meta.push_str(if item.channel.trim().is_empty() {
                                "YouTube"
                            } else {
                                &item.channel
                            });
                            if item.duration_sec > 0 {
                                meta.push_str(&format!(
                                    " · {}",
                                    music::ytdlp::format_duration(item.duration_sec)
                                ));
                            }
                        }
                        ui.label(RichText::new(meta).size(12.8).color(TEXT_DIM));
                    } else {
                        ui.label(
                            RichText::new("Ничего не играет")
                                .family(semibold())
                                .size(19.0)
                                .color(TEXT),
                        );
                        ui.add_space(3.0);
                        hint(
                            ui,
                            if snapshot.ytdlp_version.is_some() {
                                "Активируйте награду на канале — трек встанет в очередь"
                            } else {
                                "yt-dlp не найден — заявки пока не принимаются"
                            },
                        );
                    }

                    ui.add_space(7.0);
                    let total = if playing { snapshot.player.duration_sec } else { 0 };
                    let position = if playing {
                        snapshot.player.position_sec.min(total.max(1))
                    } else {
                        0
                    };
                    ui.horizontal(|ui| {
                        ui.allocate_ui_with_layout(
                            Vec2::new(30.0, 14.0),
                            Layout::left_to_right(Align::Center),
                            |ui| {
                                ui.label(
                                    RichText::new(music::ytdlp::format_duration(position))
                                        .size(11.0)
                                        .color(TEXT_DIM),
                                );
                            },
                        );
                        ui.add_space(10.0);
                        let bar_width = (ui.available_width() - 46.0).max(120.0);
                        if total > 0 {
                            if let Some(target) =
                                music_progress_width(ui, position, total, bar_width)
                            {
                                self.music.seek(target);
                                self.touch();
                            }
                        } else {
                            let (rect, _) =
                                ui.allocate_exact_size(Vec2::new(bar_width, 14.0), Sense::hover());
                            ui.painter().rect_filled(
                                egui::Rect::from_center_size(
                                    rect.center(),
                                    Vec2::new(rect.width(), 2.0),
                                ),
                                Rounding::same(1.0),
                                with_alpha(Color32::WHITE, 40),
                            );
                        }
                        ui.add_space(10.0);
                        ui.label(
                            RichText::new(music::ytdlp::format_duration(total))
                                .size(11.0)
                                .color(TEXT_DIM),
                        );
                    });

                    ui.add_space(8.0);
                    ui.horizontal(|ui| {
                        ui.spacing_mut().item_spacing.x = 9.0;
                        if ui
                            .add_enabled_ui(playing, |ui| {
                                player_icon_button(ui, PlayerIcon::Restart)
                            })
                            .inner
                            .on_hover_text("Сначала")
                            .clicked()
                        {
                            restart = true;
                        }
                        let icon = if snapshot.player.paused {
                            PlayerIcon::Play
                        } else {
                            PlayerIcon::Pause
                        };
                        if ui
                            .add_enabled_ui(playing, |ui| player_icon_button(ui, icon))
                            .inner
                            .on_hover_text(if snapshot.player.paused {
                                "Продолжить"
                            } else {
                                "Пауза"
                            })
                            .clicked()
                        {
                            toggle_pause = true;
                        }
                        if ui
                            .add_enabled_ui(playing, |ui| player_icon_button(ui, PlayerIcon::Skip))
                            .inner
                            .on_hover_text("Пропустить трек")
                            .clicked()
                        {
                            skip = true;
                        }
                        ui.add_space(3.0);
                        if ghost_button(ui, "Пропустить трек", TEXT_DIM).clicked() {
                            skip = true;
                        }
                    });
                    },
                );

                ui.add_space(16.0);
                let (line_rect, _) = ui.allocate_exact_size(
                    Vec2::new(1.0, 128.0),
                    Sense::hover(),
                );
                ui.painter().rect_filled(
                    line_rect,
                    Rounding::ZERO,
                    with_alpha(Color32::WHITE, 18),
                );
                ui.add_space(16.0);

                ui.allocate_ui_with_layout(
                    Vec2::new(right_width, 132.0),
                    Layout::top_down(Align::Min),
                    |ui| {
                    ui.label(
                        RichText::new("Громкость музыки")
                            .size(11.0)
                            .color(TEXT_DIM),
                    );
                    ui.add_space(6.0);
                    ui.horizontal(|ui| {
                        let mut volume = self.settings.music.music_volume as f32;
                        let changed = fader(ui, &mut volume, 0.0, 1.0, 120.0).changed();
                        let volume = volume as f64;
                        ui.add_space(6.0);
                        ui.label(
                            RichText::new(util::format_volume(
                                self.settings.music.music_volume as f32,
                            ))
                            .size(12.0)
                            .color(Color32::from_rgb(0xDA, 0xDA, 0xDA)),
                        );
                        if changed {
                            self.settings.music.music_volume = volume;
                            self.music.set_volume(volume as f32);
                            self.mark_dirty();
                        }
                    });
                    ui.add_space(6.0);
                    ui.label(
                        RichText::new("Не меняет громкость Windows — только очередь.")
                            .size(11.2)
                            .color(with_alpha(TEXT_DIM, 190)),
                    );
                    ui.add_space(8.0);
                    if let Some(next) = snapshot
                        .items
                        .iter()
                        .find(|item| item.state == ItemState::Queued)
                    {
                        ui.add(
                            egui::Label::new(
                                RichText::new(format!("Следующий: {}", next.label()))
                                    .size(10.8)
                                    .color(TEXT_DIM),
                            )
                            .truncate(),
                        );
                    } else {
                        ui.label(RichText::new("Следующий: —").size(10.8).color(TEXT_DIM));
                    }
                    },
                );
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
start = s.index("    /// Карточка плеера по макету")
end = s.index("    fn apply_music_price(")
s = s[:start] + PLAYER + s[end:]

P.write_text(s, encoding="utf-8")
print("player exact")
