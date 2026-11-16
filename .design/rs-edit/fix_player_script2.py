# -*- coding: utf-8 -*-
import pathlib
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-edit\rebuild_player2.py")
s = p.read_text(encoding="utf-8")
start = s.index('sub("""                    });')
end = s.index("# ---------------------------------------------------------------- OBS-карточка")
new = '''sub("""                }
            });

        });

        ui.add_space(10.0);

        // ---- Нижний ряд: OBS и состояние ----""",
"""                }
            });
            ui.add_space(2.0);
            ui.label(
                RichText::new("Ручная очередь не тратит баллы зрителей — удобно для проверки.")
                    .size(11.0)
                    .color(with_alpha(TEXT_DIM, 190)),
            );

        });

        ui.add_space(10.0);

        // ---- Нижний ряд: OBS и состояние ----""")

'''
s = s[:start] + new + s[end:]
p.write_text(s, encoding="utf-8")
print("hint insertion fixed")