# -*- coding: utf-8 -*-
import pathlib
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-edit\new_fix_pass.py")
s = p.read_text(encoding="utf-8")
# pill: убрать несуществующий комментарий
s = s.replace('''    // Без обводки-линии: только заливка, поэтому край остаётся ровным.
    painter.rect(
''', '''    painter.rect(
''')
# ghost: корректный маркер конца
s = s.replace('end = s.index("fn stat_card", start) if "fn stat_card" in s[start:] else s.index("fn filter_chip", start)',
              'end = s.index("/// Иконки, которые рисуются кодом:", start)')
p.write_text(s, encoding="utf-8")
print("script adjusted")