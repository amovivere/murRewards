# -*- coding: utf-8 -*-
import pathlib
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review\mockups\build.py")
s = p.read_text(encoding="utf-8")
s = s.replace("margin-top:12px;padding:16px 18px", "margin-top:10px;padding:12px 16px")
s = s.replace("display:flex;gap:12px;margin-top:12px", "display:flex;gap:12px;margin-top:10px")
s = s.replace("margin-top:10px;display:flex;gap:10px", "margin-top:8px;display:flex;gap:10px")
p.write_text(s, encoding="utf-8")
print("patched")