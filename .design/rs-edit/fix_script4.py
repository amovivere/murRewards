# -*- coding: utf-8 -*-
import pathlib
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-edit\new_fix_pass.py")
s = p.read_text(encoding="utf-8")
old = '''sub("""            let mut volume = self.settings.volume as f32;
            let response = ui.add(
                egui::Slider::new(&mut volume, 0.0..=1.0)
                    .show_value(false)
                    .trailing_fill(true),
            );
""",
"""            let mut volume = self.settings.volume as f32;
            let response = fader(ui, &mut volume, 0.0, 1.0, 160.0);
""")'''
new = '''sub("""            let mut volume = self.settings.volume;
            ui.spacing_mut().slider_width = 240.0;
            let response = ui.add(
                egui::Slider::new(&mut volume, 0.0..=1.0)
                    .show_value(false)
                    .trailing_fill(true),
            );
""",
"""            let mut volume = self.settings.volume;
            let response = fader(ui, &mut volume, 0.0, 1.0, 240.0);
""")'''
assert old in s
s = s.replace(old, new)
p.write_text(s, encoding="utf-8")
print("volume card patch fixed")