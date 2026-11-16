# -*- coding: utf-8 -*-
import pathlib
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-edit\rebuild_player2.py")
s = p.read_text(encoding="utf-8")

# 1) заменить неудачную вставку подсказки после ввода
start = s.index('sub("""            if let Some(prefetched) = snapshot.prefetched.as_ref() {\n                let title = snapshot')
end = s.index('# убрать отдельную строку предзагрузки')
new = '''sub("""                    });
                }
            });

            // Ручная заявка.""",
"""                    });
                }
            });
            ui.add_space(2.0);
            ui.label(
                RichText::new("Ручная очередь не тратит баллы зрителей — удобно для проверки.")
                    .size(11.0)
                    .color(with_alpha(TEXT_DIM, 190)),
            );

            if let Some(prefetched) = snapshot.prefetched.as_ref() {
                let title = snapshot
                    .items
                    .iter()
                    .find(|item| &item.video_id == prefetched)
                    .map(|item| item.label())
                    .unwrap_or_else(|| prefetched.clone());
                let _ = title;
            }

            // Ручная заявка.""")
'''
s = s[:start] + new + s[end:]
# 2) убрать бесполезный блок с index() в конце
start = s.index("# убрать отдельную строку предзагрузки")
end = s.index("# ---------------------------------------------------------------- OBS-карточка", start)
s = s[:start] + s[end:]
# 3) ширина поля ввода с учётом плюса
s = s.replace("let width = (ui.available_width() - 128.0).clamp(220.0, 640.0);",
              "let width = (ui.available_width() - 150.0).clamp(220.0, 640.0);")
p.write_text(s, encoding="utf-8")
print("script adjusted")