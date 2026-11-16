# -*- coding: utf-8 -*-
"""Настройки: индикатор сохранения, подтверждения, трей, нормализация."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
src = P.read_text(encoding="utf-8")


def sub_once(old: str, new: str) -> None:
    global src
    assert old in src, "NOT FOUND: " + old[:80]
    src = src.replace(old, new, 1)


# 1. Индикатор сохранения в заголовке настроек.
sub_once(
    """    fn settings_tab(&mut self, ui: &mut egui::Ui) {
        ui.label(
            RichText::new("Настройки")
                .family(semibold())
                .size(36.0)
                .strong()
                .color(TEXT),
        );
        ui.label(
            RichText::new("Изменения сохраняются автоматически")
                .size(14.4)
                .color(TEXT_DIM),
        );
        ui.add_space(12.0);
""",
    """    fn settings_tab(&mut self, ui: &mut egui::Ui) {
        let (save_text, save_color) = if self.save_at.is_some() {
            ("Сохраняем…", WARN)
        } else if self
            .saved_at
            .map(|at| at.elapsed() < Duration::from_secs(4))
            .unwrap_or(false)
        {
            ("✓ Сохранено", SUCCESS)
        } else {
            ("Изменения сохраняются автоматически", TEXT_DIM)
        };

        ui.label(
            RichText::new("Настройки")
                .family(semibold())
                .size(36.0)
                .strong()
                .color(TEXT),
        );
        ui.label(RichText::new(save_text).size(14.4).color(save_color));
        ui.add_space(12.0);
""",
)

# 2. «Свернуть в трей» — через тот же путь, что и закрытие окна.
sub_once(
    """                {
                    ui.ctx().send_viewport_cmd(egui::ViewportCommand::Visible(false));
                    self.window_visible = false;
                    self.touch();
                }""",
    """                {
                    self.hide_to_tray(ui.ctx());
                }""",
)

# 3. Отключение Twitch — через подтверждение.
sub_once(
    """        if disconnect {
            self.disconnect_twitch();
        }
""",
    """        if disconnect {
            self.confirm = Some(ConfirmDialog {
                title: "Отключить Twitch?".to_string(),
                text: "Приложение перестанет получать активации наград, пока вы снова не войдёте. Привязки звуков и локальные файлы останутся на месте.".to_string(),
                confirm_label: "Отключить".to_string(),
                action: ConfirmAction::DisconnectTwitch,
                danger: true,
            });
            self.touch();
        }
""",
)

# 4. Двойной отступ в подключённом состоянии.
sub_once(
    """        ui.add_space(8.0);
        ui.add_space(8.0);
        let mut refresh = false;
""",
    """        ui.add_space(8.0);
        let mut refresh = false;
""",
)

# 5. Выравнивание громкости — предупреждение перед перезаписью.
sub_once(
    """                {
                    self.start_normalize();
                }
                if self.normalizing {""",
    """                {
                    self.confirm = Some(ConfirmDialog {
                        title: "Выровнять громкость звуков?".to_string(),
                        text: "Приложение измерит громкость каждого файла и перезапишет индивидуальные ползунки громкости. Текущие значения можно будет вернуть только вручную.".to_string(),
                        confirm_label: "Выровнять".to_string(),
                        action: ConfirmAction::NormalizeVolumes,
                        danger: false,
                    });
                    self.touch();
                }
                if self.normalizing {""",
)

P.write_text(src, encoding="utf-8")
print("settings patched, length", len(src))
