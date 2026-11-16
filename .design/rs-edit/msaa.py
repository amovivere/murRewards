# -*- coding: utf-8 -*-
import pathlib
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\main.rs")
s = p.read_text(encoding="utf-8")
old = "    let options = eframe::NativeOptions {\n        viewport,\n        centered: !start_hidden,\n        ..Default::default()\n    };"
new = "    let options = eframe::NativeOptions {\n        viewport,\n        centered: !start_hidden,\n        // 4×MSAA: тонкие скруглённые рамки чипов/кнопок выглядят заметно чище.\n        multisampling: 4,\n        ..Default::default()\n    };"
assert old in s
s = s.replace(old, new, 1)
p.write_text(s, encoding="utf-8")
print("msaa added")