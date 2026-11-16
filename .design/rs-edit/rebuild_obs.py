# -*- coding: utf-8 -*-
"""OBS-окно в стиле приложения."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")

start = s.index("    /// Окно настроек оверлея для OBS: ссылка и параметры показа.\n    fn obs_window(")
end = s.index("    /// Карточка плеера. Раскладка повторяет макет")
new = r'''    /// Окно настроек оверлея для OBS: ссылка и параметры показа.
    fn obs_window(&mut self, ctx: &egui::Context) {
        if !self.obs_window_open {
            return;
        }
        modal_scrim(ctx);

        let mut close = false;
        let mut copy_url = false;
        let mut show_now = false;
        let mut open_browser = false;
        let url = "http://127.0.0.1:8770/overlay";

        egui::Window::new("obs-overlay")
            .id(egui::Id::new("obs-overlay-window"))
            .title_bar(false)
            .collapsible(false)
            .resizable(false)
            .movable(false)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .min_width(520.0)
            .max_width(520.0)
            .frame(
                egui::Frame::window(&ctx.style())
                    .fill(PANEL)
                    .rounding(Rounding::same(22.0))
                    .stroke(Stroke::new(1.0_f32, BORDER))
                    .inner_margin(egui::Margin::symmetric(26.0, 22.0)),
            )
            .show(ctx, |ui| {
                ui.set_width(ui.available_width());
                ui.horizontal(|ui| {
                    ui.label(
                        RichText::new("OBS — строка «Сейчас играет»")
                            .family(semibold())
                            .size(21.6)
                            .color(TEXT),
                    );
                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        if icon_button(ui, UiIcon::X, "Закрыть", 30.0).clicked() {
                            close = true;
                        }
                    });
                });
                ui.add_space(6.0);
                hint(
                    ui,
                    "Добавьте ссылку в OBS как источник «Браузер». Строка показывается, когда играет трек.",
                );

                ui.add_space(14.0);
                ui.label(
                    RichText::new("ССЫЛКА ДЛЯ ИСТОЧНИКА")
                        .size(11.2)
                        .color(with_alpha(TEXT_DIM, 210)),
                );
                ui.add_space(5.0);
                egui::Frame::none()
                    .fill(CARD)
                    .stroke(Stroke::new(1.0_f32, BORDER))
                    .rounding(Rounding::same(10.0))
                    .inner_margin(egui::Margin::symmetric(12.0, 7.0))
                    .show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        ui.horizontal(|ui| {
                            ui.label(
                                RichText::new(url)
                                    .size(12.6)
                                    .monospace()
                                    .color(TEXT),
                            );
                            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                                if icon_button(ui, UiIcon::Copy, "Скопировать", 26.0).clicked() {
                                    copy_url = true;
                                }
                            });
                        });
                    });

                ui.add_space(12.0);
                egui::Grid::new("obs-params")
                    .num_columns(2)
                    .spacing(Vec2::new(16.0, 10.0))
                    .show(ui, |ui| {
                        ui.label(
                            RichText::new("Показывать, секунд")
                                .size(13.2)
                                .color(TEXT_DIM),
                        );
                        ui.horizontal(|ui| {
                            let mut seconds = self.settings.music.overlay_seconds;
                            if ui
                                .add(
                                    egui::DragValue::new(&mut seconds)
                                        .range(0..=600)
                                        .speed(1.0),
                                )
                                .changed()
                            {
                                self.settings.music.overlay_seconds = seconds;
                                self.apply_music_config();
                                self.save_at =
                                    Some(Instant::now() + Duration::from_millis(350));
                            }
                            ui.label(
                                RichText::new("0 — показывать всё время, пока играет трек")
                                    .size(11.4)
                                    .color(with_alpha(TEXT_DIM, 180)),
                            );
                        });
                        ui.end_row();

                        ui.label(
                            RichText::new("Размер шрифта")
                                .size(13.2)
                                .color(TEXT_DIM),
                        );
                        ui.horizontal(|ui| {
                            let mut font = self.settings.music.overlay_font;
                            if ui
                                .add(
                                    egui::DragValue::new(&mut font)
                                        .range(12..=48)
                                        .speed(1.0),
                                )
                                .changed()
                            {
                                self.settings.music.overlay_font = font;
                                self.apply_music_config();
                                self.save_at =
                                    Some(Instant::now() + Duration::from_millis(350));
                            }
                            ui.label(RichText::new("px").size(11.6).color(TEXT_DIM));
                        });
                        ui.end_row();

                        ui.label(
                            RichText::new("Положение")
                                .size(13.2)
                                .color(TEXT_DIM),
                        );
                        ui.horizontal(|ui| {
                            let top = self.settings.music.overlay_position != "bottom";
                            if position_button(ui, "Сверху", top) {
                                self.settings.music.overlay_position = "top".to_string();
                                self.apply_music_config();
                                self.save_at =
                                    Some(Instant::now() + Duration::from_millis(350));
                            }
                            if position_button(ui, "Снизу", !top) {
                                self.settings.music.overlay_position = "bottom".to_string();
                                self.apply_music_config();
                                self.save_at =
                                    Some(Instant::now() + Duration::from_millis(350));
                            }
                        });
                        ui.end_row();
                    });

                ui.add_space(10.0);
                hint(
                    ui,
                    "Источник: ширина 1920, высота 200–300. «Обновлять при активации» и «Выключать, когда не виден» — выключить. Команда !трек в чате показывает строку ещё раз.",
                );

                ui.add_space(16.0);
                ui.horizontal(|ui| {
                    if secondary_button(ui, "Открыть в браузере").clicked() {
                        open_browser = true;
                    }
                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        if accent_button(ui, "Закрыть").clicked() {
                            close = true;
                        }
                        ui.add_space(8.0);
                        let show = ui
                            .add_enabled_ui(self.music_snapshot.current.is_some(), |ui| {
                                secondary_button(ui, "Показать сейчас")
                            })
                            .inner;
                        if show.clicked() {
                            show_now = true;
                        }
                    });
                });
            });

        if copy_url {
            ctx.output_mut(|output| output.copied_text = url.to_string());
            self.notify("Ссылка на оверлей скопирована", ToastKind::Success);
        }
        if show_now {
            self.music.show_overlay();
            self.notify("Строка показана в оверлее", ToastKind::Info);
        }
        if open_browser {
            let _ = webbrowser::open(url);
        }
        if close || ctx.input(|input| input.key_pressed(egui::Key::Escape)) {
            self.obs_window_open = false;
            self.touch();
        }
    }

'''
s = s[:start] + new + s[end:]

# helper: сегментная кнопка положения
anchor = "/// Чип-фильтр с числом: заменяет стат-карточки и работает как фильтр."
helper = r'''/// Кнопка выбора положения в OBS-окне.
fn position_button(ui: &mut egui::Ui, label: &str, active: bool) -> bool {
    let font = FontId::new(13.0, egui::FontFamily::Proportional);
    let text_width = ui
        .painter()
        .layout_no_wrap(label.to_owned(), font.clone(), TEXT)
        .size()
        .x;
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(text_width + 28.0, 30.0), Sense::click());
    let rect = snap_rect(ui, rect);
    let hovered = response.hovered();
    if active {
        ui.painter()
            .rect_filled(rect, Rounding::same(9.0), with_alpha(Color32::WHITE, 18));
        ui.painter().rect_filled(
            rect.shrink(1.0),
            Rounding::same(8.0),
            with_alpha(Color32::WHITE, 8),
        );
    } else if hovered {
        ui.painter()
            .rect_filled(rect, Rounding::same(9.0), with_alpha(Color32::WHITE, 7));
    }
    ui.painter().text(
        rect.center(),
        Align2::CENTER_CENTER,
        label,
        font,
        if active { TEXT } else { TEXT_DIM },
    );
    response.clicked()
}

'''
assert anchor in s
s = s.replace(anchor, helper + anchor, 1)

# открытие OBS закрывает музыкальные модалки
s = s.replace("""        if open_obs {
            self.obs_window_open = true;
            self.touch();
        }
""",
"""        if open_obs {
            self.music_price_open = false;
            self.music_settings_open = false;
            self.obs_window_open = true;
            self.touch();
        }
""", 1)
s = s.replace("""                        if secondary_button(ui, "Оверлей OBS").clicked() {
                            self.obs_window_open = true;
                        }
""",
"""                        if secondary_button(ui, "Оверлей OBS").clicked() {
                            self.music_settings_open = false;
                            self.obs_window_open = true;
                            close = true;
                        }
""", 1)

P.write_text(s, encoding="utf-8")
print("obs window rebuilt")
