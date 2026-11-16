# -*- coding: utf-8 -*-
"""Модальные диалоги, клавиатура, фокус, шапка со статусами."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
src = P.read_text(encoding="utf-8")


def replace_between(text: str, start_marker: str, end_marker: str, new: str) -> str:
    start = text.index(start_marker)
    end = text.index(end_marker, start)
    return text[:start] + new + text[end:]


HEADER = r'''    fn header(&mut self, ctx: &egui::Context) {
        let connected =
            self.settings.twitch.is_connected() || self.twitch_state == TwitchState::Connected;
        let account = self.settings.twitch.account_label();
        let (listen_text, listen_color) = self.eventsub_status();
        let muted = self.settings.muted;
        let volume_percent = self.settings.volume_label();
        let mut toggle_mute = false;
        let mut go_settings = false;

        egui::TopBottomPanel::top("header")
            .frame(
                egui::Frame::none()
                    .fill(BG)
                    .inner_margin(egui::Margin::symmetric(24.0, 14.0)),
            )
            .show(ctx, |ui| {
                ui.horizontal(|ui| {
                    let color = if connected { SUCCESS } else { TEXT_DIM };
                    ui.label(RichText::new("●").size(10.8).color(color));
                    ui.label(
                        RichText::new(if connected {
                            format!("Подключено · {account}")
                        } else {
                            "Twitch не подключён".to_string()
                        })
                        .size(13.8)
                        .color(TEXT_DIM),
                    );

                    if connected {
                        ui.add_space(6.0);
                        ui.label(
                            RichText::new("·")
                                .size(13.0)
                                .color(with_alpha(TEXT_DIM, 120)),
                        );
                        ui.add_space(4.0);
                        let status = ui
                            .add(
                                egui::Label::new(
                                    RichText::new(format!("● {listen_text}"))
                                        .size(13.2)
                                        .color(listen_color),
                                )
                                .sense(Sense::click()),
                            )
                            .on_hover_text("Открыть настройки прослушивания");
                        if status.clicked() {
                            go_settings = true;
                        }
                        if !self.playing.is_empty() {
                            ui.add_space(8.0);
                            ui.label(
                                RichText::new(format!("звучит: {}", self.playing.len()))
                                    .size(12.4)
                                    .color(SUCCESS),
                            );
                        }
                    }

                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        self.twitch_pill(ui);
                        ui.add_space(16.0);

                        ui.label(
                            RichText::new(if muted {
                                "БЕЗ ЗВУКА".to_string()
                            } else {
                                volume_percent.clone()
                            })
                            .size(14.4)
                            .color(if muted { WARN } else { TEXT }),
                        );

                        let mut volume = self.settings.volume;
                        ui.spacing_mut().slider_width = 128.0;
                        let response = ui.add(
                            egui::Slider::new(&mut volume, 0.0..=1.0)
                                .show_value(false)
                                .trailing_fill(true),
                        );
                        if response.changed() {
                            self.settings.volume = volume;
                            self.settings.muted = false;
                            self.apply_volume();
                            self.mark_dirty();
                            self.touch();
                        }

                        if icon_button(
                            ui,
                            if muted {
                                UiIcon::VolumeMuted
                            } else {
                                UiIcon::Volume
                            },
                            if muted {
                                "Включить звук"
                            } else {
                                "Выключить звук"
                            },
                            30.0,
                        )
                        .clicked()
                        {
                            toggle_mute = true;
                        }

                        ui.label(
                            RichText::new("ЗВУК")
                                .size(11.4)
                                .color(with_alpha(TEXT_DIM, 190)),
                        );
                    });
                });
            });

        if toggle_mute {
            self.settings.muted = !self.settings.muted;
            self.apply_volume();
            self.mark_dirty();
            self.notify(
                if self.settings.muted {
                    "Звук выключен."
                } else {
                    "Звук включён."
                },
                ToastKind::Info,
            );
            self.touch();
        }
        if go_settings {
            self.tab = Tab::Settings;
            self.touch();
        }
    }

'''

# --- шапка ---
src = replace_between(src, "    fn header(&mut self, ctx: &egui::Context) {", "    fn sidebar(&mut self, ctx: &egui::Context) {", HEADER)

# --- редактор: модальность, Esc/Enter, фокус ---
old = """        let is_edit = editor.id.is_some();
        let mut submit = false;
        let mut cancel = false;
"""
new = """        let is_edit = editor.id.is_some();
        let mut submit = false;
        let mut cancel = false;

        modal_scrim(ctx);
        if ctx.input(|input| input.key_pressed(egui::Key::Escape)) && !editor.pending {
            cancel = true;
        }
        let submit_on_enter = ctx.input(|input| input.key_pressed(egui::Key::Enter));
"""
assert old in src
src = src.replace(old, new, 1)

old = """                ui.add_sized(
                    [ui.available_width(), 40.0],
                    egui::TextEdit::singleline(&mut editor.title)
                        .char_limit(45)
                        .hint_text("Например, «Сменить игру»"),
                );
"""
new = """                let title_edit = ui.add_sized(
                    [ui.available_width(), 40.0],
                    egui::TextEdit::singleline(&mut editor.title)
                        .char_limit(45)
                        .hint_text("Например, «Сменить игру»"),
                );
                if editor.focus_title {
                    title_edit.request_focus();
                    editor.focus_title = false;
                }
"""
assert old in src
src = src.replace(old, new, 1)

old = """        if submit {
            editor.pending = true;
            editor.error = None;
"""
new = """        if submit_on_enter && !editor.pending && !cancel {
            submit = true;
        }
        if submit {
            editor.pending = true;
            editor.error = None;
"""
assert old in src
src = src.replace(old, new, 1)

# --- удаление: модальность, Esc, текст про локальную привязку ---
old = """        let mut confirm = false;
        let mut cancel = false;

        egui::Window::new("Удалить награду?")
            .collapsible(false)
            .resizable(false)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .show(ctx, |ui| {
                ui.set_width(420.0);
                ui.add(
                    egui::Label::new(
                        RichText::new(format!("Удалить награду «{}» на Twitch?", reward.title))
                            .size(15.6)
                            .color(TEXT),
                    )
                    .wrap(),
                );
                ui.add_space(4.0);
                ui.label(
                    RichText::new("Действие необратимо: награда исчезнет у зрителей.")
                        .size(13.8)
                        .color(DANGER),
                );
"""
new = """        let mut confirm = false;
        let mut cancel = false;

        modal_scrim(ctx);
        if ctx.input(|input| input.key_pressed(egui::Key::Escape)) && !self.reward_busy {
            cancel = true;
        }

        egui::Window::new("Удалить награду?")
            .collapsible(false)
            .resizable(false)
            .movable(false)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .show(ctx, |ui| {
                ui.set_width(420.0);
                ui.add(
                    egui::Label::new(
                        RichText::new(format!("Удалить награду «{}» на Twitch?", reward.title))
                            .size(15.6)
                            .color(TEXT),
                    )
                    .wrap(),
                );
                ui.add_space(4.0);
                ui.label(
                    RichText::new("Действие необратимо: награда исчезнет у зрителей.")
                        .size(13.8)
                        .color(DANGER),
                );
                ui.add_space(6.0);
                paragraph(
                    ui,
                    "Локальная привязка звука останется в «Локальных привязках» — файл не удалится.",
                    TEXT_DIM,
                    13.2,
                );
"""
assert old in src
src = src.replace(old, new, 1)

# Открытие редактора не должно оставлять открытым удаление.
old = """    fn open_create_reward(&mut self) {
        self.reward_editor = Some(RewardEditor {
"""
new = """    fn open_create_reward(&mut self) {
        self.reward_delete = None;
        self.reward_editor = Some(RewardEditor {
"""
assert old in src
src = src.replace(old, new, 1)

P.write_text(src, encoding="utf-8")
print("modal + header patched, length", len(src))
