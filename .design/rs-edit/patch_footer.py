# -*- coding: utf-8 -*-
import pathlib
P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
src = P.read_text(encoding="utf-8")
start = src.index("    fn footer(&mut self, ctx: &egui::Context) {")
end = src.index("    fn twitch_pill(&mut self, ui: &mut egui::Ui) {")
new = '''    fn footer(&mut self, ctx: &egui::Context) {
        let audio_ready = self.audio.is_ready();
        let toast = self
            .current_toast()
            .map(|(text, color)| (text.to_string(), color));
        let has_toast = toast.is_some();
        let mut dismiss = false;

        egui::TopBottomPanel::bottom("footer")
            .frame(
                egui::Frame::none()
                    .fill(BG)
                    .inner_margin(egui::Margin::symmetric(24.0, 8.0)),
            )
            .show(ctx, |ui| {
                ui.horizontal(|ui| {
                    match &toast {
                        Some((text, color)) => {
                            ui.label(RichText::new("•").size(12.0).color(*color));
                            ui.add_space(2.0);
                            let label = ui.add(
                                egui::Label::new(
                                    RichText::new(text).size(13.2).color(*color),
                                )
                                .truncate(),
                            );
                            if label.hovered() {
                                label.on_hover_text(text);
                            }
                        }
                        None => {
                            let (text, color) = if audio_ready {
                                ("Готово".to_string(), with_alpha(TEXT_DIM, 170))
                            } else {
                                (
                                    "Аудиовыход недоступен — откройте настройки".to_string(),
                                    DANGER,
                                )
                            };
                            ui.add(
                                egui::Label::new(RichText::new(text).size(13.2).color(color))
                                    .truncate(),
                            );
                        }
                    }

                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        ui.label(
                            RichText::new("REWARD SOUNDS")
                                .size(10.2)
                                .color(with_alpha(TEXT_DIM, 120)),
                        );
                        if has_toast
                            && icon_button(ui, UiIcon::X, "Скрыть уведомление", 22.0).clicked()
                        {
                            dismiss = true;
                        }
                    });
                });
            });

        if dismiss {
            self.toast = None;
            self.touch();
        }
    }

'''
src = src[:start] + new + src[end:]
P.write_text(src, encoding="utf-8")
print("footer rewritten")