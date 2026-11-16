import json, pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\screens.js")
s=p.read_text(encoding="utf-8")
data=json.loads(s.split("=",1)[1].rstrip(";\n"))
m=data["music"]
for token in ["player", "queue", "soundchip", "manual-url", "btn"]:
    i=m.find(token)
    print("=====",token,i)
    print(m[max(0,i-500):i+900].replace("\n"," ")[:1400])