# -*- coding: utf-8 -*-
import pathlib
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-edit\new_fix_pass.py")
s = p.read_text(encoding="utf-8")
old = '''assert old_theme in th
th = th.replace(old_theme, new_theme, 1)
t.write_text(th, encoding="utf-8")'''
new = '''if old_theme in th:
    th = th.replace(old_theme, new_theme, 1)
    t.write_text(th, encoding="utf-8")'''
assert old in s
s = s.replace(old, new)
p.write_text(s, encoding="utf-8")
print("theme patch made idempotent")