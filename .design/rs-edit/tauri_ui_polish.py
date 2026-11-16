import pathlib
# JS: offline class
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.js")
s=p.read_text(encoding="utf-8")
s=s.replace("""    $('#version').textContent = `версия ${state.version}`;
    setTopVolume(state.volume);""","""    $('#version').textContent = `версия ${state.version}`;
    document.body.classList.toggle('offline', !state.connected);
    setTopVolume(state.volume);""")
p.write_text(s,encoding="utf-8")

# CSS: offline, modal width, responsive
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.css")
s=p.read_text(encoding="utf-8")
s += """

/* офлайн-состояние Twitch */
body.offline .statusline .dot,
body.offline .listen-inline .dot { background: #5A5A5A !important; }
body.offline .listen-inline { display: none; }
body.offline .statusline .sep { display: none; }
body.offline #account-chip { background: rgba(255,255,255,.06); color: #8B8B8B; }
body.offline .audio-state .dot { background: #5A5A5A; }

/* OBS-модалка чуть шире, чтобы параметры не переносились */
.modal { width: 560px; }
.modal-row > span:first-child { flex: 0 0 auto; white-space: nowrap; }
.modal-row > span:last-child { line-height: 15px; }

/* адаптив под минимальный размер окна */
@media (max-width: 1120px) {
  .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 980px) {
  .grid { grid-template-columns: minmax(0, 1fr); }
  .top-right .vol-label { display: none; }
  .top-right { gap: 10px; }
}
"""
p.write_text(s,encoding="utf-8")
print("ui polish")