# -*- coding: utf-8 -*-
"""Пересборка плеера под макет + детали музыки."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")


def sub(old: str, new: str) -> None:
    global s
    assert old in s, "NOT FOUND: " + old[:120]
    s = s.replace(old, new, 1)


# ---------------------------------------------------------------- player_icon_button
start = s.index("/// Круглая кнопка плеера: рисунок линиями, при наведении инверсия.")
end = s.index("fn card_frame() -> egui::Frame")
new_icon = r'''/// Круглая кнопка плеера: назад/дальше — тёмные, пауза/плей — белая.
fn player_icon_button(ui: &mut egui::Ui, icon: PlayerIcon) -> egui::Response {
    let primary = matches!(icon, PlayerIcon::Play | PlayerIcon::Pause);
    let size = if primary { 36.0 } else { 30.0 };
    let (rect, response) = ui.allocate_exact_size(Vec2::splat(size), Sense::click());
    let rect = snap_rect(ui, rect);
    let hovered = response.hovered() && ui.is_enabled();
    let painter = ui.painter();

    let (fill, glyph) = if primary {
        (if hovered { with_alpha(TEXT, 220) } else { TEXT }, BG)
    } else if hovered {
        (with_alpha(Color32::WHITE, 16), TEXT)
    } else {
        (with_alpha(Color32::WHITE, 8), TEXT_DIM)
    };
    painter.circle_filled(rect.center(), size * 0.5, fill);

    let stroke = Stroke::new(1.8_f32, glyph);
    let center = rect.center();
    let point = |dx: f32, dy: f32| egui::pos2(center.x + dx, center.y + dy);

    match icon {
        PlayerIcon::Restart => {
            painter.line_segment([point(-5.0, -4.5), point(-5.0, 4.5)], stroke);
            painter.add(egui::Shape::convex_polygon(
                vec![point(5.0, -4.5), point(5.0, 4.5), point(-3.5, 0.0)],
                glyph,
                Stroke::NONE,
            ));
        }
        PlayerIcon::Play => {
            painter.add(egui::Shape::convex_polygon(
                vec![point(-3.5, -5.5), point(-3.5, 5.5), point(5.5, 0.0)],
                glyph,
                Stroke::NONE,
            ));
        }
        PlayerIcon::Pause => {
            for dx in [-3.0_f32, 3.0] {
                painter.rect_filled(
                    egui::Rect::from_center_size(point(dx, 0.0), Vec2::new(3.4, 11.0)),
                    Rounding::same(1.5),
                    glyph,
                );
            }
        }
        PlayerIcon::Skip => {
            painter.add(egui::Shape::convex_polygon(
                vec![point(-5.0, -4.5), point(-5.0, 4.5), point(3.0, 0.0)],
                glyph,
                Stroke::NONE,
            ));
            painter.line_segment([point(4.5, -4.5), point(4.5, 4.5)], stroke);
        }
    }

    response
}

'''
s = s[:start] + new_icon + s[end:]

# ---------------------------------------------------------------- progress helper
sub("""fn music_progress(ui: &mut egui::Ui, position: u64, duration: u64) -> Option<u64> {
    let width = ui.available_width().max(120.0);
    let (rect, response) = ui.allocate_exact_size(Vec2::new(width, 22.0), Sense::click_and_drag());
""",
"""fn music_progress(ui: &mut egui::Ui, position: u64, duration: u64) -> Option<u64> {
    let width = ui.available_width().max(120.0);
    music_progress_width(ui, position, duration, width)
}

fn music_progress_width(
    ui: &mut egui::Ui,
    position: u64,
    duration: u64,
    width: f32,
) -> Option<u64> {
    let (rect, response) = ui.allocate_exact_size(Vec2::new(width, 18.0), Sense::click_and_drag());
""")

# ---------------------------------------------------------------- player card
start = s.index("    /// Карточка плеера. Раскладка повторяет макет")
end = s.index("    fn apply_music_price(")
new_player = r'''    /// Карточка плеера по макету: обложка, трек, строка прогресса с временем,
    /// кнопки и «Пропустить трек» слева; громкость и следующий — справа.
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
            .inner_margin(egui::Margin::symmetric(16.0, 13.0))
            .show(ui, |ui| {
            ui.set_width(ui.available_width());
            let total_width = ui.available_width();
            ui.horizontal_top(|ui| {
                let right_width = 208.0;
                let left_width = (total_width - right_width - 28.0).max(300.0);

                ui.allocate_ui_with_layout(
                    Vec2::new(left_width, 150.0),
                    Layout::top_down(Align::Min),
                    |ui| {
                    ui.horizontal(|ui| {
                        let (art_rect, _) =
                            ui.allocate_exact_size(Vec2::splat(86.0), Sense::hover());
                        ui.painter().rect_filled(
                            art_rect,
                            Rounding::same(20.0),
                            with_alpha(ACCENT, 22),
                        );
                        {
                            let scale = art_rect.width() / 86.0;
                            let ink = with_alpha(TEXT, 190);
                            let stroke = Stroke::new(2.2 * scale, ink);
                            let c = art_rect.center();
                            let left = egui::pos2(c.x - 18.0 * scale, c.y + 18.0 * scale);
                            let right = egui::pos2(c.x + 8.0 * scale, c.y + 12.0 * scale);
                            ui.painter().circle_filled(left, 5.5 * scale, ink);
                            ui.painter().circle_filled(right, 5.5 * scale, ink);
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
                        ui.add_space(12.0);
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
                                        .size(21.0)
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
                                    ui.label(RichText::new(meta).size(12.2).color(TEXT_DIM));
                                }
                            } else {
                                ui.label(
                                    RichText::new("Ничего не играет")
                                        .family(semibold())
                                        .size(21.0)
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
                    });

                    ui.add_space(8.0);
                    let total = if playing { snapshot.player.duration_sec } else { 0 };
                    let position = if playing {
                        snapshot.player.position_sec.min(total.max(1))
                    } else {
                        0
                    };
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new(music::ytdlp::format_duration(position))
                                .size(11.6)
                                .color(TEXT_DIM),
                        );
                        ui.add_space(6.0);
                        let bar_width = (ui.available_width() - 56.0).max(100.0);
                        if total > 0 {
                            if let Some(target) = music_progress_width(ui, position, total, bar_width)
                            {
                                self.music.seek(target);
                                self.touch();
                            }
                        } else {
                            let (rect, _) =
                                ui.allocate_exact_size(Vec2::new(bar_width, 18.0), Sense::hover());
                            ui.painter().rect_filled(
                                egui::Rect::from_center_size(
                                    rect.center(),
                                    Vec2::new(rect.width(), 4.0),
                                ),
                                Rounding::same(2.0),
                                with_alpha(TEXT_DIM, 60),
                            );
                        }
                        ui.add_space(6.0);
                        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                            ui.label(
                                RichText::new(music::ytdlp::format_duration(total))
                                    .size(11.6)
                                    .color(TEXT_DIM),
                            );
                        });
                    });

                    ui.add_space(8.0);
                    ui.horizontal(|ui| {
                        ui.spacing_mut().item_spacing.x = 8.0;
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
                        if ghost_button(ui, "Пропустить трек", TEXT_DIM).clicked() {
                            skip = true;
                        }
                    });
                    },
                );

                ui.add_space(12.0);
                let (line_rect, _) = ui.allocate_exact_size(
                    Vec2::new(1.0, 128.0),
                    Sense::hover(),
                );
                ui.painter().rect_filled(
                    line_rect,
                    Rounding::ZERO,
                    with_alpha(Color32::WHITE, 22),
                );
                ui.add_space(12.0);

                ui.allocate_ui_with_layout(
                    Vec2::new(right_width, 150.0),
                    Layout::top_down(Align::Min),
                    |ui| {
                    ui.label(
                        RichText::new("Громкость музыки")
                            .size(11.8)
                            .color(TEXT_DIM),
                    );
                    ui.add_space(4.0);
                    ui.horizontal(|ui| {
                        let mut volume = self.settings.music.music_volume as f32;
                        let changed = fader(ui, &mut volume, 0.0, 1.0, right_width - 54.0).changed();
                        let volume = volume as f64;
                        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                            ui.label(
                                RichText::new(util::format_volume(
                                    self.settings.music.music_volume as f32,
                                ))
                                .size(11.8)
                                .color(TEXT),
                            );
                        });
                        if changed {
                            self.settings.music.music_volume = volume;
                            self.music.set_volume(volume as f32);
                            self.mark_dirty();
                        }
                    });
                    ui.add_space(3.0);
                    hint(ui, "Не меняет громкость Windows — только очередь.");
                    ui.add_space(5.0);
                    if let Some(next) = snapshot
                        .items
                        .iter()
                        .find(|item| item.state == ItemState::Queued)
                    {
                        ui.add(
                            egui::Label::new(
                                RichText::new(format!("Следующий: {}", next.label()))
                                    .size(11.2)
                                    .color(TEXT_DIM),
                            )
                            .truncate(),
                        );
                    } else {
                        ui.label(RichText::new("Следующий: —").size(11.2).color(TEXT_DIM));
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
s = s[:start] + new_player + s[end:]

# ---------------------------------------------------------------- status/ok pill helpers
anchor = "/// Чип-фильтр с числом: заменяет стат-карточки и работает как фильтр."
helpers = r'''/// Статусная «таблетка» с точкой, как в макете.
fn status_pill(ui: &mut egui::Ui, text: &str, color: Color32) -> egui::Response {
    let font = FontId::new(13.8, egui::FontFamily::Proportional);
    let width = ui
        .painter()
        .layout_no_wrap(text.to_owned(), font.clone(), TEXT)
        .size()
        .x;
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(width + 44.0, 32.0), Sense::click());
    let rect = snap_rect(ui, rect);
    let enabled = ui.is_enabled();
    let hovered = response.hovered() && enabled;
    ui.painter().rect_filled(
        rect,
        Rounding::same(16.0),
        if !enabled {
            with_alpha(color, 8)
        } else if hovered {
            color
        } else {
            with_alpha(color, 24)
        },
    );
    let dot_color = if hovered && enabled { BG } else { color };
    ui.painter().circle_filled(
        egui::pos2(rect.left() + 17.0, rect.center().y),
        4.0,
        dot_color,
    );
    ui.painter().text(
        egui::pos2(rect.left() + 27.0, rect.center().y),
        Align2::LEFT_CENTER,
        text,
        font,
        if !enabled {
            with_alpha(color, 110)
        } else if hovered {
            BG
        } else {
            color
        },
    );
    response
}

/// Маленький зелёный чип «готово» с галочкой.
fn ok_chip(ui: &mut egui::Ui, text: &str) -> egui::Response {
    let font = FontId::new(11.6, egui::FontFamily::Proportional);
    let width = ui
        .painter()
        .layout_no_wrap(text.to_owned(), font.clone(), SUCCESS)
        .size()
        .x;
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(width + 34.0, 26.0), Sense::hover());
    let rect = snap_rect(ui, rect);
    ui.painter().rect_filled(rect, Rounding::same(13.0), with_alpha(SUCCESS, 22));
    ui.painter().text(
        egui::pos2(rect.left() + 12.0, rect.center().y),
        Align2::LEFT_CENTER,
        "✓",
        FontId::new(11.0, egui::FontFamily::Proportional),
        SUCCESS,
    );
    ui.painter().text(
        egui::pos2(rect.left() + 24.0, rect.center().y),
        Align2::LEFT_CENTER,
        text,
        font,
        SUCCESS,
    );
    response
}

/// Чип со счётчиком (например, «1 играет»).
fn queue_count_chip(ui: &mut egui::Ui, count: usize, state: ItemState) -> egui::Response {
    let color = match state {
        ItemState::Loading => WARN,
        ItemState::Playing => SUCCESS,
        _ => TEXT_DIM,
    };
    let text = format!("{count} {}", state.label());
    let font = FontId::new(11.0, egui::FontFamily::Proportional);
    let width = ui
        .painter()
        .layout_no_wrap(text.clone(), font.clone(), color)
        .size()
        .x;
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(width + 18.0, 22.0), Sense::hover());
    ui.painter().rect_filled(rect, Rounding::same(11.0), with_alpha(color, 24));
    ui.painter().text(
        rect.center(),
        Align2::CENTER_CENTER,
        text,
        font,
        color,
    );
    response
}

'''
assert anchor in s
s = s.replace(anchor, helpers + anchor, 1)

# ---------------------------------------------------------------- music header
sub('"Треки по заявке из чата: зритель присылает ссылку на YouTube"',
    '"Треки по заявке: зритель присылает ссылку на YouTube в чат"')
sub("""                let pill = pill_button(ui, status_label, status_color);
                let pill = pill.on_hover_text("Нажмите, чтобы включить или выключить приём заявок");
""",
"""                let pill = status_pill(ui, status_label, status_color);
                let pill = pill.on_hover_text("Нажмите, чтобы включить или выключить приём заявок");
""")
# yt-dlp зелёным чипом
sub("""                if let Some(version) = snapshot.ytdlp_version.as_ref() {
                    ui.add(
                        egui::Label::new(
                            RichText::new(format!("yt-dlp {version}"))
                                .size(12.2)
                                .color(TEXT_DIM),
                        ),
                    )
                    .on_hover_text("Найден и готов к загрузке треков");
                } else {
""",
"""                if let Some(version) = snapshot.ytdlp_version.as_ref() {
                    ok_chip(ui, &format!("yt-dlp {version}"))
                        .on_hover_text("Найден и готов к загрузке треков");
                } else {
""")

# ---------------------------------------------------------------- queue count chips
sub("""                if playing > 0 {
                    ui.add_space(4.0);
                    queue_state_chip(ui, ItemState::Playing);
                    let _ = playing;
                }
                if loading > 0 {
                    ui.add_space(2.0);
                    queue_state_chip(ui, ItemState::Loading);
                }
""",
"""                if playing > 0 {
                    ui.add_space(4.0);
                    queue_count_chip(ui, playing, ItemState::Playing);
                }
                if loading > 0 {
                    ui.add_space(2.0);
                    queue_count_chip(ui, loading, ItemState::Loading);
                }
""")

# ---------------------------------------------------------------- prefetch mark on row
sub("""                                let chip = queue_state_chip(ui, item.state);
                                if let Some(error) = item.error.as_ref() {
                                    chip.on_hover_text(error);
                                }
""",
"""                                if let Some(prefetched) = snapshot.prefetched.as_ref() {
                                    if &item.video_id == prefetched {
                                        ui.label(
                                            RichText::new("предзагрузка")
                                                .size(10.4)
                                                .color(SUCCESS),
                                        );
                                    }
                                }
                                let chip = queue_state_chip(ui, item.state);
                                if let Some(error) = item.error.as_ref() {
                                    chip.on_hover_text(error);
                                }
""")

# ---------------------------------------------------------------- ручной ввод: плюс + подсказка
sub("""                egui::Frame::none()
                    .fill(BG)
                    .stroke(Stroke::new(1.0_f32, with_alpha(BORDER, 200)))
                    .rounding(Rounding::same(16.0))
                    .inner_margin(egui::Margin::symmetric(12.0, 4.0))
                    .show(ui, |ui| {
                        let response = ui.add(
""",
"""                egui::Frame::none()
                    .fill(BG)
                    .stroke(Stroke::new(1.0_f32, with_alpha(BORDER, 200)))
                    .rounding(Rounding::same(16.0))
                    .inner_margin(egui::Margin::symmetric(12.0, 4.0))
                    .show(ui, |ui| {
                        ui.label(RichText::new("+").size(15.0).color(TEXT_DIM));
                        let response = ui.add(
""")
sub("""                }
            });

        });

        ui.add_space(10.0);

        // ---- Нижний ряд: OBS и состояние ----""",
"""                }
            });
            ui.add_space(2.0);
            ui.label(
                RichText::new("Ручная очередь не тратит баллы зрителей — удобно для проверки.")
                    .size(11.0)
                    .color(with_alpha(TEXT_DIM, 190)),
            );

        });

        ui.add_space(10.0);

        // ---- Нижний ряд: OBS и состояние ----""")

# ---------------------------------------------------------------- OBS-карточка без «Браузер»
sub("""                        if ghost_button(ui, "Браузер", TEXT_DIM).clicked() {
                            open_overlay = true;
                        }
""", "")

P.write_text(s, encoding="utf-8")
print("player/queue rebuilt")
