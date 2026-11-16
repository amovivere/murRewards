import json, pathlib

p = pathlib.Path(r'F:\WorkSpaces\Mur rewards\reward-sounds-tauri\src-tauri\ui\screens.js')
raw = p.read_text(encoding='utf-8')


def esc(html):
    return json.dumps(html, ensure_ascii=False)[1:-1]


old_open = '<div class="spacer"></div><div class="btn btn-icon btn-secondary"><svg width="15" height="15"'
new_open = '<div class="spacer"></div><div class="toolbar-actions"><div class="btn btn-icon btn-secondary"><svg width="15" height="15"'
assert raw.count(esc(old_open)) == 1, raw.count(esc(old_open))
raw = raw.replace(esc(old_open), esc(new_open))

old_close = 'Остановить всё</div>'
# в rewards после кнопки «Остановить всё» закрывается тулбар
assert raw.count(esc(old_close)) == 1
raw = raw.replace(esc(old_close), esc('Остановить всё</div></div>'))

data = json.loads(raw.split('=', 1)[1].strip().rstrip(';'))
assert 'toolbar-actions' in data['rewards']
p.write_text(raw, encoding='utf-8')
print('screens.js rewards toolbar wrapped ok')
