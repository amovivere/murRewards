import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.js")
s=p.read_text(encoding="utf-8")
s=s.replace("""      const url = Array.from(obsCard.querySelectorAll('div')).find((el) =>
        el.textContent.includes('127.0.0.1:8770')
      );
      if (url) url.textContent = 'http://127.0.0.1:8770/overlay';""","""      const url = obsCard.querySelector('div[style*="font-family:monospace"]');
      if (url) url.textContent = 'http://127.0.0.1:8770/overlay';""")
p.write_text(s,encoding="utf-8")
print("obs url selector fixed")