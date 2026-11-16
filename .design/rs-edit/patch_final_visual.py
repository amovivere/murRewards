# -*- coding: utf-8 -*-
"""Финальные правки перед скриншотами: компактная шапка, id скроллов,
отключённый трей в демо, стартовые состояния для скриншотов."""
import pathlib

ROOT = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src")
P = ROOT / "app.rs"
TRAY = ROOT / "tray.rs"

src = P.read_text(encoding="utf-8")


def sub_once(old: str, new: str) -> None:
    global src
    assert old in src, "NOT FOUND: " + old[:100]
    src = src.replace(old, new, 1)


# --- Демо-флаг вычисляем один раз и переиспользуем ---
sub_once(
    """        let engine = AudioEngine::spawn();
""",
    """        let demo = std::env::var_os("REWARD_SOUNDS_DEMO").is_some();
        let engine = AudioEngine::spawn();
""",
)
sub_once(
    """            tray: tray::Tray::spawn(playback_enabled, cc.egui_ctx.clone()),""",
    """            tray: if demo {
                tray::Tray::disabled()
            } else {
                tray::Tray::spawn(playback_enabled, cc.egui_ctx.clone())
            },""",
)
sub_once(
    """            music_manual_input: String::new(),
            demo: std::env::var_os("REWARD_SOUNDS_DEMO").is_some(),
""",
    """            music_manual_input: String::new(),
            demo,
""",
)

# --- Компактная шапка при узком окне ---
sub_once(
    """            .show(ctx, |ui| {
                ui.horizontal(|ui| {
                    let color = if connected { SUCCESS } else { TEXT_DIM };
""",
    """            .show(ctx, |ui| {
                let compact = ui.available_width() < 820.0;
                ui.horizontal(|ui| {
                    let color = if connected { SUCCESS } else { TEXT_DIM };
""",
)
sub_once(
    """                    if connected {
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
""",
    """                    if connected && !compact {
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
""",
)
sub_once(
    """                        let mut volume = self.settings.volume;
                        ui.spacing_mut().slider_width = 128.0;
""",
    """                        let mut volume = self.settings.volume;
                        ui.spacing_mut().slider_width = if compact { 92.0 } else { 128.0 };
""",
)
sub_once(
    """                        ui.label(
                            RichText::new("ЗВУК")
                                .size(11.4)
                                .color(with_alpha(TEXT_DIM, 190)),
                        );
""",
    """                        if !compact {
                            ui.label(
                                RichText::new("ЗВУК")
                                    .size(11.4)
                                    .color(with_alpha(TEXT_DIM, 190)),
                            );
                        }
""",
)

# --- Кнопка «Обновить» вместо непонятной иконки ---
sub_once(
    """            if loading {
                ui.add(egui::Spinner::new().size(16.0));
                ui.label(RichText::new("Обновляем…").size(12.6).color(TEXT_DIM));
            } else if icon_button(ui, UiIcon::Refresh, "Обновить список", 34.0).clicked() {
                refresh_requested = true;
            }
""",
    """            if loading {
                ui.add(egui::Spinner::new().size(16.0));
                ui.label(RichText::new("Обновляем…").size(12.6).color(TEXT_DIM));
            } else if secondary_button(ui, "Обновить").clicked() {
                refresh_requested = true;
            }
""",
)

# --- Уникальные id у прокручиваемых областей ---
src = src.replace(
    """                egui::ScrollArea::vertical()
                    .auto_shrink([false, false])
                    .show(ui, |ui| {
                        if grid_view {
""",
    """                egui::ScrollArea::vertical()
                    .id_source("rewards-main-scroll")
                    .auto_shrink([false, false])
                    .show(ui, |ui| {
                        if grid_view {
""",
    1,
)
src = src.replace(
    """                egui::ScrollArea::vertical()
                    .auto_shrink([false, false])
                    .show(ui, |ui| {
                        let mut separator_shown = false;
""",
    """                egui::ScrollArea::vertical()
                    .id_source("rewards-main-scroll")
                    .auto_shrink([false, false])
                    .show(ui, |ui| {
                        let mut separator_shown = false;
""",
    1,
)
src = src.replace(
    """        egui::ScrollArea::vertical()
            .auto_shrink([false, false])
            .show(ui, |ui| {
                self.twitch_card(ui);
""",
    """        egui::ScrollArea::vertical()
            .id_source("settings-scroll")
            .auto_shrink([false, false])
            .show(ui, |ui| {
                self.twitch_card(ui);
""",
    1,
)
src = src.replace(
    """                egui::ScrollArea::vertical()
                    .auto_shrink([false, false])
                    .stick_to_bottom(true)
                    .show(ui, |ui| {
                        let visible: Vec<&LogEntry> = entries
""",
    """                egui::ScrollArea::vertical()
                    .id_source("log-scroll")
                    .auto_shrink([false, false])
                    .stick_to_bottom(true)
                    .show(ui, |ui| {
                        let visible: Vec<&LogEntry> = entries
""",
    1,
)

# Music: внешний ScrollArea в update().
sub_once(
    """                    egui::ScrollArea::vertical()
                        .auto_shrink([false, false])
                        .show(ui, |ui| self.music_tab(ui));
""",
    """                    egui::ScrollArea::vertical()
                        .id_source("music-tab-scroll")
                        .auto_shrink([false, false])
                        .show(ui, |ui| self.music_tab(ui));
""",
)

# --- Трей в демо считается доступным для скриншотов ---
sub_once(
    """            let tray_ready = self.tray.is_available();
""",
    """            let tray_ready = self.tray.is_available() || self.demo;
""",
)

# --- Стартовые состояния демо для скриншотов ---
sub_once(
    """        log::info!("Включён демо-режим: данные для скриншотов");
    }
""",
    """        if let Some(tab) = std::env::var_os("REWARD_SOUNDS_DEMO_TAB") {
            match tab.to_string_lossy().to_lowercase().as_str() {
                "music" => self.tab = Tab::Music,
                "settings" => self.tab = Tab::Settings,
                "log" => self.tab = Tab::Log,
                _ => {}
            }
        }
        if std::env::var_os("REWARD_SOUNDS_DEMO_LIST").is_some() {
            self.settings.grid_view = false;
        }
        if let Some(what) = std::env::var_os("REWARD_SOUNDS_DEMO_OPEN") {
            match what.to_string_lossy().to_lowercase().as_str() {
                "editor" => self.open_create_reward(),
                "obs" => self.obs_window_open = true,
                _ => {}
            }
        }
        log::info!("Включён демо-режим: данные для скриншотов");
    }
""",
)

P.write_text(src, encoding="utf-8")
print("app patched")

# --- tray.rs: disabled() ---
t = TRAY.read_text(encoding="utf-8")
anchor = """    /// Обновляет состояние пункта «Воспроизводить звуки» в меню.
"""
addition = """    /// Заглушка без потока и иконки: нужна для демо-режима и тестов.
    pub fn disabled() -> Self {
        let (command_tx, _command_rx) = mpsc::channel();
        let (_event_tx, event_rx) = mpsc::channel();
        Self {
            commands: command_tx,
            events: event_rx,
            enabled: Arc::new(AtomicBool::new(false)),
            available: Arc::new(AtomicBool::new(false)),
        }
    }

"""
assert anchor in t
t = t.replace(anchor, addition + anchor, 1)
TRAY.write_text(t, encoding="utf-8")
print("tray patched")
