# -*- coding: utf-8 -*-
import pathlib
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-edit\new_fix_pass.py")
s = p.read_text(encoding="utf-8")
old_start = s.index('sub("""            let mut volume = self.settings.volume;')
old_end = s.index('""")', s.index('"""            let mut volume = self.settings.volume;', old_start) + 3) + 4
old = s[old_start:old_end]
new = '''sub("""                let mut volume = self.settings.volume;
                ui.spacing_mut().slider_width = 240.0;
                let response = ui.add(
                    egui::Slider::new(&mut volume, 0.0..=1.0)
                        .show_value(false)
                        .trailing_fill(true),
                );
""",
"""                let mut volume = self.settings.volume;
                let response = fader(ui, &mut volume, 0.0, 1.0, 240.0);
""")'''
s = s[:old_start] + new + s[old_end:]
p.write_text(s, encoding="utf-8")
print("patched indent")