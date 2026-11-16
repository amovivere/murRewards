import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\Cargo.toml")
s=p.read_text(encoding="utf-8")
if 'log = ' not in s:
    s=s.replace('serde_json = "1"', 'serde_json = "1"\nlog = "0.4"')
p.write_text(s,encoding="utf-8")
print("log dep added")