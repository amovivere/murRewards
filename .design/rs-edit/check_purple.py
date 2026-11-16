import pathlib
ui=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui")
for n in ["style.css","app.css","app.js","screens.js","index.html"]:
    s=(ui/n).read_text(encoding="utf-8")
    print(n, "green", s.count("#22C55E")+s.count("rgba(34,197,94"), "purple", s.count("#8B00FF")+s.count("rgba(139,0,255"))