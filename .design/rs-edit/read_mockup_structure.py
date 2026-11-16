# -*- coding: utf-8 -*-
import pathlib
build = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review\mockups\build.py").read_text(encoding="utf-8")
for marker in ["def titlebar", "def sidebar", "def topbar", "def page"]:
    i = build.find(marker)
    print("=====", marker, i)
    if i >= 0:
        print(build[i:i+1200])