import pathlib, shutil

base = pathlib.Path(r'F:\WorkSpaces\Mur rewards\reward-sounds-tauri\src-tauri\src')
rec = (base / 'core.recovered.rs').read_text(encoding='utf-8')
cur = (base / 'core.rs').read_text(encoding='utf-8')

bad_markers = ['РЎ', 'Рѕ', 'Рї', 'СЂ', 'Рµ']
print('mojibake markers in recovered:', {m: rec.count(m) for m in bad_markers})
print('mojibake markers in current  :', {m: cur.count(m) for m in bad_markers})

checks = [
    'Локальная привязка звука',
    'Громкость выровнена по',
    'Не удалось измерить громкость',
    'Награда не найдена в списке — обновите его на вкладке «Награды».',
    'Нет привязанных звуков для выравнивания.',
    'Не удалось открыть устройство вывода звука',
    'Выход из приложения по кнопке в интерфейсе',
]
for phrase in checks:
    print(('OK  ' if phrase in rec else 'MISS'), phrase[:70])

# Исходные (не тронутые мной) строки должны остаться.
untouched = [
    'Не удалось сохранить настройки',
    'Twitch не принял токен. Подключите аккаунт заново.',
    'Не задан Client ID Twitch.',
]
for phrase in untouched:
    print(('KEPT' if phrase in rec else 'LOST'), phrase[:70])

print('recovered bytes:', len(rec.encode('utf-8')), 'lines:', len(rec.splitlines()))
# Сохраняем бэкап повреждённого файла, ставим восстановленный.
shutil.copyfile(base / 'core.rs', base / 'core.corrupted.bak')
(base / 'core.rs').write_text(rec, encoding='utf-8', newline='')
print('core.rs restored')
