# -*- coding: utf-8 -*-
"""Мелкие UX-правки: пустой экран без Twitch, выход в сайдбаре, тост."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
src = P.read_text(encoding="utf-8")


def sub_once(old: str, new: str) -> None:
    global src
    assert old in src, "NOT FOUND: " + old[:90]
    src = src.replace(old, new, 1)


# 1. Скроем поиск/вид/обновление, когда Twitch ещё не подключён:
#    на пустом экране нужен только чек-лист быстрого старта.
sub_once(
    """        // ---- Строка 2: статус, поиск, вид, обновление, стоп ----
        ui.add_space(12.0);
        ui.horizontal_wrapped(|ui| {
            let status_label = if !connected {
                "Twitch не подключён".to_string()
            } else {
                format!("● {listen_text}")
            };
            let status_color = if connected { listen_color } else { TEXT_DIM };
            if pill_button(ui, &status_label, status_color)
                .on_hover_text("Открыть настройки подключения")
                .clicked()
            {
                go_settings = true;
            }
""",
    """        // ---- Строка 2: статус, поиск, вид, обновление, стоп ----
        if connected {
        ui.add_space(12.0);
        ui.horizontal_wrapped(|ui| {
            let status_label = format!("● {listen_text}");
            let status_color = listen_color;
            if pill_button(ui, &status_label, status_color)
                .on_hover_text("Открыть настройки подключения")
                .clicked()
            {
                go_settings = true;
            }
""",
)

sub_once(
    """            if stop.clicked() {
                stop_all = true;
            }
        });

        // ---- Строка 3: фильтры вместо стат-карточек ----
        ui.add_space(10.0);
        ui.horizontal_wrapped(|ui| {
""",
    """            if stop.clicked() {
                stop_all = true;
            }
        });
        }

        // ---- Строка 3: фильтры вместо стат-карточек ----
        if connected {
        ui.add_space(10.0);
        ui.horizontal_wrapped(|ui| {
""",
)

sub_once(
    """            {
                new_filter = RewardFilter::Disabled;
            }
        });

        ui.add_space(12.0);
""",
    """            {
                new_filter = RewardFilter::Disabled;
            }
        });
        }

        ui.add_space(12.0);
""",
)

# 2. «Завершить» в сайдбаре: обычный способ выйти из приложения из окна.
sub_once(
    """                ui.with_layout(Layout::bottom_up(Align::LEFT), |ui| {
                    ui.label(
                        RichText::new(format!("версия {}", crate::VERSION))
                            .size(11.4)
                            .color(with_alpha(TEXT_DIM, 140)),
                    );
                    ui.add_space(6.0);
""",
    """                ui.with_layout(Layout::bottom_up(Align::LEFT), |ui| {
                    if ghost_button(ui, "Завершить", with_alpha(TEXT_DIM, 170)).clicked() {
                        self.allow_close = true;
                        self.save_now();
                        ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                    }
                    ui.add_space(2.0);
                    ui.label(
                        RichText::new(format!("версия {}", crate::VERSION))
                            .size(11.4)
                            .color(with_alpha(TEXT_DIM, 140)),
                    );
                    ui.add_space(6.0);
""",
)

P.write_text(src, encoding="utf-8")
print("small ux patched, length", len(src))
