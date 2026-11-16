import json, pathlib

p = pathlib.Path(r'F:\WorkSpaces\Mur rewards\reward-sounds-tauri\src-tauri\ui\screens.js')
raw = p.read_text(encoding='utf-8')


def esc(html):
    return json.dumps(html, ensure_ascii=False)[1:-1]


old = '<div class="slider sm"><div class="track"></div><div class="fill" style="width:0%"></div></div>'
new = '<div class="slider sm disabled"><div class="track"></div><div class="fill" style="width:0%"></div></div>'
count = raw.count(esc(old))
print('occurrences:', count)
if count != 1:
    raise SystemExit('unexpected count')
raw = raw.replace(esc(old), esc(new))
json.loads(raw.split('=', 1)[1].strip().rstrip(';'))
p.write_text(raw, encoding='utf-8')
print('ok')
