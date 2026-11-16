# -*- coding: utf-8 -*-
import pathlib
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-edit\new_fix_pass.py")
s = p.read_text(encoding="utf-8")
s = s.replace('''            // Ручная заявка.
            ui.add_space(6.0);
''', '''            // Ручная заявка.
            ui.add_space(4.0);
''')
p.write_text(s, encoding="utf-8")
print("prefetch anchor fixed")