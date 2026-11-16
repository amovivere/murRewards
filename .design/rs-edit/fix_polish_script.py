# -*- coding: utf-8 -*-
import pathlib
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-edit\polish_match.py")
s = p.read_text(encoding="utf-8")
old = '''# --- Очередь: убрать строку-подсказку под ручной ссылкой (есть в плейсхолдере/тултипе) ---
sub("""            ui.add_space(2.0);
            ui.label(
                RichText::new("Ручная очередь не тратит баллы зрителей — удобно для проверки.")
                    .size(11.0)
                    .color(with_alpha(TEXT_DIM, 190)),
            );
""",
"""            if let Some(input) = ui.ctx().memory(|memory| {
                let _ = memory;
                None
            }) {
                let _ = input;
            }
""")
'''
new = '''# --- Очередь: убрать строку-подсказку под ручной ссылкой (есть в плейсхолдере/тултипе) ---
sub("""            ui.add_space(2.0);
            ui.label(
                RichText::new("Ручная очередь не тратит баллы зрителей — удобно для проверки.")
                    .size(11.0)
                    .color(with_alpha(TEXT_DIM, 190)),
            );
""",
"""""")
'''
assert old in s
s = s.replace(old, new)
p.write_text(s, encoding="utf-8")
print("script fixed")