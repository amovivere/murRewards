import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.css")
s=p.read_text(encoding="utf-8")
s += """

/* ===== курсоры и hover-отклик ===== */
.btn, .ghost-red, .seg-item, .nav-item, .dots, .queue-btn, .soundchip .play,
.account-chip, .collapsed, .winbtn, .pill, .slider, .search, .search input,
select.select, .wbtn { cursor: pointer; }
input, textarea { cursor: text; }
.btn { transition: background .12s ease, border-color .12s ease, color .12s ease, transform .08s ease; }
.btn:hover { transform: translateY(-1px); }
.btn:active { transform: translateY(0); }

.btn-primary:hover { background: #ffffff; }
.btn-secondary:hover { background: rgba(255,255,255,.11); border-color: rgba(255,255,255,.42); }
.btn-ghost:hover { background: rgba(255,255,255,.07); color: #F5F5F5; }
.btn-sm:hover { background: rgba(255,255,255,.10); }
.btn-icon:hover { background: rgba(255,255,255,.09); color: #F5F5F5; }

.ghost-red { transition: background .12s ease, color .12s ease; border-radius: 9px; }
.ghost-red:hover { background: rgba(239,68,68,.13); }

.seg-item { transition: background .12s ease, color .12s ease; }
.seg-item:hover:not(.active) { background: rgba(255,255,255,.07); color: #F5F5F5; }

.nav-item { transition: background .12s ease, color .12s ease; }
.nav-item:hover { background: rgba(255,255,255,.055); color: #F5F5F5; }
.nav-item:active { background: rgba(255,255,255,.09); }

.dots { transition: color .12s ease, background .12s ease; border-radius: 8px; padding: 1px 5px; }
.dots:hover { color: #F5F5F5; background: rgba(255,255,255,.07); }

.queue-btn { transition: background .12s ease; }
.queue-btn:hover { background: rgba(255,255,255,.12) !important; }
.queue-btn:hover svg { stroke: #F5F5F5; }

.soundchip .play { transition: background .12s ease, transform .1s ease; }
.soundchip .play:hover { background: rgba(255,255,255,.2); transform: scale(1.08); }

.pills .pill { transition: background .12s ease, border-color .12s ease, color .12s ease; }
.pills .pill:hover { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.22); color: #F5F5F5; }
.pills .pill.active:hover { background: rgba(237,237,237,.16); }

.toolbar .pill:hover { border-color: rgba(255,255,255,.28); }

.collapsed { transition: background .12s ease, border-color .12s ease; }
.collapsed:hover { background: rgba(255,255,255,.035); border-color: rgba(255,255,255,.22); }

.account-chip { transition: background .12s ease; }
.account-chip:hover { background: rgba(34,197,94,.22); }

.search { transition: border-color .12s ease, background .12s ease; }
.search:hover { border-color: rgba(255,255,255,.26); }
.search:focus-within { background: rgba(255,255,255,.07); }

.titlebar .winbtn { transition: background .12s ease, color .12s ease; }

/* фокус с клавиатуры */
.btn:focus-visible, .nav-item:focus-visible, .seg-item:focus-visible,
.pills .pill:focus-visible, .account-chip:focus-visible, .winbtn:focus-visible {
  outline: 2px solid rgba(34,197,94,.65);
  outline-offset: 2px;
}
"""
p.write_text(s,encoding="utf-8")
print("hover styles added")