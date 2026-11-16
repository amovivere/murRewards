# -*- coding: utf-8 -*-
"""Восстанавливаем вырезанный кусок очереди после неудачного удаления."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")

anchor = "            // Ручная заявка."
assert anchor in s
block = r'''                if let Some(prefetched) = snapshot.prefetched.as_ref() {
                    let title = snapshot
                        .items
                        .iter()
                        .find(|item| &item.video_id == prefetched)
                        .map(|item| item.label())
                        .unwrap_or_else(|| prefetched.clone());
                    ui.add_space(4.0);
                    ui.label(
                        RichText::new("✓ следующий загружен")
                            .size(11.0)
                            .color(with_alpha(SUCCESS, 210)),
                    )
                    .on_hover_text(format!(
                        "«{title}» уже в памяти — начнётся без задержки"
                    ));
                }
                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    if !pending.is_empty()
                        && ghost_button(ui, "Очистить", with_alpha(DANGER, 220)).clicked()
                    {
                        clear_queue = true;
                    }
                });
            });

            ui.add_space(4.0);

            if pending.is_empty() {
                egui::Frame::none()
                    .fill(with_alpha(Color32::WHITE, 3))
                    .rounding(Rounding::same(10.0))
                    .inner_margin(egui::Margin::symmetric(12.0, 10.0))
                    .show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        hint(
                            ui,
                            "Очередь пуста. Ссылка из активации награды появится здесь.",
                        );
                    });
            }

            for (index, item) in pending.iter().enumerate() {
                let active = current_id.as_deref() == Some(item.redemption_id.as_str());
                egui::Frame::none()
                    .fill(if active {
                        with_alpha(SUCCESS, 16)
                    } else {
                        Color32::TRANSPARENT
                    })
                    .rounding(Rounding::same(10.0))
                    .inner_margin(egui::Margin::symmetric(10.0, 1.0))
                    .show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        ui.horizontal(|ui| {
                            let (bar_rect, _) =
                                ui.allocate_exact_size(Vec2::new(3.0, 22.0), Sense::hover());
                            if active {
                                ui.painter().rect_filled(bar_rect, Rounding::same(2.0), SUCCESS);
                            }
                            ui.label(
                                RichText::new(format!("{}.", index + 1))
                                    .size(12.4)
                                    .color(TEXT_DIM),
                            );
                            ui.vertical(|ui| {
                                ui.add(
                                    egui::Label::new(
                                        RichText::new(item.label()).size(13.4).color(TEXT),
                                    )
                                    .truncate(),
                                );
                                let mut meta = format!("@{}", item.user_login);
                                if item.duration_sec > 0 {
                                    meta.push_str(&format!(
                                        " · {}",
                                        music::ytdlp::format_duration(item.duration_sec)
                                    ));
                                }
                                ui.label(RichText::new(meta).size(10.8).color(TEXT_DIM));
                            });
                            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                                if item.state != ItemState::Playing {
                                    if icon_button(ui, UiIcon::X, "Убрать из очереди", 28.0).clicked()
                                    {
                                        remove = Some(item.redemption_id.clone());
                                    }
                                    if index > 0
                                        && icon_button(
                                            ui,
                                            UiIcon::ChevronRight,
                                            "Поднять выше",
                                            28.0,
                                        )
                                        .clicked()
                                    {
                                        move_up = Some(item.redemption_id.clone());
                                    }
                                }
                                let chip = queue_state_chip(ui, item.state);
                                if let Some(error) = item.error.as_ref() {
                                    chip.on_hover_text(error);
                                }
                            });
                        });
                    });
            }

'''
s = s.replace(anchor, block + anchor, 1)
P.write_text(s, encoding="utf-8")
print("queue block restored")
