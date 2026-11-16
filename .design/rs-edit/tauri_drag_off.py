import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\index.html")
s=p.read_text(encoding="utf-8")
s=s.replace(' class="titlebar" data-tauri-drag-region',' class="titlebar"')
p.write_text(s,encoding="utf-8")
print("drag region off")