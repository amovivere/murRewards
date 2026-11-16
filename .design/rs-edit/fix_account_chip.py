import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.css")
s=p.read_text(encoding="utf-8")
if "/* account chip — button reset */" not in s:
    s += """
/* аккаунт-пилюля: кнопка не должна показывать системную рамку браузера */
.account-chip {
  border: 0;
  outline: none;
  font: inherit;
  font-size: 13.8px;
  color: #22C55E;
  background: rgba(34,197,94,.14);
  height: 32px;
  padding: 0 18px;
  border-radius: 16px;
  cursor: pointer;
}
.account-chip:hover { background: rgba(34,197,94,.20); }
body.offline #account-chip { background: rgba(255,255,255,.06); color: #8B8B8B; }
"""
    p.write_text(s,encoding="utf-8")
print("account chip reset")