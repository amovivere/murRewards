import pathlib
import re

base = pathlib.Path(r'F:\WorkSpaces\Mur rewards\reward-sounds-tauri\src-tauri\ui\js')
pattern = re.compile(r'<div class="h1">(.*?)</div>')
for file in sorted(base.glob('*.js')):
    text = file.read_text(encoding='utf-8')
    replaced = pattern.sub(r'<h1 class="h1">\1</h1>', text)
    if replaced != text:
        file.write_text(replaced, encoding='utf-8')
        print('h1:', file.name)

# Контраст мелкого акцентного текста (рекомендации UX-аудита, WCAG AA).
css = pathlib.Path(r'F:\WorkSpaces\Mur rewards\reward-sounds-tauri\src-tauri\ui\screens.css')
text = css.read_text(encoding='utf-8')
text += """

/* ===== контраст мелкого текста (по UX-аудиту, WCAG AA) ===== */
.player-state, .queue-prefetch, .playing-badge, .music-badge,
.listen-inline, .log-level-info, .state-ok .state-icon { color: #C9A7FF; }
.music-badge { border-color: rgba(201,167,255,.5); }
.version { color: rgba(181,181,181,.8); }
.footer { color: rgba(168,168,168,.85); }
.settings-label, .player-side-hint, .queue-hint, .settings-row-hint { color: rgba(158,158,158,.9); }
"""
css.write_text(text, encoding='utf-8')
print('contrast css appended')
