# -*- coding: utf-8 -*-
import pathlib
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-edit\compact_page.py")
s = p.read_text(encoding="utf-8")
s = s.replace('sub("        ui.add_space(8.0);\\n        self.music_player_card(ui, &snapshot);\\n        ui.add_space(6.0);",\n    "        ui.add_space(6.0);\\n        self.music_player_card(ui, &snapshot);\\n        ui.add_space(5.0);")',
              'sub("        ui.add_space(6.0);\\n        self.music_player_card(ui, &snapshot);\\n        ui.add_space(6.0);",\n    "        ui.add_space(5.0);\\n        self.music_player_card(ui, &snapshot);\\n        ui.add_space(5.0);")')
p.write_text(s, encoding="utf-8")
print("fixed")