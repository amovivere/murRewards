import pathlib, re
root=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui")
for f in ["style.css","app.css","app.js","index.html","screens.js"]:
    p=root/f
    s=p.read_text(encoding="utf-8")
    print(f, "22C55E", s.count("#22C55E"), "rgba34", s.count("rgba(34,197,94"), "green", len(re.findall(r'#22C55E|rgba\(34,197,94', s, re.I)))
    for pat in ["translateY","scale(","transform"]:
        print("  ",pat,s.count(pat))