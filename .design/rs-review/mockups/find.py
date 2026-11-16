# -*- coding: utf-8 -*-
import pathlib
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review\mockups\build.py")
s = p.read_text(encoding="utf-8")
for needle in ['margin-top:12px;padding:16px 18px', 'display:flex;gap:12px;margin-top:12px', 'margin-top:10px;display:flex;gap:10px']:
    for i, line in enumerate(s.splitlines(), 1):
        if needle in line:
            print(i, repr(line))