# -*- coding: utf-8 -*-
import pathlib
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review\mockups\build.py")
s = p.read_text(encoding="utf-8")
old = """ICON_PAUSE = svg('<rect x="7" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.4" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none"/>', size=16)"""
new = """ICON_PAUSE = svg('<rect x="7" y="5" width="3.6" height="14" rx="1.2" fill="#0A0A0A" stroke="none"/><rect x="13.4" y="5" width="3.6" height="14" rx="1.2" fill="#0A0A0A" stroke="none"/>', size=16)"""
assert old in s
s = s.replace(old, new)
p.write_text(s, encoding="utf-8")
print("pause icon fixed")