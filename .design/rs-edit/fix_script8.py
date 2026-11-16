# -*- coding: utf-8 -*-
import pathlib
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-edit\polish_pass2.py")
s = p.read_text(encoding="utf-8")
start = s.index("# --- secondary-кнопки")
end = s.index("# --- плейсхолдер")
s = s[:start] + s[end:]
p.write_text(s, encoding="utf-8")
print("secondary section removed")