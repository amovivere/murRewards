# -*- coding: utf-8 -*-
import pathlib
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-edit\patch_small_ux.py")
s = p.read_text(encoding="utf-8")
start = s.index("# 3. Тост:")
end = s.index("P.write_text(src")
s = s[:start] + s[end:]
p.write_text(s, encoding="utf-8")
print("removed footer part")