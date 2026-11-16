p = r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review\report-ux.md"
raw = open(p, "rb").read()
s = raw.decode("utf-8-sig")

# Build inverse of the Windows-cp1251 byte->char mapping (as .NET/PS 5.1 Get-Content did).
inv = {}
for b in range(256):
    try:
        ch = bytes([b]).decode("cp1251")
    except UnicodeDecodeError:
        continue
    inv[ch] = b
# undefined cp1251 bytes come back as control chars from .NET's decoder
inv.setdefault("\x98", 0x98)

missing = sorted({ch for ch in s if ch not in inv}, key=ord)
print("chars outside inverse map:", [(hex(ord(c)), repr(c)) for c in missing][:20])

data = bytearray()
for ch in s:
    data.append(inv[ch])
try:
    fixed = data.decode("utf-8")
    print("reverse OK, chars:", len(fixed))
    print("first line:", fixed.splitlines()[0])
    print("has Находки:", "Находки" in fixed)
    open(p, "wb").write(fixed.encode("utf-8"))
    print("written bytes:", len(open(p, "rb").read()))
except UnicodeDecodeError as e:
    print("utf8 decode failed:", e)
    i = e.start
    print("context bytes:", data[max(0, i - 40):i + 40])
