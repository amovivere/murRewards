import re, json, pathlib
base = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review\mockups")
out = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui")
def content(path):
    s = pathlib.Path(path).read_text(encoding="utf-8")
    main = s.split('<div class="main">',1)[1]
    head = main.split('<div class="content">',1)[0]
    rest = main.split('<div class="content">',1)[1]
    footer_i = rest.find('<div class="footer">')
    c = rest[:footer_i].rstrip()
    assert c.endswith('</div>'), c[-100:]
    return c[:-6]
rewards = content(base/"mockup-01-rewards.html")
music = content(base/"mockup-02-music.html")
onboarding = content(base/"mockup-03-onboarding.html")
# поиск в наградах -> input
def repl_search(html, ident, placeholder):
    pattern = re.compile(r'<div class="search"[^>]*>(.*?)</div>', re.S)
    m = pattern.search(html)
    assert m, "search not found"
    svg = re.search(r'<svg.*?</svg>', m.group(1), re.S).group(0)
    repl = f'<label class="search">{svg}<input id="{ident}" type="text" placeholder="{placeholder}" autocomplete="off"></label>'
    return html[:m.start()] + repl + html[m.end():]
rewards = repl_search(rewards, "reward-search", "Поиск награды")
music = repl_search(music, "manual-url", "Вставьте ссылку YouTube и нажмите Enter — трек встанет в очередь")
# селект сортировки
m = re.search(r'<div class="select"[^>]*>(.*?)</div>', rewards, re.S)
assert m, "select not found"
options = ["Все награды", "Сначала дорогие", "Сначала дешёвые", "По названию"]
sel = '<select class="select" id="reward-sort">' + ''.join(f'<option>{o}</option>' for o in options) + '</select>'
rewards = rewards[:m.start()] + sel + rewards[m.end():]
screens = {"rewards": rewards, "music": music, "onboarding": onboarding}
(out/"screens.js").write_text("window.SCREENS = " + json.dumps(screens, ensure_ascii=False) + ";\n", encoding="utf-8")
print({k: len(v) for k,v in screens.items()})
# отладочные фрагменты
for key in ["search", "select", "player"]:
    i = screens["rewards" if key!="player" else "music"].find(key)
    print("---",key,i, screens["rewards" if key!="player" else "music"][max(0,i-100):i+400].replace("\n"," "))