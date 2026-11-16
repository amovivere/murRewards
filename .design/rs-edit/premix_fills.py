# -*- coding: utf-8 -*-
"""Предсмешивание полупрозрачных заливок с фоном: убираем «выбеленные» плашки."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")


def sub(old: str, new: str) -> None:
    global s
    assert old in s, "NOT FOUND: " + old[:120]
    s = s.replace(old, new, 1)


# --- кнопки: контур предсмешан, иначе на 1× он ярче макета ---
sub("""    painter.rect(rect, Rounding::same(17.0), fill, Stroke::new(2.0_f32, edge));
""",
"""    let stroke = if edge.a() == 0 {
        Stroke::NONE
    } else {
        Stroke::new(2.0_f32, blend_over(CARD, edge))
    };
    painter.rect(rect, Rounding::same(17.0), fill, stroke);
""")

# --- ghost hover ---
sub("""        ui.painter().rect_filled(
            rect,
            Rounding::same(8.0),
            with_alpha(color, 26),
        );
""",
"""        ui.painter().rect_filled(
            rect,
            Rounding::same(8.0),
            blend_over(CARD, with_alpha(color, 26)),
        );
""")

# --- icon button hover ---
sub("""        ui.painter()
            .rect_filled(rect, Rounding::same(9.0), with_alpha(Color32::WHITE, 12));
""",
"""        ui.painter().rect_filled(
            rect,
            Rounding::same(9.0),
            blend_over(CARD, with_alpha(Color32::WHITE, 12)),
        );
""")

# --- pill / status pill ---
sub("""    painter.rect_filled(
        rect,
        Rounding::same(16.0),
        if !enabled {
            with_alpha(color, 8)
        } else if hovered {
            color
        } else {
            with_alpha(color, 26)
        },
    );
""",
"""    painter.rect_filled(
        rect,
        Rounding::same(16.0),
        blend_over(
            BG,
            if !enabled {
                with_alpha(color, 8)
            } else if hovered {
                color
            } else {
                with_alpha(color, 24)
            },
        ),
    );
""")
sub("""    ui.painter().rect_filled(
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
""",
"""    ui.painter().rect_filled(
        rect,
        Rounding::same(16.0),
        blend_over(
            BG,
            if !enabled {
                with_alpha(color, 8)
            } else if hovered {
                color
            } else {
                with_alpha(color, 22)
            },
        ),
    );
""")

# --- ok_chip / tiny_chip / state chips ---
sub("ui.painter().rect_filled(rect, Rounding::same(13.0), with_alpha(SUCCESS, 22));",
    "ui.painter().rect_filled(\n        rect,\n        Rounding::same(13.0),\n        blend_over(BG, with_alpha(SUCCESS, 22)),\n    );")
sub("ui.painter().rect_filled(rect, Rounding::same(10.0), with_alpha(color, 20));",
    "ui.painter().rect_filled(\n        rect,\n        Rounding::same(10.0),\n        blend_over(CARD, with_alpha(color, 22)),\n    );")
sub("""    let (bg, fg) = (with_alpha(color, 24), color);
""",
"""    let (bg, fg) = (blend_over(CARD, with_alpha(color, 24)), color);
""")
sub("ui.painter().rect_filled(rect, Rounding::same(11.0), with_alpha(color, 24));",
    "ui.painter().rect_filled(\n        rect,\n        Rounding::same(11.0),\n        blend_over(CARD, with_alpha(color, 24)),\n    );")

# --- сегмент-контейнер ---
sub("                .fill(with_alpha(Color32::WHITE, 7))\n                .rounding(Rounding::same(17.0))",
    "                .fill(blend_over(BG, with_alpha(Color32::WHITE, 7)))\n                .rounding(Rounding::same(17.0))")

# --- звуковой чип в карточке награды ---
sub("            egui::Frame::none()\n                .fill(with_alpha(Color32::WHITE, 6))\n                .rounding(Rounding::same(10.0))",
    "            egui::Frame::none()\n                .fill(blend_over(fill, with_alpha(Color32::WHITE, 7)))\n                .rounding(Rounding::same(10.0))")

# --- плитки локальных привязок ---
sub("""                        egui::Frame::none()
                            .fill(with_alpha(Color32::WHITE, 3))
                            .stroke(Stroke::new(
                                1.0_f32,
                                with_alpha(Color32::WHITE, 16),
                            ))
""",
"""                        egui::Frame::none()
                            .fill(blend_over(CARD, with_alpha(Color32::WHITE, 3)))
                            .stroke(Stroke::new(
                                1.0_f32,
                                blend_over(CARD, with_alpha(Color32::WHITE, 22)),
                            ))
""")

# --- очередь: подсветка текущей строки / чипы/поле OBS/превью ---
sub("""                    .fill(if active {
                        with_alpha(SUCCESS, 18)
                    } else {
""",
"""                    .fill(if active {
                        blend_over(CARD, with_alpha(SUCCESS, 18))
                    } else {
""")
sub("""                            .fill(with_alpha(Color32::WHITE, 5))
                            .rounding(Rounding::same(8.0))
""",
"""                            .fill(blend_over(CARD, with_alpha(Color32::WHITE, 6)))
                            .rounding(Rounding::same(8.0))
""")
sub("""                        .fill(with_alpha(Color32::WHITE, 4))
                        .rounding(Rounding::same(10.0))
""",
"""                        .fill(blend_over(CARD, with_alpha(Color32::WHITE, 4)))
                        .rounding(Rounding::same(10.0))
""")

# --- прогресс-полоса плеера ---
sub("painter.rect_filled(track, Rounding::same(1.0), with_alpha(Color32::WHITE, 46));",
    "painter.rect_filled(track, Rounding::same(1.0), blend_over(CARD, with_alpha(Color32::WHITE, 22)));")

# --- collapsed-панель выключенных наград ---
sub("""                        if hovered {
                            with_alpha(Color32::WHITE, 5)
                        } else {
                            Color32::TRANSPARENT
                        },
                        Stroke::new(1.0_f32, with_alpha(Color32::WHITE, 26)),
""",
"""                        if hovered {
                            blend_over(BG, with_alpha(Color32::WHITE, 5))
                        } else {
                            Color32::TRANSPARENT
                        },
                        Stroke::new(1.0_f32, blend_over(BG, with_alpha(Color32::WHITE, 30))),
""")

# --- плашка предупреждения ---
sub("                .fill(with_alpha(WARN, 14))\n                .stroke(Stroke::new(1.0_f32, with_alpha(WARN, 60)))",
    "                .fill(blend_over(CARD, with_alpha(WARN, 14)))\n                .stroke(Stroke::new(1.0_f32, blend_over(CARD, with_alpha(WARN, 70))))")

P.write_text(s, encoding="utf-8")
print("alpha fills premixed")
