import pathlib, subprocess

p = pathlib.Path(r'F:\WorkSpaces\Mur rewards\reward-sounds-tauri\src-tauri\src\core.rs')
text = p.read_text(encoding='utf-8', errors='strict')

# Обратная карта: Unicode -> исходный байт (декодирование cp1251 + passthrough неопределённых байт).
char_to_byte = {}
for b in range(256):
    try:
        ch = bytes([b]).decode('cp1251')
    except UnicodeDecodeError:
        ch = chr(b)
    char_to_byte.setdefault(ch, b)

missing = sorted({ch for ch in text if ch not in char_to_byte})
print('unmapped chars:', [(hex(ord(c)), repr(c)) for c in missing][:10])
if missing:
    raise SystemExit('cannot recover')

data = bytes(char_to_byte[ch] for ch in text)
try:
    recovered = data.decode('utf-8')
except UnicodeDecodeError as exc:
    print('utf8 decode failed:', exc)
    raise SystemExit(1)

# Сравниваем с оригиналом из git: отличия должны быть только моими правками.
head = subprocess.run(
    ['git', 'show', 'HEAD:reward-sounds-tauri/src-tauri/src/core.rs'],
    cwd=r'F:\WorkSpaces\Mur rewards',
    capture_output=True,
).stdout.decode('utf-8')
orig_lines = head.splitlines()
rec_lines = recovered.splitlines()
print('orig lines', len(orig_lines), 'recovered lines', len(rec_lines))
diff_count = 0
for index, (a, b) in enumerate(zip(orig_lines, rec_lines)):
    if a.strip() and a.strip() != b.strip():
        diff_count += 1
        if diff_count <= 5:
            print('---', index + 1)
            print('HEAD:', a[:100])
            print('REC :', b[:100])
print('differing lines:', diff_count)

if diff_count > 0 and all('Р' in line or 'С' in line or 'РЎ' in line for line in [(rec_lines[i] if i < len(rec_lines) else '') for i in [0]] ):
    pass

p.with_suffix('.recovered.rs').write_text(recovered, encoding='utf-8')
print('wrote', str(p.with_suffix('.recovered.rs')))
