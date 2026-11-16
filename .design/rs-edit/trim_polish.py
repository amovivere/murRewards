# -*- coding: utf-8 -*-
import pathlib
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-edit\polish_match.py")
s = p.read_text(encoding="utf-8")
start = s.index("# --- Кнопка прослушивания на карточке")
end = s.index("# --- Прогресс «0 из 3»")
s = s[:start] + s[end:]
# убираем также ссылку на несуществующий mini-плей, если он вошёл в оставшийся кусок
p.write_text(s, encoding="utf-8")
print("script trimmed")