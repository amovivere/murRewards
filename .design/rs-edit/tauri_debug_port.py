import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\main.rs")
s=p.read_text(encoding="utf-8")
if 'remote-debugging-port' not in s:
    s=s.replace(".data_directory(data_dir)", ".data_directory(data_dir)\n            .additional_browser_args(\"--remote-debugging-port=9333\")")
p.write_text(s,encoding="utf-8")
print("debug port")