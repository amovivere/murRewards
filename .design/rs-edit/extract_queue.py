# -*- coding: utf-8 -*-
import pathlib
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-edit\rebuild_music.py")
s = p.read_text(encoding="utf-8")
start = s.index("                if loading > 0 {", s.index("MUSIC_TAB = r"))
end = s.index("            // Ручная заявка.", start)
print(s[start:end])