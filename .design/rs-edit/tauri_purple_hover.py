import pathlib, re
ui=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui")
for name in ["style.css","app.css","app.js","screens.js","index.html"]:
    p=ui/name
    s=p.read_text(encoding="utf-8")
    s=s.replace("#22C55E","#8B00FF").replace("#22c55e","#8B00FF")
    s=s.replace("rgba(34,197,94,","rgba(139,0,255,")
    s=s.replace("rgba(34, 197, 94,","rgba(139, 0, 255,")
    s=s.replace("34,197,94","139,0,255")
    p.write_text(s,encoding="utf-8")

# убираем словесный логотип в сайдбаре и бренд в футере
p=ui/"index.html"
s=p.read_text(encoding="utf-8")
s=s.replace('<div class="logo"><div class="logo-mark">R</div><div class="logo-name">Reward Sounds</div></div>',
            '<div class="logo"><div class="logo-mark">R</div></div>')
s=s.replace('<span class="brand">REWARD SOUNDS</span>','<span class="brand"></span>')
p.write_text(s,encoding="utf-8")

# hover: убираем прыжки/масштаб, оставляем фон/цвет
p=ui/"app.css"
s=p.read_text(encoding="utf-8")
s=s.replace("button.btn:active { transform: translateY(1px); }","button.btn:active { filter: brightness(.94); }")
s=s.replace(".btn { transition: background .12s ease, border-color .12s ease, color .12s ease, transform .08s ease; }",
            ".btn { transition: background .12s ease, border-color .12s ease, color .12s ease, filter .12s ease; }")
s=s.replace(".btn:hover { transform: translateY(-1px); }\n.btn:active { transform: translateY(0); }",
            ".btn:hover { background-color: rgba(255,255,255,.08); }\n.btn:active { filter: brightness(.94); }")
s=s.replace(".soundchip .play { transition: background .12s ease, transform .1s ease; }\n.soundchip .play:hover { background: rgba(255,255,255,.2); transform: scale(1.08); }",
            ".soundchip .play { transition: background .12s ease, color .12s ease; }\n.soundchip .play:hover { background: rgba(255,255,255,.2); color: #F5F5F5; }")
s=s.replace("#music-player div[style*=\"border-radius:50%\"] { cursor: pointer; transition: filter .12s ease, transform .1s ease; }\n#music-player div[style*=\"border-radius:50%\"]:hover { filter: brightness(1.18); transform: scale(1.04); }",
            "#music-player div[style*=\"border-radius:50%\"] { cursor: pointer; transition: background .12s ease, filter .12s ease; }\n#music-player div[style*=\"background:rgba(255,255,255,.07)\"]:hover { background: rgba(255,255,255,.16) !important; }\n#music-player div[style*=\"background:#EDEDED\"]:hover { background: #FFFFFF !important; filter: brightness(1.02); }")
s=s.replace(".toggle:hover { filter: brightness(1.12); }",".toggle:hover { outline: 2px solid rgba(255,255,255,.16); outline-offset: 1px; }")
p.write_text(s,encoding="utf-8")
print("accent purple, wordmarks removed, hover fixed")