# -*- coding: utf-8 -*-
import pathlib
P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")
def sub(old, new):
    global s
    assert old in s, "NOT FOUND: " + old[:100]
    s = s.replace(old, new, 1)

# контейнер сегмента чуть заметнее
sub("                .fill(blend_over(BG, with_alpha(Color32::WHITE, 7)))\n                .rounding(Rounding::same(17.0))",
    "                .fill(blend_over(BG, with_alpha(Color32::WHITE, 10)))\n                .rounding(Rounding::same(17.0))")
# CTA с плюсом
sub('if accent_button(ui, "Создать награду").clicked() {',
    'if accent_button(ui, "+   Создать награду").clicked() {')
# нота в обложке плеера: центрируем
sub("""                            let left = egui::pos2(c.x - 18.0 * scale, c.y + 18.0 * scale);
                            let right = egui::pos2(c.x + 8.0 * scale, c.y + 12.0 * scale);
""",
"""                            let left = egui::pos2(c.x - 14.0 * scale, c.y + 18.0 * scale);
                            let right = egui::pos2(c.x + 13.0 * scale, c.y + 12.0 * scale);
""")
P.write_text(s, encoding="utf-8")
print("minor fixes")