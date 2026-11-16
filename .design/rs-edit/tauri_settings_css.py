import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.css")
s=p.read_text(encoding="utf-8")
s += """

/* ===== экран «Настройки» ===== */
.settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 16px; padding-bottom: 12px; }
.settings-card { padding: 16px; display: flex; flex-direction: column; gap: 9px; }
.settings-card-title { font-size: 15px; font-weight: 600; }
.settings-card-sub { font-size: 12px; color: #8B8B8B; margin-top: -4px; margin-bottom: 2px; }
.settings-label { font-size: 9.6px; letter-spacing: .7px; color: rgba(139,139,139,.85); }
.settings-status { display: flex; align-items: center; gap: 7px; font-size: 12.6px; color: #B9B9B9; }
.settings-error { font-size: 11.6px; color: #EF4444; background: rgba(239,68,68,.08); border-radius: 8px; padding: 6px 9px; }
.settings-input { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.14); border-radius: 10px; padding: 8px 11px; color: #F5F5F5; font-size: 12.6px; width: 100%; }
.settings-input:focus { outline: none; border-color: rgba(255,255,255,.32); }
.settings-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 3px 0; }
.settings-row-title { font-size: 12.6px; color: #E6E6E6; }
.settings-row-hint { font-size: 11px; color: rgba(139,139,139,.8); line-height: 15px; margin-top: 2px; }
.settings-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
.settings-version { font-size: 12px; color: #8B8B8B; font-family: monospace; }
.settings-volume-row { display: flex; align-items: center; gap: 10px; padding: 3px 0; }
.settings-volume-row .slider { width: 150px; flex: 0 0 150px; }
.settings-volume-value { font-size: 12px; color: #DADADA; min-width: 34px; }
.auth-code { font-size: 24px; font-weight: 600; letter-spacing: 2px; color: #F5F5F5; background: rgba(255,255,255,.05); border-radius: 10px; padding: 10px 14px; text-align: center; }
.toggle { width: 38px; height: 22px; flex: 0 0 38px; border-radius: 11px; border: 0; background: rgba(255,255,255,.16); position: relative; cursor: pointer; transition: background .15s ease; }
.toggle span { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #F5F5F5; transition: left .15s ease; }
.toggle.on { background: #22C55E; }
.toggle.on span { left: 19px; background: #0A0A0A; }
.toggle:hover { filter: brightness(1.12); }
@media (max-width: 1000px) { .settings-grid { grid-template-columns: minmax(0, 1fr); } }

/* курсоры для всех кнопок и круглых кнопок плеера */
button:not(:disabled) { cursor: pointer; }
#music-player div[style*="border-radius:50%"] { cursor: pointer; transition: filter .12s ease, transform .1s ease; }
#music-player div[style*="border-radius:50%"]:hover { filter: brightness(1.18); transform: scale(1.04); }
.modal .pos button { cursor: pointer; }
"""
p.write_text(s,encoding="utf-8")
print("settings css")