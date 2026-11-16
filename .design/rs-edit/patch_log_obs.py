# -*- coding: utf-8 -*-
"""Журнал с фильтрами, адаптивная шапка музыки, OBS-окно."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
src = P.read_text(encoding="utf-8")


def replace_between(text: str, start_marker: str, end_marker: str, new: str) -> str:
    start = text.index(start_marker)
    end = text.index(end_marker, start)
    return text[:start] + new + text[end:]


LOG_TAB = r'''    fn log_tab(&mut self, ui: &mut egui::Ui) {
        let entries = self.logs.clone();
        let log_dir = self.paths.log_dir.clone();
        let log_file = self.paths.log_file.clone();
        let mut refresh = false;
        let mut open_dir = false;

        ui.horizontal(|ui| {
            ui.vertical(|ui| {
                ui.label(
                    RichText::new("Журнал")
                        .family(semibold())
                        .size(36.0)
                        .color(TEXT),
                );
                ui.label(
                    RichText::new("Последние события и ошибки приложения")
                        .size(14.4)
                        .color(TEXT_DIM),
                );
            });
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                if secondary_button(ui, "Открыть папку журнала").clicked() {
                    open_dir = true;
                }
                if secondary_button(ui, "Обновить").clicked() {
                    refresh = true;
                }
            });
        });

        ui.add_space(6.0);
        ui.horizontal_wrapped(|ui| {
            let mut show_debug = self.log_show_debug;
            if toggle(ui, &mut show_debug) {
                self.log_show_debug = show_debug;
                self.touch();
            }
            ui.label(RichText::new("Показывать отладку").size(13.0).color(TEXT_DIM));
            ui.add_space(10.0);
            let mut errors_only = self.log_errors_only;
            if toggle(ui, &mut errors_only) {
                self.log_errors_only = errors_only;
                self.touch();
            }
            ui.label(RichText::new("Только ошибки и предупреждения").size(13.0).color(TEXT_DIM));
            ui.add_space(10.0);
            let filtered_count = entries
                .iter()
                .filter(|entry| {
                    (!self.log_errors_only
                        || matches!(entry.level, log::Level::Error | log::Level::Warn))
                        && (self.log_show_debug || entry.level != log::Level::Debug)
                })
                .count();
            ui.label(
                RichText::new(format!("Записей: {filtered_count}"))
                    .size(12.6)
                    .color(TEXT_DIM),
            );
        });

        ui.add_space(6.0);
        ui.add(
            egui::Label::new(
                RichText::new(format!("Файл: {}", log_file.display()))
                    .size(13.2)
                    .monospace()
                    .color(TEXT_DIM),
            )
            .truncate(),
        )
        .on_hover_text(log_file.display().to_string());
        ui.add_space(10.0);

        egui::Frame::none()
            .fill(CARD)
            .stroke(Stroke::new(1.0_f32, with_alpha(BORDER, 160)))
            .rounding(Rounding::same(18.0))
            .inner_margin(egui::Margin::symmetric(12.0, 10.0))
            .show(ui, |ui| {
                egui::ScrollArea::vertical()
                    .auto_shrink([false, false])
                    .stick_to_bottom(true)
                    .show(ui, |ui| {
                        let visible: Vec<&LogEntry> = entries
                            .iter()
                            .filter(|entry| {
                                (!self.log_errors_only
                                    || matches!(
                                        entry.level,
                                        log::Level::Error | log::Level::Warn
                                    ))
                                    && (self.log_show_debug
                                        || entry.level != log::Level::Debug)
                            })
                            .collect();
                        if visible.is_empty() {
                            ui.label(
                                RichText::new("Под этот фильтр записей нет.")
                                    .size(14.4)
                                    .color(TEXT_DIM),
                            );
                            return;
                        }

                        for entry in visible {
                            // В памяти хранится полная метка «2026-11-16 22:15:35.123»:
                            // показываем дату и время, чтобы журнал читался после перезапуска.
                            let stamp = entry.time.get(..19).unwrap_or(&entry.time);
                            ui.horizontal_top(|ui| {
                                ui.label(
                                    RichText::new(stamp)
                                        .size(12.8)
                                        .monospace()
                                        .color(TEXT_DIM),
                                );
                                ui.add_sized(
                                    [86.0, 16.0],
                                    egui::Label::new(
                                        RichText::new(entry.level_label())
                                            .size(12.4)
                                            .color(level_color(entry.level)),
                                    ),
                                );
                                ui.add(
                                    egui::Label::new(
                                        RichText::new(&entry.message)
                                            .size(13.8)
                                            .monospace()
                                            .color(TEXT),
                                    )
                                    .wrap()
                                    .sense(Sense::click()),
                                );
                            });
                        }
                    });
            });

        if refresh {
            self.logs = self.logger.entries();
            self.log_refresh_at = Instant::now() + Duration::from_millis(800);
            self.touch();
        }
        if open_dir {
            util::open_in_explorer(&log_dir);
        }
    }
}

'''

src = replace_between(
    src,
    "    fn log_tab(&mut self, ui: &mut egui::Ui) {",
    "impl RewardSoundsApp {\n    // ---------- вкладка «Музыка» ----------",
    LOG_TAB,
)

# --- Адаптивная шапка музыки: заголовок, затем строка управления ---
old_start = """        // ---- Шапка ----
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
"""
new_header = """        // ---- Шапка ----
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
                pill.on_hover_text(if ready {
                    "Заявки принимаются: Twitch подключён, награда выбрана, yt-dlp найден."
                } else {
                    "Пока не всё готово — смотрите чек-лист ниже."
                });
            });
        });
        ui.add_space(10.0);
        ui.horizontal_wrapped(|ui| {
            let mut accept = self.settings.music.enabled;
            if toggle(ui, &mut accept) {
                self.settings.music.enabled = accept;
                self.music.set_paused(!accept);
                self.apply_music_config();
                self.mark_dirty();
                self.touch();
            }
            ui.label(RichText::new("Принимать заявки").size(13.6).color(TEXT_DIM));
            ui.add_space(8.0);
            if secondary_button(ui, "Оверлей OBS").clicked() {
                open_obs = true;
            }
        });
"""
assert old_start in src
src = src.replace(old_start, new_header, 1)

# --- OBS-окно: «Показать сейчас», «Открыть в браузере», честная подсказка про 0 ---
old = """                ui.horizontal(|ui| {
                    ui.label(RichText::new(url).size(12.6).monospace().color(TEXT));
                    if secondary_button(ui, "Скопировать").clicked() {
                        ui.output_mut(|output| output.copied_text = url.to_string());
                        self.notify("Ссылка на оверлей скопирована", ToastKind::Success);
                    }
                });
"""
new = """                ui.horizontal_wrapped(|ui| {
                    ui.label(RichText::new(url).size(12.6).monospace().color(TEXT));
                    if secondary_button(ui, "Скопировать").clicked() {
                        ui.output_mut(|output| output.copied_text = url.to_string());
                        self.notify("Ссылка на оверлей скопирована", ToastKind::Success);
                    }
                    let playing = self.music_snapshot.current.is_some();
                    let show = ui
                        .add_enabled_ui(playing, |ui| secondary_button(ui, "Показать сейчас"))
                        .inner;
                    if show.clicked() {
                        self.music.show_overlay();
                        self.notify("Строка показана в оверлее", ToastKind::Info);
                    }
                    if secondary_button(ui, "Открыть в браузере").clicked() {
                        let _ = webbrowser::open(url);
                    }
                });
"""
assert old in src
src = src.replace(old, new, 1)

old = """                    hint(ui, "0 — показывать всегда");
"""
new = """                    hint(ui, "0 — показывать всё время, пока играет трек");
"""
assert old in src
src = src.replace(old, new, 1)

P.write_text(src, encoding="utf-8")
print("log/music header/obs patched, length", len(src))
