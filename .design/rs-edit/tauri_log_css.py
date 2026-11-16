import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.css")
s=p.read_text(encoding="utf-8")
s += """

/* ===== журнал ===== */
.log-card { padding: 6px 8px; margin-top: 12px; max-height: calc(100vh - 250px); overflow-y: auto; }
.log-row { display: grid; grid-template-columns: 72px 104px minmax(0, 1fr); gap: 10px; align-items: baseline; padding: 7px 10px; border-radius: 8px; }
.log-row:hover { background: rgba(255,255,255,.035); }
.log-time { font-family: monospace; font-size: 11.4px; color: #7D7D7D; }
.log-level { font-size: 10.2px; letter-spacing: .3px; text-transform: uppercase; color: #8B8B8B; }
.log-level-error { color: #EF4444; }
.log-level-warn { color: #F59E0B; }
.log-level-info { color: #C9A7FF; }
.log-message { font-size: 12.4px; color: #D6D6D6; line-height: 17px; overflow-wrap: anywhere; }
.log-empty { padding: 28px; text-align: center; color: #8B8B8B; font-size: 12.6px; }
"""
p.write_text(s,encoding="utf-8")
print("log css")