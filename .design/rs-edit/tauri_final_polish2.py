import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.js")
s=p.read_text(encoding="utf-8")
s=s.replace("""        <div class="settings-status">${connected ? '<span class="dot dot-green"></span>Подключено' : '<span class="dot" style="background:#5A5A5A"></span>Не подключено'}${connected && login ? ` · ${escapeHtml(login)}` : ''}</div>""","""        <div class="settings-status">${connected ? '<span class="dot dot-green"></span>Подключено' : '<span class="dot" style="background:#5A5A5A"></span>Не подключено'}</div>""")
p.write_text(s,encoding="utf-8")
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.css")
s=p.read_text(encoding="utf-8")
s += """
#skip-track { cursor: pointer; transition: color .12s ease; }
#skip-track:hover { color: #F5F5F5; }
"""
p.write_text(s,encoding="utf-8")
print("nickname settings removed, skip hover")