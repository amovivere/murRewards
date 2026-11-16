import re, os

src_dir = r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src"
files = {}
for name in ["app.rs", "theme.rs", "config.rs", "tray.rs", "window_ops.rs", "logging.rs",
             "util.rs", "audio.rs", "http.rs", "autostart.rs", "main.rs", "twitch.rs",
             "eventsub.rs", "playback.rs"]:
    with open(os.path.join(src_dir, name), encoding="utf-8") as f:
        files[name] = f.readlines()

rep_path = r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review\report-ux.md"
with open(rep_path, encoding="utf-8") as f:
    report = f.read()

refs = re.findall(r"([a-z_]+\.rs):(\d+)(?:-(\d+))?", report)
bad = []
seen = set()
for name, a, b in refs:
    if name not in files:
        bad.append((name, a, b, "unknown file"))
        continue
    n = len(files[name])
    for x in (a, b):
        if x and (int(x) < 1 or int(x) > n):
            bad.append((name, a, b, f"out of range (file has {n} lines)"))
    seen.add((name, int(a), int(b) if b else int(a)))

print("total refs:", len(refs), "unique:", len(seen))
print("bad refs:", bad if bad else "none")

# Spot check a sample of claims: print source line for each ref in a chosen set
checks = [
    ("app.rs", 3504), ("app.rs", 1115), ("app.rs", 1099), ("app.rs", 1231), ("app.rs", 2426),
    ("app.rs", 319), ("app.rs", 1170), ("app.rs", 1374), ("app.rs", 1444), ("app.rs", 1198),
    ("app.rs", 1214), ("app.rs", 3385), ("app.rs", 1301), ("app.rs", 1309), ("app.rs", 1339),
    ("app.rs", 1460), ("app.rs", 1478), ("app.rs", 1494), ("app.rs", 1506), ("app.rs", 1521),
    ("app.rs", 1545), ("app.rs", 1559), ("app.rs", 1570), ("app.rs", 1592), ("app.rs", 1614),
    ("app.rs", 1620), ("app.rs", 1673), ("app.rs", 1887), ("app.rs", 2092), ("app.rs", 1772),
    ("app.rs", 1915), ("app.rs", 2039), ("app.rs", 2053), ("app.rs", 2135), ("app.rs", 2143),
    ("app.rs", 2372), ("app.rs", 2536), ("app.rs", 2551), ("app.rs", 2560), ("app.rs", 2659),
    ("app.rs", 2690), ("app.rs", 2718), ("app.rs", 2795), ("app.rs", 3924), ("app.rs", 3946),
    ("app.rs", 4007), ("app.rs", 4099), ("app.rs", 4133), ("app.rs", 4173), ("app.rs", 4252),
    ("app.rs", 4285), ("app.rs", 4318), ("app.rs", 4423), ("app.rs", 4452), ("app.rs", 4548),
    ("theme.rs", 26), ("theme.rs", 137), ("config.rs", 246), ("tray.rs", 171), ("tray.rs", 318),
    ("window_ops.rs", 60), ("window_ops.rs", 70), ("logging.rs", 17), ("logging.rs", 31),
    ("autostart.rs", 20), ("http.rs", 18), ("main.rs", 41),
]
for name, line in checks:
    idx = line - 1
    text = files[name][idx].rstrip("\n") if idx < len(files[name]) else "<OUT OF RANGE>"
    print(f"{name}:{line}: {text[:150]}")
