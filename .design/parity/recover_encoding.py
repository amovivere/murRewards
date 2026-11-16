import pathlib

p = pathlib.Path(r'F:\WorkSpaces\Mur rewards\reward-sounds-tauri\src-tauri\src\core.rs')
raw = p.read_bytes()
text = raw.decode('utf-8')
# Damage: original UTF-8 bytes were decoded as cp1251 by PowerShell, then written as UTF-8.
try:
    recovered = text.encode('cp1251').decode('utf-8')
    print('recoverable, chars:', len(text))
    sample_before = text.splitlines()[78]
    sample_after = recovered.splitlines()[78]
    print('before:', sample_before)
    print('after :', sample_after)
except Exception as exc:
    print('FAILED:', type(exc).__name__, exc)
