import json, pathlib, re

p = pathlib.Path(r'F:\WorkSpaces\Mur rewards\reward-sounds-tauri\src-tauri\ui\screens.js')
s = p.read_text(encoding='utf-8')
print('head:', s[:60])
print('tail:', s[-40:])
data = json.loads(s.split('=', 1)[1].strip().rstrip(';'))
music = data['music']
onb = data['onboarding']
for pat in ['Принимаем заявки', '127.0.0.1:8770/overlay', 'opacity:.55', 'Открыть инструкцию']:
    idx = music.find(pat) if pat in music else onb.find(pat)
    src = music if pat in music else onb
    print('\n---', pat, '---')
    print(json.dumps(src[max(0, idx - 260): idx + 160], ensure_ascii=False))
