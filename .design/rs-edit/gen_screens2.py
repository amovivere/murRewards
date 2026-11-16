# -*- coding: utf-8 -*-
"""Генерирует screens.js из утверждённых макетов и добавляет data-атрибуты
для интерактивности прототипа Tauri."""
import json
import pathlib
import re

base = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review\mockups")
out = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui")


def content(path):
    s = pathlib.Path(path).read_text(encoding="utf-8")
    main = s.split('<div class="main">', 1)[1]
    rest = main.split('<div class="content">', 1)[1]
    footer_i = rest.find('<div class="footer">')
    c = rest[:footer_i].rstrip()
    assert c.endswith("</div>"), c[-100:]
    return c[:-6]


rewards = content(base / "mockup-01-rewards.html")
music = content(base / "mockup-02-music.html")
onboarding = content(base / "mockup-03-onboarding.html")


def repl_search(html, ident, placeholder, style=""):
    pattern = re.compile(r'<div class="search"[^>]*>(.*?)</div>', re.S)
    m = pattern.search(html)
    assert m, "search not found"
    svg = re.search(r"<svg.*?</svg>", m.group(1), re.S).group(0)
    repl = (
        f'<label class="search" {style}>{svg}<input id="{ident}" type="text" '
        f'placeholder="{placeholder}" autocomplete="off"></label>'
    )
    return html[: m.start()] + repl + html[m.end():]


# ---- «Награды» ----
rewards = repl_search(rewards, "reward-search", "Поиск награды")
m = re.search(r'<div class="select"[^>]*>(.*?)</div>', rewards, re.S)
assert m, "select not found"
options = ["Все награды", "Сначала дорогие", "Сначала дешёвые", "По названию"]
sel = '<select class="select" id="reward-sort">' + "".join(
    f"<option>{o}</option>" for o in options
) + "</select>"
rewards = rewards[: m.start()] + sel + rewards[m.end():]

rewards = rewards.replace('<div class="grid">', '<div class="grid" id="reward-grid">', 1)
rewards = rewards.replace('<div class="pills">', '<div class="pills" id="reward-pills">', 1)
# карточки
rewards = rewards.replace('<div class="card" style="', '<div class="card reward-card" style="')
# звуковые кнопки
rewards = rewards.replace('<span class="play">', '<span class="play sound-play">')
# действия
rewards = rewards.replace('">Заменить</div>', '" data-act="replace">Заменить</div>')
rewards = rewards.replace('class="ghost-red">Убрать</div>', 'class="ghost-red" data-act="remove">Убрать</div>')
rewards = rewards.replace('>Выбрать звук</div>', ' data-act="choose">Выбрать звук</div>')
# кнопка создания
rewards = rewards.replace('Создать награду</div>', 'Создать награду</div>', 1)

# ---- «Музыка» ----
music = repl_search(
    music,
    "manual-url",
    "Вставьте ссылку YouTube и нажмите Enter — трек встанет в очередь",
    'style="flex:1 1 auto;width:auto"',
)
music = music.replace(
    '<div class="card" style="margin-top:12px;height:156px;',
    '<div class="card" id="music-player" style="margin-top:12px;height:156px;',
    1,
)
music = music.replace(
    '<div style="width:40px;height:40px;border-radius:50%;background:#EDEDED;',
    '<div id="play-toggle" data-playing="1" style="width:40px;height:40px;border-radius:50%;background:#EDEDED;',
    1,
)
music = music.replace(
    '<div style="flex:1 1 auto;position:relative;height:14px">',
    '<div id="track-progress" style="flex:1 1 auto;position:relative;height:14px;cursor:pointer">',
    1,
)
music = music.replace(
    'style="position:absolute;left:0;width:35%;top:6px;height:2px;border-radius:2px;background:#EDEDED"',
    'id="progress-fill" style="position:absolute;left:0;width:35%;top:6px;height:2px;border-radius:2px;background:#EDEDED"',
    1,
)
music = music.replace(
    'style="position:absolute;left:35%;top:0;width:14px;height:14px;margin-left:-7px;border-radius:50%;background:#fff"',
    'id="progress-knob" style="position:absolute;left:35%;top:0;width:14px;height:14px;margin-left:-7px;border-radius:50%;background:#fff"',
    1,
)
music = music.replace(
    '<div style="margin-left:12px;font-size:13.2px;color:#8B8B8B">Пропустить трек</div>',
    '<div id="skip-track" style="margin-left:12px;font-size:13.2px;color:#8B8B8B;cursor:pointer">Пропустить трек</div>',
    1,
)
music = music.replace(
    '<div class="card" style="margin-top:10px;padding:12px 16px">',
    '<div class="card" id="music-queue" style="margin-top:10px;padding:12px 16px">',
    1,
)
# строки очереди
music = re.sub(
    r'style="display:flex;align-items:center;gap:12px;height:(36|42)px',
    lambda m: f'class="queue-row" style="display:flex;align-items:center;gap:12px;height:{m.group(1)}px',
    music,
)
# кнопки 26x26 внутри очереди: помечаем все, JS отличит X/↑ по SVG
music = music.replace(
    '<div style="width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.05)">',
    '<div class="queue-btn" style="width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.05);cursor:pointer">',
)
# нижние карточки
music = music.replace(
    '<div class="card" style="flex:1 1 55%;padding:14px 16px">',
    '<div class="card" id="obs-card" style="flex:1 1 55%;padding:14px 16px">',
    1,
)
music = music.replace(
    '<div class="card" style="flex:1 1 45%;height:128px;overflow:hidden;padding:12px 14px">',
    '<div class="card" id="state-card" style="flex:1 1 45%;height:128px;overflow:hidden;padding:12px 14px">',
    1,
)
music = music.replace(
    '<div class="btn btn-sm btn-ghost" style="height:28px">Настроить</div>',
    '<div class="btn btn-sm btn-ghost" id="obs-open" style="height:28px;cursor:pointer">Настроить</div>',
    1,
)
music = music.replace(
    '<div style="margin-left:auto" class="btn btn-sm btn-secondary" style="height:28px">Показать сейчас</div>',
    '<div style="margin-left:auto" class="btn btn-sm btn-secondary" id="obs-show" style="height:28px;cursor:pointer">Показать сейчас</div>',
    1,
)
music = music.replace(
    '<div class="btn btn-secondary"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F5F5F5" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/></svg>Оверлей OBS</div>',
    '<div class="btn btn-secondary" id="obs-header" style="cursor:pointer"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F5F5F5" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/></svg>Оверлей OBS</div>',
    1,
)

# ---- онбординг ----
onboarding = onboarding.replace(
    'class="btn btn-primary">Подключить Twitch</div>',
    'class="btn btn-primary" data-act="connect">Подключить Twitch</div>',
    1,
)

screens = {"rewards": rewards, "music": music, "onboarding": onboarding}
(out / "screens.js").write_text(
    "window.SCREENS = " + json.dumps(screens, ensure_ascii=False) + ";\n",
    encoding="utf-8",
)
print({k: len(v) for k, v in screens.items()})
for key, html in screens.items():
    print(key, "queue-rows:", html.count("queue-row"), "queue-btn:", html.count("queue-btn"), "acts:", html.count("data-act"), "sliders:", html.count('class="slider'))
