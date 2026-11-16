# -*- coding: utf-8 -*-
import pathlib
P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")
def sub(old, new):
    global s
    assert old in s, "NOT FOUND: " + old[:100]
    s = s.replace(old, new, 1)
sub("                .fill(blend_over(BG, with_alpha(Color32::WHITE, 7)))\n                .rounding(Rounding::same(17.0))",
    "                .fill(blend_over(BG, with_alpha(Color32::WHITE, 10)))\n                .rounding(Rounding::same(17.0))")
sub('if accent_button(ui, "Создать награду").clicked() {',
    'if accent_button(ui, "+   Создать награду").clicked() {')
P.write_text(s, encoding="utf-8")
print("seg/cta fixed")