import json, pathlib

p = pathlib.Path(r'F:\WorkSpaces\Mur rewards\reward-sounds-tauri\src-tauri\ui\screens.js')
raw = p.read_text(encoding='utf-8')


def esc(html):
    return json.dumps(html, ensure_ascii=False)[1:-1]


old = '<div class="ghost-red" style="color:#8B8B8B">Открыть в «Музыке»</div>'
new = '<div class="ghost-red ghost-neutral" data-act="open-music">Открыть в «Музыке»</div>'
count = raw.count(esc(old))
print('occurrences:', count)
if count != 1:
    raise SystemExit('unexpected occurrence count')
raw = raw.replace(esc(old), esc(new))
json.loads(raw.split('=', 1)[1].strip().rstrip(';'))
p.write_text(raw, encoding='utf-8')
print('ok')
