import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-edit\gen_screens2.py")
s=p.read_text(encoding="utf-8")
# repl_search получает доп. стиль
s=s.replace('''def repl_search(html, ident, placeholder):
    pattern = re.compile(r'<div class="search"[^>]*>(.*?)</div>', re.S)
    m = pattern.search(html)
    assert m, "search not found"
    svg = re.search(r"<svg.*?</svg>", m.group(1), re.S).group(0)
    repl = (
        f'<label class="search">{svg}<input id="{ident}" type="text" '
        f'placeholder="{placeholder}" autocomplete="off"></label>'
    )
    return html[: m.start()] + repl + html[m.end():]''','''def repl_search(html, ident, placeholder, style=""):
    pattern = re.compile(r'<div class="search"[^>]*>(.*?)</div>', re.S)
    m = pattern.search(html)
    assert m, "search not found"
    svg = re.search(r"<svg.*?</svg>", m.group(1), re.S).group(0)
    repl = (
        f'<label class="search" {style}>{svg}<input id="{ident}" type="text" '
        f'placeholder="{placeholder}" autocomplete="off"></label>'
    )
    return html[: m.start()] + repl + html[m.end():]''')
s=s.replace('''music = repl_search(
    music,
    "manual-url",
    "Вставьте ссылку YouTube и нажмите Enter — трек встанет в очередь",
)''','''music = repl_search(
    music,
    "manual-url",
    "Вставьте ссылку YouTube и нажмите Enter — трек встанет в очередь",
    'style="flex:1 1 auto;width:auto"',
)''')
s=s.replace('''onboarding = onboarding.replace(
    'Подключить Twitch</div>', ' data-act="connect">Подключить Twitch</div>', 1
)''','''onboarding = onboarding.replace(
    'class="btn btn-primary">Подключить Twitch</div>',
    'class="btn btn-primary" data-act="connect">Подключить Twitch</div>',
    1,
)''')
p.write_text(s,encoding="utf-8")

# app.js: offline и obs параметры
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.js")
s=p.read_text(encoding="utf-8")
s=s.replace('''    const params = new URLSearchParams(location.search);
    const initial = params.get('screen') || (state.connected ? 'rewards' : 'rewards');
    render(initial);
    applyStatusToDom();''','''    const params = new URLSearchParams(location.search);
    if (params.get('offline') === '1') state.connected = false;
    const initial = params.get('screen') || 'rewards';
    render(initial);
    applyStatusToDom();
    if (params.get('obs') === '1' && initial === 'music') {
      requestAnimationFrame(() => openObsModal());
    }''')
p.write_text(s,encoding="utf-8")
print("patched generator/js")