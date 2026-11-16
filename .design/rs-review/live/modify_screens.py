import json, pathlib

p = pathlib.Path(r'F:\WorkSpaces\Mur rewards\reward-sounds-tauri\src-tauri\ui\screens.js')
raw = p.read_text(encoding='utf-8')
data = json.loads(raw.split('=', 1)[1].strip().rstrip(';'))

for name, html in data.items():
    import re
    dups = re.findall(r'style="[^"]*"\s+style="[^"]*"', html)
    if dups:
        print(f'{name}: duplicate style attrs: {len(dups)} -> {dups}')

def esc(html):
    return json.dumps(html, ensure_ascii=False)[1:-1]

def replace_once(screen, old, new, label):
    global raw
    old_esc, new_esc = esc(old), esc(new)
    count = raw.count(old_esc)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 occurrence, got {count}')
    raw = raw.replace(old_esc, new_esc)
    print(f'{label}: ok')

# 1. Кнопка статуса приёма заявок: инлайновый фиолетовый стиль -> класс с hover-состоянием.
replace_once(
    'music',
    '<div class="btn btn-primary" style="background:rgba(139,0,255,.16);color:#8B00FF;border:1px solid rgba(139,0,255,.38)">',
    '<div class="btn btn-primary btn-music-state">',
    'music status button',
)

# 2. Иконка «копировать» у ссылки на OBS-оверлей: класс + id + hover.
replace_once(
    'music',
    '<div style="width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,.05);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B8B8B" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg></div>',
    '<div class="copy-btn" id="obs-copy-url" title="Скопировать ссылку"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B8B8B" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg></div>',
    'music obs copy button',
)

# 3. Онбординг: дублирующиеся атрибуты style (второй игнорируется браузером).
old_op = '<div style="opacity:.55" style="flex:1 1 auto">'
new_op = '<div style="opacity:.55;flex:1 1 auto">'
count = raw.count(esc(old_op))
if count != 2:
    raise SystemExit(f'onboarding opacity: expected 2, got {count}')
raw = raw.replace(esc(old_op), esc(new_op))
print('onboarding opacity/flex: ok')

replace_once(
    'onboarding',
    '<div style="margin-top:12px" class="btn btn-sm btn-secondary" style="height:30px">',
    '<div class="btn btn-sm btn-secondary" style="margin-top:12px;height:30px">',
    'onboarding secondary button',
)

# Проверка, что JSON остался валидным и содержит ожидаемые изменения.
data2 = json.loads(raw.split('=', 1)[1].strip().rstrip(';'))
assert 'btn-music-state' in data2['music']
assert 'obs-copy-url' in data2['music']
assert data2['onboarding'].count('style="opacity:.55;flex:1 1 auto"') == 2
p.write_text(raw, encoding='utf-8')
print('screens.js updated, keys:', list(data2.keys()))
