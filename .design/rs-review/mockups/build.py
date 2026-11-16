# -*- coding: utf-8 -*-
"""Генератор мокапов нового интерфейса Reward Sounds."""
import base64
import pathlib
import subprocess

WS = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace")
FONTS = WS / "reward-sounds" / "assets" / "fonts"
OUT = WS / ".tmp" / "rs-review" / "mockups"
OUT.mkdir(parents=True, exist_ok=True)
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

REG = base64.b64encode((FONTS / "Inter-Regular.ttf").read_bytes()).decode()
SEMI = base64.b64encode((FONTS / "Inter-SemiBold.ttf").read_bytes()).decode()

CSS = r"""
* { box-sizing: border-box; margin: 0; padding: 0; }
@font-face { font-family: 'InterMock'; src: url(data:font/ttf;base64,__REG__) format('truetype'); font-weight: 400; }
@font-face { font-family: 'InterMock'; src: url(data:font/ttf;base64,__SEMI__) format('truetype'); font-weight: 600; }
html, body { width: 1220px; height: 840px; overflow: hidden; }
body { background: #0A0A0A; color: #F5F5F5; font-family: 'InterMock', sans-serif; font-size: 14px;
       -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }
.app { display: flex; width: 1220px; height: 840px; }
.sidebar { width: 236px; flex: 0 0 236px; background: #0E0E0E; padding: 12px 14px 16px; display: flex; flex-direction: column; }
.logo { display: flex; align-items: center; gap: 10px; padding: 2px 4px 0; height: 34px; }
.logo-mark { width: 28px; height: 28px; border-radius: 9px; background: rgba(237,237,237,.10);
             display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px; color: #F5F5F5; }
.logo-name { font-weight: 600; font-size: 15px; letter-spacing: .1px; }
.nav-label { font-size: 10.8px; color: rgba(139,139,139,.72); margin: 24px 4px 7px; letter-spacing: .2px; }
.nav-item { height: 38px; border-radius: 10px; display: flex; align-items: center; gap: 12px; padding: 0 8px;
            color: #8B8B8B; font-size: 14.4px; margin-bottom: 2px; }
.nav-item.active { background: #222222; color: #F5F5F5; font-weight: 600; }
.nav-item svg { width: 17px; height: 17px; flex: 0 0 17px; }
.sidebar-bottom { margin-top: auto; padding: 0 4px; display: flex; flex-direction: column; gap: 7px; }
.audio-state { display: flex; align-items: center; gap: 7px; color: #8B8B8B; font-size: 11.6px; }
.dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
.dot-green { background: #22C55E; }
.dot-amber { background: #F59E0B; }
.dot-red { background: #EF4444; }
.version { color: rgba(139,139,139,.55); font-size: 11.4px; }
.main { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; }
.titlebar { height: 38px; flex: 0 0 38px; display: flex; align-items: center; justify-content: flex-end; gap: 2px; padding-right: 8px; }
.wbtn { width: 38px; height: 26px; border-radius: 7px; display: flex; align-items: center; justify-content: center; color: #8B8B8B; }
.topbar { height: 56px; flex: 0 0 56px; display: flex; align-items: center; padding: 0 24px; }
.statusline { display: flex; align-items: center; gap: 8px; font-size: 13.8px; color: #8B8B8B; }
.statusline .sep { width: 1px; height: 12px; background: rgba(255,255,255,.12); margin: 0 6px; }
.listen-inline { display: flex; align-items: center; gap: 7px; color: #22C55E; font-size: 13.2px; }
.top-right { margin-left: auto; display: flex; align-items: center; gap: 14px; }
.vol-label { font-size: 11.4px; color: rgba(139,139,139,.75); letter-spacing: .3px; }
.vol-value { font-size: 14.4px; color: #F5F5F5; min-width: 38px; }
.account-chip { height: 32px; padding: 0 18px; border-radius: 16px; background: rgba(34,197,94,.14);
               color: #22C55E; font-size: 13.8px; display: flex; align-items: center; }
.content { flex: 1 1 auto; min-height: 0; padding: 12px 24px 0; display: flex; flex-direction: column; }
.footer { height: 36px; flex: 0 0 36px; display: flex; align-items: center; padding: 0 24px; color: rgba(139,139,139,.7); font-size: 13.2px; }
.footer .brand { margin-left: auto; font-size: 10.2px; letter-spacing: 1.2px; color: rgba(139,139,139,.45); }

.slider { position: relative; width: 128px; height: 16px; }
.slider .track { position: absolute; left: 0; right: 0; top: 7px; height: 2px; background: rgba(255,255,255,.20); border-radius: 2px; }
.slider .fill { position: absolute; left: 0; top: 7px; height: 2px; background: #EDEDED; border-radius: 2px; }
.slider .knob { position: absolute; top: 1px; width: 14px; height: 14px; border-radius: 50%; background: #FFFFFF;
                box-shadow: 0 0 0 1px rgba(0,0,0,.5); margin-left: -7px; }

.page-head { display: flex; align-items: flex-start; }
.h1 { font-size: 36px; font-weight: 600; line-height: 42px; letter-spacing: -.3px; }
.sub { color: #8B8B8B; font-size: 15px; line-height: 20px; margin-top: 1px; }
.head-actions { margin-left: auto; display: flex; align-items: center; gap: 12px; padding-top: 4px; }
.btn { height: 34px; padding: 0 18px; border-radius: 17px; display: inline-flex; align-items: center; gap: 8px;
       font-size: 14.4px; border: 1px solid transparent; white-space: nowrap; }
.btn-primary { background: #EDEDED; color: #0A0A0A; font-weight: 600; }
.btn-secondary { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.28); color: #F5F5F5; }
.btn-ghost { background: transparent; color: #8B8B8B; }
.btn-danger-ghost { background: transparent; color: #EF4444; }
.btn-icon { width: 34px; height: 34px; padding: 0; justify-content: center; border-radius: 50%; }
.btn-sm { height: 30px; padding: 0 14px; border-radius: 15px; font-size: 13.6px; }
.btn:disabled { opacity: .5; }
.toolbar { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
.search { width: 252px; height: 34px; border-radius: 17px; background: rgba(255,255,255,.05);
          border: 1px solid rgba(255,255,255,.16); display: flex; align-items: center; gap: 9px; padding: 0 14px;
          color: #7C7C7C; font-size: 13.6px; }
.seg { display: flex; align-items: center; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.14);
       border-radius: 17px; height: 34px; padding: 2px; gap: 2px; }
.seg-item { height: 28px; padding: 0 14px; border-radius: 14px; display: flex; align-items: center; gap: 7px;
            font-size: 13.4px; color: #8B8B8B; }
.seg-item.active { background: #EDEDED; color: #0A0A0A; font-weight: 600; }
.select { height: 34px; padding: 0 14px; border-radius: 17px; border: 1px solid rgba(255,255,255,.16);
          color: #C9C9C9; font-size: 13.6px; display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,.04); }
.spacer { flex: 1 1 auto; }
.pills { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.pill { height: 30px; padding: 0 13px; border-radius: 15px; display: inline-flex; align-items: center; gap: 7px;
        font-size: 13.2px; color: #A0A0A0; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.10); }
.pill b { color: #F5F5F5; font-weight: 600; }
.pill.active { background: rgba(237,237,237,.12); border-color: rgba(237,237,237,.34); color: #F5F5F5; }
.pill .dot { width: 6px; height: 6px; }

.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 16px; }
.card { border-radius: 18px; padding: 16px 16px 14px; border: 1px solid rgba(255,255,255,.075); position: relative; }
.card-top { display: flex; align-items: flex-start; gap: 11px; }
.tile { width: 38px; height: 38px; border-radius: 11px; flex: 0 0 38px; display: flex; align-items: center;
        justify-content: center; font-weight: 600; font-size: 18px; color: #12131F; }
.card-title { font-weight: 600; font-size: 15px; line-height: 19px; white-space: nowrap; overflow: hidden;
              text-overflow: ellipsis; max-width: 190px; }
.card-meta { font-size: 10.8px; color: rgba(139,139,139,.85); letter-spacing: .25px; margin-top: 3px; white-space: nowrap; }
.music-badge { color: #22C55E; border: 1px solid rgba(34,197,94,.35); border-radius: 8px; padding: 0 6px;
               font-size: 9.4px; letter-spacing: .5px; margin-left: 6px; }
.dots { margin-left: auto; color: rgba(139,139,139,.8); font-size: 16px; letter-spacing: 1px; line-height: 18px; padding: 0 2px; }
.soundchip { margin-top: 13px; height: 34px; border-radius: 10px; background: rgba(255,255,255,.055);
             display: flex; align-items: center; gap: 9px; padding: 0 11px; font-size: 11.6px; color: #DADADA; }
.soundchip .play { width: 18px; height: 18px; border-radius: 50%; background: rgba(255,255,255,.10);
                   display: flex; align-items: center; justify-content: center; color: #EDEDED; }
.soundchip .fname { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.soundchip .fmt { margin-left: auto; color: rgba(139,139,139,.85); font-size: 10.8px; white-space: nowrap; }
.soundchip.empty { background: transparent; border: 1px dashed rgba(255,255,255,.20); color: rgba(139,139,139,.8); }
.soundchip.empty .fmt { color: rgba(255,255,255,.55); }
.volrow { display: flex; align-items: center; gap: 9px; margin-top: 11px; }
.volrow .cap { font-size: 9px; letter-spacing: .8px; color: rgba(139,139,139,.8); }
.volrow .val { font-size: 10.8px; color: #8B8B8B; margin-left: auto; }
.slider.sm { width: 104px; }
.slider.sm .track { background: rgba(255,255,255,.16); }
.card-actions { display: flex; align-items: center; gap: 6px; margin-top: 12px; }
.ghost-red { color: #EF4444; font-size: 13.6px; padding: 0 8px; height: 30px; display: flex; align-items: center; }
.collapsed { margin-top: 14px; height: 44px; border-radius: 12px; border: 1px dashed rgba(255,255,255,.13);
             display: flex; align-items: center; padding: 0 16px; color: #8B8B8B; font-size: 13.2px; gap: 9px; }
.collapsed .chev { margin-left: auto; color: rgba(139,139,139,.7); }
"""


def svg(paths, size=16, stroke="#8B8B8B", width=1.6, fill="none"):
    return (
        f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="{fill}" '
        f'stroke="{stroke}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round">{paths}</svg>'
    )


ICON_GRID = svg('<rect x="3" y="3" width="7" height="7" rx="2" fill="currentColor" stroke="none"/><rect x="14" y="3" width="7" height="7" rx="2" fill="currentColor" stroke="none"/><rect x="3" y="14" width="7" height="7" rx="2" fill="currentColor" stroke="none"/><rect x="14" y="14" width="7" height="7" rx="2" fill="currentColor" stroke="none"/>')
ICON_MUSIC = svg('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>')
ICON_SETTINGS = svg('<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="#0E0E0E"/><circle cx="15" cy="12" r="2" fill="#0E0E0E"/><circle cx="10" cy="18" r="2" fill="#0E0E0E"/>')
ICON_LOG = svg('<circle cx="5" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="5" cy="18" r="1.4" fill="currentColor" stroke="none"/><path d="M10 6h10M10 12h10M10 18h10"/>')
ICON_SEARCH = svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>', size=15, stroke="#7C7C7C", width=1.7)
ICON_REFRESH = svg('<path d="M20 11a8 8 0 1 0-2.3 6"/><path d="M20 4v7h-7"/>', size=15, stroke="#8B8B8B", width=1.7)
ICON_STOP = svg('<rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" stroke="none"/>', size=13, stroke="#EF4444")
ICON_PLAY = svg('<path d="M8 5l11 7-11 7z" fill="currentColor" stroke="none"/>', size=10, stroke="#EDEDED")
ICON_CHEV = svg('<path d="M6 9l6 6 6-6"/>', size=15, stroke="#8B8B8B", width=1.8)
ICON_VOL = svg('<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none"/><path d="M16 8.5a5 5 0 0 1 0 7" /><path d="M19 6a9 9 0 0 1 0 12"/>', size=16, stroke="#8B8B8B", width=1.5)
ICON_PLUS = svg('<path d="M12 5v14M5 12h14"/>', size=15, stroke="#0A0A0A", width=2)
ICON_DOTS = '<span style="letter-spacing:1.5px;line-height:18px">···</span>'
ICON_PREV = svg('<path d="M19 6v12L9 12l10-6z" fill="currentColor" stroke="none"/><rect x="5" y="6" width="2.4" height="12" rx="1" fill="currentColor" stroke="none"/>', size=15)
ICON_PAUSE = svg('<rect x="7" y="5" width="3.6" height="14" rx="1.2" fill="#0A0A0A" stroke="none"/><rect x="13.4" y="5" width="3.6" height="14" rx="1.2" fill="#0A0A0A" stroke="none"/>', size=16)
ICON_NEXT = svg('<path d="M5 6v12l10-6L5 6z" fill="currentColor" stroke="none"/><rect x="16.6" y="6" width="2.4" height="12" rx="1" fill="currentColor" stroke="none"/>', size=15)
ICON_COPY = svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>', size=14, stroke="#8B8B8B", width=1.6)
ICON_UP = svg('<path d="M12 19V5M6 11l6-6 6 6"/>', size=13, stroke="#8B8B8B", width=1.8)
ICON_X = svg('<path d="M6 6l12 12M18 6L6 18"/>', size=13, stroke="#8B8B8B", width=1.8)
ICON_CHECK = svg('<path d="M4 12l5 5L20 6"/>', size=15, stroke="#22C55E", width=2.2)
ICON_OBS = svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/>', size=15, stroke="#F5F5F5", width=1.6)
ICON_BARS = ('<div style="display:flex;align-items:flex-end;gap:2px;height:16px">'
             + "".join(f'<span style="width:3px;height:{h}px;border-radius:2px;background:#22C55E"></span>'
                       for h in (7, 12, 16, 9))
             + "</div>")


def winbtn(kind):
    if kind == "min":
        inner = '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6h8" stroke="#8B8B8B" stroke-width="1.2"/></svg>'
    elif kind == "max":
        inner = '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="2.2" y="2.2" width="7.6" height="7.6" rx="1" fill="none" stroke="#8B8B8B" stroke-width="1.1"/></svg>'
    else:
        inner = '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="#8B8B8B" stroke-width="1.2"/></svg>'
    return f'<div class="wbtn">{inner}</div>'


def sidebar(active="rewards"):
    def item(icon, label, key):
        cls = "nav-item active" if key == active else "nav-item"
        return f'<div class="{cls}">{icon}<span>{label}</span></div>'

    return (
        '<div class="sidebar">'
        '<div class="logo"><div class="logo-mark">R</div><div class="logo-name">Reward Sounds</div></div>'
        '<div class="nav-label">ОСНОВНОЕ</div>'
        + item(ICON_GRID, "Награды", "rewards")
        + item(ICON_MUSIC, "Музыка", "music")
        + '<div class="nav-label">СИСТЕМА</div>'
        + item(ICON_SETTINGS, "Настройки", "settings")
        + item(ICON_LOG, "Журнал", "log")
        + '<div class="sidebar-bottom">'
        '<div class="audio-state"><span class="dot dot-green"></span>звук готов</div>'
        '<div class="version">версия 1.7.0</div>'
        '</div></div>'
    )


def titlebar():
    return '<div class="titlebar">' + winbtn("min") + winbtn("max") + winbtn("close") + '</div>'


def topbar(connected=True, listening=True):
    if connected:
        left = ('<div class="statusline"><span class="dot dot-green"></span>Подключено · goshanmur'
                '<span class="sep"></span>'
                '<span class="listen-inline"><span class="dot dot-green"></span>Слушаем награды</span></div>')
        chip = '<div class="account-chip">@goshanmur</div>'
    else:
        left = ('<div class="statusline"><span class="dot" style="background:#5A5A5A"></span>Twitch не подключён'
                '</div>')
        chip = ('<div class="account-chip" style="background:rgba(255,255,255,.06);color:#8B8B8B">'
                'Twitch: не подключён</div>')
    return (
        '<div class="topbar">' + left +
        '<div class="top-right">'
        '<span class="vol-label">ЗВУК</span>'
        '<div class="slider"><div class="track"></div><div class="fill" style="width:28%"></div>'
        '<div class="knob" style="left:28%"></div></div>'
        '<span class="vol-value">28%</span>'
        + chip +
        '</div></div>'
    )


def footer():
    return '<div class="footer">Готово<span class="brand">REWARD SOUNDS</span></div>'


def page(active, body, connected=True, listening=True):
    html = (
        '<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Reward Sounds mockup</title>'
        '<style>' + CSS + '</style></head><body><div class="app">'
        + sidebar(active)
        + '<div class="main">' + titlebar() + topbar(connected, listening)
        + '<div class="content">' + body + '</div>'
        + footer()
        + '</div></div></body></html>'
    )
    return html.replace("__REG__", REG).replace("__SEMI__", SEMI)


# ---------------------------------------------------------------------------
# Мокап 1. Вкладка «Награды»
# ---------------------------------------------------------------------------
CARDS = [
    dict(color="#FF5A5F", letter="Т", title="Ты новичок?", meta="200 БАЛЛОВ · АКТИВНА",
         file="newbie.mp3", fmt="MP3 · 0:08", vol=200),
    dict(color="#4E7CFF", letter="М", title="Мне нравится как он", meta="150 БАЛЛОВ · АКТИВНА",
         file="ilikehowhesmoving.mp3", fmt="MP3 · 0:12", vol=200),
    dict(color="#A970FF", letter="Ш", title="Шиза", meta="250 БАЛЛОВ · АКТИВНА",
         file="Kanye - Vulvas.mp3", fmt="MP3 · 3:14", vol=46),
    dict(color="#22C55E", letter="Б", title="Беги", meta="200 БАЛЛОВ · АКТИВНА",
         file="run.mp3", fmt="MP3 · 0:06", vol=133),
    dict(color="#5B6CFF", letter="В", title="Выстрел", meta="50 БАЛЛОВ · АКТИВНА",
         file="shot.mp3", fmt="MP3 · 0:02", vol=200),
    dict(color="#FF4FA3", letter="М", title="МУЗЫКА ЮТУБ", meta="50 БАЛЛОВ · АКТИВНА",
         file=None, fmt="", vol=None, music=True),
]


def mix(base, color, amount):
    br, bg, bb = int(base[1:3], 16), int(base[3:5], 16), int(base[5:7], 16)
    cr, cg, cb = int(color[1:3], 16), int(color[3:5], 16), int(color[5:7], 16)
    r = round(br * (1 - amount) + cr * amount)
    g = round(bg * (1 - amount) + cg * amount)
    b = round(bb * (1 - amount) + cb * amount)
    return f"#{r:02X}{g:02X}{b:02X}"


def card(c):
    bg = mix("#141414", c["color"], 0.13)
    border = mix("#242424", c["color"], 0.22)
    meta = c["meta"]
    if c.get("music"):
        meta += '<span class="music-badge">МУЗЫКА</span>'
    if c["file"]:
        sound = ('<div class="soundchip"><span class="play">' + ICON_PLAY + '</span>'
                 '<span class="fname">' + c["file"] + '</span>'
                 '<span class="fmt">' + c["fmt"] + '</span></div>')
        vol = (f'<div class="volrow"><span class="cap">ГРОМКОСТЬ</span>'
               f'<div class="slider sm"><div class="track"></div>'
               f'<div class="fill" style="width:{c["vol"] / 2:.1f}%"></div>'
               f'<div class="knob" style="left:{c["vol"] / 2:.1f}%;width:12px;height:12px;top:2px"></div></div>'
               f'<span class="val">{c["vol"]}%</span></div>')
        actions = ('<div class="card-actions">'
                   '<div class="btn btn-sm btn-secondary">Заменить</div>'
                   '<div class="ghost-red">Убрать</div>'
                   '</div>')
    else:
        sound = ('<div class="soundchip empty"><span class="fname">Звук не выбран</span>'
                 '<span class="fmt">нажмите «Выбрать»</span></div>')
        vol = ('<div class="volrow"><span class="cap">ГРОМКОСТЬ</span>'
               '<div class="slider sm"><div class="track"></div><div class="fill" style="width:0%"></div></div>'
               '<span class="val">—</span></div>')
        actions = ('<div class="card-actions">'
                   '<div class="btn btn-sm btn-primary">Выбрать звук</div>'
                   '<div class="ghost-red" style="color:#8B8B8B">Открыть в «Музыке»</div>'
                   '</div>')
    return (
        f'<div class="card" style="background:{bg};border-color:{border}">'
        '<div class="card-top">'
        f'<div class="tile" style="background:{c["color"]}">{c["letter"]}</div>'
        f'<div><div class="card-title">{c["title"]}</div>'
        f'<div class="card-meta">{meta}</div></div>'
        f'<div class="dots">···</div>'
        '</div>'
        + sound + vol + actions +
        '</div>'
    )


def mock_rewards():
    body = (
        '<div class="page-head">'
        '<div><div class="h1">Награды</div>'
        '<div class="sub">@goshanmur · 20 наград · 9 со звуком</div></div>'
        '<div class="head-actions">'
        '<div class="btn btn-icon btn-ghost" style="font-size:18px">···</div>'
        '<div class="btn btn-primary">' + ICON_PLUS + 'Создать награду</div>'
        '</div></div>'

        '<div class="toolbar">'
        '<div class="search">' + ICON_SEARCH + '<span>Поиск по названию</span></div>'
        '<div class="seg"><div class="seg-item active">' + ICON_GRID.replace('currentColor', '#0A0A0A').replace('#8B8B8B', '#0A0A0A') + 'Плитка</div>'
        '<div class="seg-item">' + svg('<path d="M4 6h16M4 12h16M4 18h10"/>', size=14, stroke="#8B8B8B", width=1.8) + 'Список</div></div>'
        '<div class="select">Все награды' + ICON_CHEV + '</div>'
        '<div class="spacer"></div>'
        '<div class="btn btn-icon btn-secondary">' + ICON_REFRESH + '</div>'
        '<div class="btn btn-ghost btn-danger-ghost">' + ICON_STOP + 'Остановить всё</div>'
        '</div>'

        '<div class="pills">'
        '<div class="pill active">Все <b>20</b></div>'
        '<div class="pill">Со звуком <b>9</b></div>'
        '<div class="pill"><span class="dot" style="background:#F59E0B"></span>Без звука <b>11</b></div>'
        '<div class="pill"><span class="dot" style="background:#22C55E"></span>Играет <b>0</b></div>'
        '<div class="pill"><span class="dot" style="background:#5A5A5A"></span>Выключенные <b>5</b></div>'
        '</div>'

        '<div class="grid">' + "".join(card(c) for c in CARDS) + '</div>'

        '<div class="collapsed">' + ICON_CHEV.replace('M6 9l6 6 6-6', 'M9 6l6 6-6 6')
        + '<span>Выключенные и недоступные награды · 5</span>'
        '<span class="chev" style="margin-left:auto">Показать</span></div>'
    )
    return page("rewards", body)


# ---------------------------------------------------------------------------
# Мокап 2. Вкладка «Музыка»
# ---------------------------------------------------------------------------

def mock_music():
    body = (
        '<div class="page-head">'
        '<div><div class="h1">Музыка</div>'
        '<div class="sub">Треки по заявке: зритель присылает ссылку на YouTube в чат</div></div>'
        '<div class="head-actions">'
        '<div class="btn btn-icon btn-ghost" style="font-size:18px">···</div>'
        '<div class="btn btn-secondary">' + ICON_OBS + 'Оверлей OBS</div>'
        '<div class="btn btn-primary" style="background:rgba(34,197,94,.16);color:#22C55E;border:1px solid rgba(34,197,94,.38)">'
        '<span class="dot dot-green"></span>Принимаем заявки</div>'
        '</div></div>'

        '<div class="toolbar" style="margin-top:12px">'
        '<div class="pill active" style="height:32px">Награда: МУЗЫКА ЮТУБ · 50 баллов</div>'
        '<div class="btn btn-sm btn-ghost" style="color:#8B8B8B">Изменить</div>'
        '<div class="spacer"></div>'
        '<div class="pill" style="height:32px;color:#22C55E;border-color:rgba(34,197,94,.25)">'
        + ICON_CHECK + 'yt-dlp 2026.10.26</div>'
        '</div>'

        '<div class="card" style="margin-top:12px;height:156px;display:flex;gap:16px;align-items:center;padding:14px 16px">'
        '<div style="width:102px;height:102px;border-radius:14px;flex:0 0 102px;'
        'background:linear-gradient(145deg,#242424,#161616);display:flex;align-items:center;justify-content:center">'
        + svg('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>', size=40, stroke="#6E6E6E", width=1.4)
        + '</div>'
        '<div style="flex:1 1 auto;min-width:0">'
        '<div style="font-size:10.6px;letter-spacing:1px;color:#22C55E">СЕЙЧАС ИГРАЕТ</div>'
        '<div style="font-size:19px;font-weight:600;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Земляк — ДИНАСТИЯ</div>'
        '<div style="font-size:12.8px;color:#8B8B8B;margin-top:3px">заказал @nix · YouTube · 2:44</div>'
        '<div style="margin-top:9px;display:flex;align-items:center;gap:10px">'
        '<span style="font-size:11px;color:#8B8B8B;min-width:30px">0:58</span>'
        '<div style="flex:1 1 auto;position:relative;height:14px">'
        '<div style="position:absolute;left:0;right:0;top:6px;height:2px;border-radius:2px;background:rgba(255,255,255,.18)"></div>'
        '<div style="position:absolute;left:0;width:35%;top:6px;height:2px;border-radius:2px;background:#EDEDED"></div>'
        '<div style="position:absolute;left:35%;top:0;width:14px;height:14px;margin-left:-7px;border-radius:50%;background:#fff"></div>'
        '</div>'
        '<span style="font-size:11px;color:#8B8B8B;min-width:30px;text-align:right">2:44</span>'
        '</div>'
        '<div style="display:flex;align-items:center;gap:9px;margin-top:9px">'
        '<div style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center">'+ICON_PREV+'</div>'
        '<div style="width:40px;height:40px;border-radius:50%;background:#EDEDED;display:flex;align-items:center;justify-content:center">'+ICON_PAUSE+'</div>'
        '<div style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center">'+ICON_NEXT+'</div>'
        '<div style="margin-left:12px;font-size:13.2px;color:#8B8B8B">Пропустить трек</div>'
        '</div>'
        '</div>'
        '<div style="width:196px;flex:0 0 196px;border-left:1px solid rgba(255,255,255,.07);padding-left:16px">'
        '<div style="font-size:11px;color:#8B8B8B">Громкость музыки</div>'
        '<div style="display:flex;align-items:center;gap:9px;margin-top:9px">'
        '<div class="slider" style="width:120px"><div class="track"></div><div class="fill" style="width:30%"></div><div class="knob" style="left:30%"></div></div>'
        '<span style="font-size:12px;color:#DADADA">30%</span></div>'
        '<div style="font-size:11.2px;color:rgba(139,139,139,.75);margin-top:8px;line-height:15px">Не меняет громкость Windows — только очередь.</div>'
        '<div style="margin-top:10px;font-size:10.8px;color:#8B8B8B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Следующий: <span style="color:#CFCFCF">Kanye — Vulvas</span></div>'
        '</div>'
        '</div>'

        '<div class="card" style="margin-top:10px;padding:12px 16px">'
        '<div style="display:flex;align-items:center;gap:10px">'
        '<div style="font-size:15.4px;font-weight:600">Очередь · 2 из 10</div>'
        '<div class="pill" style="height:24px;font-size:11.4px;padding:0 9px;color:#22C55E;border-color:rgba(34,197,94,.3)">1 играет</div>'
        '<div class="pill" style="height:24px;font-size:11.4px;padding:0 9px;color:#F59E0B;border-color:rgba(245,158,11,.3)">1 загружается</div>'
        '<div class="spacer"></div>'
        '<div class="ghost-red" style="font-size:13.2px">Очистить</div>'
        '</div>'

        '<div style="margin-top:8px">'
        '<div style="display:flex;align-items:center;gap:12px;height:36px;border-radius:10px;background:rgba(34,197,94,.07);padding:0 10px;position:relative">'
        '<span style="position:absolute;left:0;top:8px;bottom:8px;width:3px;border-radius:2px;background:#22C55E"></span>'
        '<span style="font-size:12.6px;color:#8B8B8B;width:14px">1</span>'
        '<div style="flex:1 1 auto;min-width:0"><div style="font-size:13.8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">ДИНАСТИЯ — Земляк</div>'
        '<div style="font-size:11.4px;color:#8B8B8B">@nix · 2:44 · YouTube</div></div>'
        '<div class="pill" style="height:24px;font-size:11.2px;padding:0 9px;color:#22C55E;border-color:rgba(34,197,94,.3)">играет</div>'
        '<div style="width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.05)">'+ICON_X+'</div>'
        '</div>'

        '<div style="display:flex;align-items:center;gap:12px;height:36px;padding:0 10px">'
        '<span style="font-size:12.6px;color:#8B8B8B;width:14px">2</span>'
        '<div style="flex:1 1 auto;min-width:0"><div style="font-size:13.8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Vulvas — Kanye West</div>'
        '<div style="font-size:11.4px;color:#F59E0B">загружается · 64%&nbsp;&nbsp;<span style="display:inline-block;width:110px;height:3px;border-radius:2px;background:rgba(255,255,255,.12);vertical-align:middle"><span style="display:block;width:64%;height:3px;border-radius:2px;background:#F59E0B"></span></span></div></div>'
        '<div class="pill" style="height:24px;font-size:11.2px;padding:0 9px;color:#F59E0B;border-color:rgba(245,158,11,.3)">загрузка</div>'
        '<div style="width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.05)">'+ICON_X+'</div>'
        '</div>'

        '<div style="display:flex;align-items:center;gap:12px;height:42px;padding:0 10px">'
        '<span style="font-size:12.6px;color:#8B8B8B;width:14px">3</span>'
        '<div style="flex:1 1 auto;min-width:0"><div style="font-size:13.8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">run.mp3</div>'
        '<div style="font-size:11.4px;color:#8B8B8B">@goshanmur · 0:06</div></div>'
        '<div class="pill" style="height:24px;font-size:11.2px;padding:0 9px;color:#B9B9B9;border-color:rgba(255,255,255,.14)">в очереди</div>'
        '<div style="width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.05)">'+ICON_UP+'</div>'
        '<div style="width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.05)">'+ICON_X+'</div>'
        '</div>'
        '</div>'

        '<div style="display:flex;align-items:center;gap:10px;margin-top:8px;padding-top:10px;border-top:1px solid rgba(255,255,255,.07)">'
        '<div class="search" style="flex:1 1 auto;width:auto;color:#6E6E6E">'+ICON_PLUS.replace('#0A0A0A','#6E6E6E')+'<span>Вставьте ссылку YouTube и нажмите Enter — трек встанет в очередь</span></div>'
        '<div class="btn btn-secondary btn-sm" style="height:34px;border-radius:17px">В очередь</div>'
        '</div>'
        '<div style="font-size:11px;color:rgba(139,139,139,.7);margin-top:4px">Ручная очередь не тратит баллы зрителей — удобно для проверки.</div>'
        '</div>'

        '<div style="display:flex;gap:12px;margin-top:10px">'
        '<div class="card" style="flex:1 1 55%;padding:14px 16px">'
        '<div style="display:flex;align-items:center;gap:9px"><div style="font-size:14.4px;font-weight:600">OBS — строка «Сейчас играет»</div>'
        '<div class="spacer"></div><div class="btn btn-sm btn-ghost" style="height:28px">Настроить</div></div>'
        '<div style="display:flex;align-items:center;gap:8px;margin-top:10px">'
        '<div style="font-family:monospace;font-size:11.4px;color:#CFCFCF;background:rgba(255,255,255,.05);border-radius:8px;padding:5px 10px">http://127.0.0.1:8770/overlay</div>'
        '<div style="width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,.05);display:flex;align-items:center;justify-content:center">'+ICON_COPY+'</div>'
        '<div style="margin-left:auto" class="btn btn-sm btn-secondary" style="height:28px">Показать сейчас</div></div>'
        '<div style="margin-top:8px;border-radius:10px;background:rgba(255,255,255,.035);height:30px;display:flex;align-items:center;gap:9px;padding:0 12px">'
        + ICON_BARS + '<span style="font-size:11.4px;font-weight:600">ДИНАСТИЯ — Земляк</span>'
        '<span style="font-size:10.8px;color:#8B8B8B">· заказал @nix</span></div>'
        '</div>'
        '<div class="card" style="flex:1 1 45%;height:128px;overflow:hidden;padding:12px 14px">'
        '<div style="font-size:14.4px;font-weight:600">Состояние</div>'
        '<div style="margin-top:7px;display:flex;flex-direction:column;gap:5px;font-size:11.4px;color:#B9B9B9">'
        '<div style="display:flex;align-items:center;gap:8px">'+ICON_CHECK+'yt-dlp 2026.10.26 — готов</div>'
        '<div style="display:flex;align-items:center;gap:8px"><span class="dot dot-green"></span>Чат: команда !трек работает</div>'
        '<div style="display:flex;align-items:center;gap:8px"><span class="dot dot-green"></span>Порт оверлея 8770 — свободен</div>'
        '</div></div>'
        '</div>'
    )
    return page("music", body)


# ---------------------------------------------------------------------------
# Мокап 3. Первый запуск / нет Twitch
# ---------------------------------------------------------------------------

def step(num, title, text, active=False, done=False, actions=""):
    if done:
        circle = ('<div style="width:30px;height:30px;border-radius:50%;flex:0 0 30px;background:rgba(34,197,94,.16);'
                  'display:flex;align-items:center;justify-content:center">' + ICON_CHECK + '</div>')
        extra = 'style="opacity:.62"'
    elif active:
        circle = ('<div style="width:30px;height:30px;border-radius:50%;flex:0 0 30px;background:#EDEDED;color:#0A0A0A;'
                  'display:flex;align-items:center;justify-content:center;font-weight:600;font-size:14px">1</div>')
        extra = ""
    else:
        circle = (f'<div style="width:30px;height:30px;border-radius:50%;flex:0 0 30px;border:1px solid rgba(255,255,255,.22);'
                  f'color:#8B8B8B;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:14px">{num}</div>')
        extra = 'style="opacity:.55"'
    return ('<div style="display:flex;gap:14px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.06)">'
            + circle +
            f'<div {extra} style="flex:1 1 auto"><div style="font-size:15.2px;font-weight:600">{title}</div>'
            f'<div style="font-size:12.8px;color:#8B8B8B;line-height:18px;margin-top:3px">{text}</div>'
            + (f'<div style="margin-top:8px;display:flex;align-items:center;gap:10px">{actions}</div>' if actions else '')
            + '</div></div>')


def mock_onboarding():
    steps = (
        step(1, "Подключите Twitch", "Публичный Client ID вашего приложения на dev.twitch.tv — не пароль. "
             "Вход подтверждается кодом на сайте Twitch, токены хранятся только на этом компьютере.",
             active=True,
             actions='<div class="btn btn-primary">Подключить Twitch</div>'
                     '<div class="btn btn-ghost" style="color:#8B8B8B">Где взять Client ID?</div>')
        + step(2, "Выберите награду и привяжите звук",
               "Награды Channel Points подтянутся с канала. Можно создать награду прямо здесь — "
               "и сразу выбрать для неё файл.")
        + step(3, "Проверьте звук",
               "Кнопка «Проверить звук» проиграет файл так же, как при активации награды, "
               "и покажет индикатор в шапке.")
    )
    body = (
        '<div class="page-head">'
        '<div><div class="h1">Награды</div>'
        '<div class="sub">Подключите Twitch, чтобы увидеть награды канала</div></div>'
        '</div>'

        '<div style="display:flex;gap:14px;margin-top:14px">'
        '<div class="card" style="flex:1 1 62%;padding:16px 20px">'
        '<div style="display:flex;align-items:flex-start">'
        '<div><div style="font-size:19px;font-weight:600">Быстрый старт</div>'
        '<div style="font-size:12.8px;color:#8B8B8B;margin-top:3px">Три шага — и звуки будут играть на стриме автоматически.</div></div>'
        '<div style="margin-left:auto" class="pill">0 из 3</div></div>'
        '<div style="margin-top:6px">' + steps + '</div>'
        '<div style="display:flex;align-items:center;gap:10px;padding-top:10px">'
        '<div style="display:flex;align-items:center;gap:8px;font-size:12.4px;color:#8B8B8B">'
        '<span class="dot dot-green"></span>Аудиовыход в порядке · Analogue 1/2 (Audient iD4)</div>'
        '<div class="spacer"></div>'
        '<div class="btn btn-sm btn-ghost" style="height:28px;color:#8B8B8B">Проверить подключение</div>'
        '</div></div>'

        '<div style="flex:1 1 38%;display:flex;flex-direction:column;gap:12px">'
        '<div class="card" style="padding:16px 16px">'
        '<div style="font-size:15px;font-weight:600">Почему нужен Client ID?</div>'
        '<div style="margin-top:9px;display:flex;flex-direction:column;gap:7px;font-size:12.2px;color:#A8A8A8;line-height:16px">'
        '<div style="display:flex;gap:8px"><span style="color:#22C55E">•</span>Это идентификатор приложения, а не логин и не пароль.</div>'
        '<div style="display:flex;gap:8px"><span style="color:#22C55E">•</span>Нужен один раз: приложение запоминает вход между запусками.</div>'
        '<div style="display:flex;gap:8px"><span style="color:#22C55E">•</span>Понадобится 2FA на аккаунте Twitch — этого требует сам Twitch.</div>'
        '</div>'
        '<div style="margin-top:12px" class="btn btn-sm btn-secondary" style="height:30px">Открыть инструкцию</div>'
        '</div>'
        '<div class="card" style="padding:14px 16px;display:flex;align-items:center;gap:12px">'
        '<div style="width:38px;height:38px;border-radius:12px;background:rgba(34,197,94,.14);display:flex;align-items:center;justify-content:center">'
        + ICON_BARS + '</div>'
        '<div><div style="font-size:13.4px;font-weight:600">Звук готов</div>'
        '<div style="font-size:11.8px;color:#8B8B8B">Можно проверить его без Twitch — ниже локальные привязки.</div></div>'
        '</div></div></div>'

        '<div class="card" style="margin-top:12px;padding:14px 16px">'
        '<div style="display:flex;align-items:center;gap:10px">'
        '<div style="font-size:15px;font-weight:600">Локальные привязки · 9</div>'
        '<div class="pill" style="height:24px;font-size:11.2px;padding:0 9px">работают без Twitch</div>'
        '<div class="spacer"></div>'
        '<div class="btn btn-sm btn-ghost" style="height:28px;color:#8B8B8B">Показать все</div></div>'
        '<div style="margin-top:8px;display:flex;gap:10px">'
        + "".join(
            '<div style="flex:1 1 0;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);padding:8px 10px">'
            '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:12.8px;font-weight:600">' + title + '</span>'
            '<span style="margin-left:auto;font-size:10.8px;color:#8B8B8B">' + fmt + '</span></div>'
            '<div style="display:flex;align-items:center;gap:8px;margin-top:7px">'
            '<div style="width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center">' + ICON_PLAY + '</div>'
            '<div class="slider sm" style="width:82px"><div class="track"></div><div class="fill" style="width:' + str(vol // 2) + '%"></div>'
            '<div class="knob" style="left:' + str(vol // 2) + '%;width:11px;height:11px;top:2.5px"></div></div>'
            '<span style="font-size:10.6px;color:#8B8B8B">' + str(vol) + '%</span></div>'
            '</div>'
            for title, fmt, vol in [("Ты новичок?", "0:08", 200), ("Шиза", "3:14", 46), ("А где донаты", "0:11", 185)]
        )
        + '</div>'
        '<div style="font-size:11.2px;color:rgba(139,139,139,.75);margin-top:8px">Файлы и громкость хранятся локально — их можно менять и слушать даже без подключения к Twitch.</div>'
        '</div>'
    )
    return page("rewards", body, connected=False, listening=False)


def render(name, html):
    html_path = OUT / (name + ".html")
    png_path = OUT / (name + ".png")
    html_path.write_text(html, encoding="utf-8")
    subprocess.run([
        CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--force-device-scale-factor=2", "--window-size=1220,840",
        f"--screenshot={png_path}", html_path.as_uri(),
    ], check=True, capture_output=True)
    print("rendered", png_path, png_path.stat().st_size)


render("mockup-01-rewards", mock_rewards())
render("mockup-02-music", mock_music())
render("mockup-03-onboarding", mock_onboarding())
